import { buildProposal } from './split.js';
import { seatById } from './roster.js';
import { blockedLine, heartbeatLine, initialStatusLine } from './progress.js';
import { enabledKnights, latestProposal } from './state.js';
import { completeLive } from './providers.js';

export function previewReply(seat, prompt, question, allocation) {
  const share = allocation
    ? `${allocation.percent}% · ${allocation.responsibility}`
    : 'a supporting pass';
  const clip = String(question || prompt || '').trim().slice(0, 160);
  if (seat.role === 'arbiter') {
    return `The split stands. ${clip ? `On “${clip}”, the lead seat should take the first cut.` : 'Ask a seat if you want that voice alone.'}`;
  }
  return `${share}. ${clip ? `For “${clip}”, ` : ''}I'd ship a first cut and name the risk before the next handoff.`;
}

function parseLiveProposal(text, { id, revision, knightsOn }) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  let json;
  try { json = JSON.parse(match[0]); } catch { return null; }
  if (!Array.isArray(json.allocations)) return null;
  const allowed = new Set(knightsOn.map((seat) => seat.id));
  const allocations = json.allocations
    .filter((row) => allowed.has(row.seatId))
    .map((row) => ({
      seatId: row.seatId,
      percent: Math.max(0, Math.round(Number(row.percent) || 0)),
      responsibility: String(row.responsibility || 'Review & integration').slice(0, 80),
    }));
  const sum = allocations.reduce((total, row) => total + row.percent, 0);
  if (!allocations.length || sum < 90 || sum > 110) return null;
  return {
    id,
    revision,
    pattern: 'percent-split',
    source: 'live',
    approach: String(json.approach || 'Provider split').slice(0, 240),
    allocations,
    superseded: false,
  };
}

export function createOrchestrator({
  getState,
  dispatch,
  getSecrets,
  roster,
  delay,
  now,
  id,
  complete = completeLive,
}) {
  let generation = 0;

  function start() {
    generation += 1;
    return generation;
  }

  function alive(token) {
    return token === generation;
  }

  function invalidate() {
    generation += 1;
  }

  async function speakStatus(token, seat, line, channel) {
    if (!alive(token) || !line) return;
    if (channel === 'feed') {
      dispatch({ type: 'FEED_ADD', id: id('feed'), text: line });
      return;
    }
    dispatch({
      type: 'MESSAGE_APPENDED',
      message: {
        id: id('msg'),
        seatId: seat.id,
        kind: 'status',
        text: line,
        status: 'done',
        createdAt: now(),
      },
    });
  }

  function watch(token, seat, channel) {
    const started = Date.now();
    const seen = new Set();
    const timer = setInterval(() => {
      if (!alive(token)) {
        clearInterval(timer);
        return;
      }
      const elapsed = Date.now() - started;
      const status = elapsed >= 4000 ? 'working' : 'thinking';
      dispatch({ type: 'SET_SEAT_STATUS', seatId: seat.id, status, now: now() });
      const line = heartbeatLine(seat.name, status, elapsed);
      if (line && !seen.has(line)) {
        seen.add(line);
        speakStatus(token, seat, line, channel);
      }
    }, 1000);
    return () => clearInterval(timer);
  }

  async function draft(token) {
    const state = getState();
    const bot = seatById('botbot', roster);
    dispatch({ type: 'SET_SEAT_STATUS', seatId: 'botbot', status: 'thinking', now: now() });
    await speakStatus(token, bot, initialStatusLine(bot.name, 'thinking'), 'feed');
    const knightsOn = enabledKnights(state, roster);
    let proposal = null;
    const secret = getSecrets().arbiter;
    if (secret) {
      const stop = watch(token, bot, 'feed');
      let result = { ok: false, message: 'The provider call failed.' };
      try {
        result = await complete({
          providerId: 'arbiter',
          apiKey: secret,
          system: 'You are BotBot, arbiter of the Round Table. Reply with JSON only: {"approach": string, "allocations": [{"seatId": string, "percent": number, "responsibility": string}]}. Percents must sum to 100. Only use the given seat ids.',
          user: JSON.stringify({
            prompt: state.prompt,
            note: state.phase.note || '',
            seats: knightsOn.map((seat) => seat.id),
          }),
        });
      } catch {
        result = { ok: false, message: 'The provider call failed.' };
      }
      stop();
      if (!alive(token)) return;
      if (result.ok) {
        proposal = parseLiveProposal(result.text, { id: id('prop'), revision: state.phase.revision, knightsOn });
      }
      if (!proposal) {
        await speakStatus(token, bot, 'BotBot could not use the provider reply. Drafting a local split.', 'feed');
      }
    } else {
      await delay(320);
    }
    if (!alive(token)) return;
    if (!proposal) {
      proposal = buildProposal({
        prompt: state.prompt,
        knights: knightsOn,
        revision: getState().phase.revision || 1,
        id: id('prop'),
        note: getState().phase.note || '',
        source: 'preview',
      });
    }
    dispatch({ type: 'SET_SEAT_STATUS', seatId: 'botbot', status: 'idle', now: now() });
    dispatch({ type: 'PROPOSAL_RECEIVED', proposal });
  }

  async function votes(token) {
    const state = getState();
    const proposal = latestProposal(state);
    if (!proposal) return;
    const rows = enabledKnights(state, roster);
    for (let index = 0; index < rows.length; index += 1) {
      if (!alive(token) || getState().phase.name !== 'voting') return;
      const seat = rows[index];
      rows.slice(index + 1).forEach((waiting) => {
        dispatch({ type: 'SET_SEAT_STATUS', seatId: waiting.id, status: 'waiting', now: now() });
      });
      dispatch({ type: 'SET_SEAT_STATUS', seatId: seat.id, status: 'thinking', now: now() });
      await speakStatus(token, seat, initialStatusLine(seat.name, 'weighing the split'), 'feed');
      await delay(200);
      if (!alive(token)) return;
      const share = proposal.allocations.find((row) => row.seatId === seat.id);
      dispatch({
        type: 'VOTE_CAST',
        vote: {
          kind: 'vote',
          seatId: seat.id,
          proposalId: proposal.id,
          choice: 'agree',
          reason: share ? `${share.percent}% on ${share.responsibility} is a fair cut.` : 'The split is workable.',
          at: now(),
        },
      });
      dispatch({ type: 'SET_SEAT_STATUS', seatId: seat.id, status: 'idle', now: now() });
    }
    if (!alive(token)) return;
    dispatch({ type: 'VOTES_RESOLVED' });
  }

  async function kickoff(token) {
    const state = getState();
    const proposal = latestProposal(state);
    const bot = seatById('botbot', roster);
    dispatch({
      type: 'MESSAGE_APPENDED',
      message: {
        id: id('msg'),
        seatId: 'botbot',
        kind: 'chat',
        text: `Plan approved. ${proposal?.approach || 'The table is open.'}`,
        status: 'done',
        createdAt: now(),
      },
    });
    const shares = (proposal?.allocations || []).filter((row) => row.percent > 0);
    for (const share of shares) {
      if (!alive(token)) return;
      const seat = seatById(share.seatId, roster);
      if (!seat) continue;
      dispatch({ type: 'SET_SEAT_STATUS', seatId: seat.id, status: 'working', now: now() });
      await speakStatus(token, bot, `Handing off to ${seat.name}…`, 'chat');
      await delay(140);
      if (!alive(token)) return;
      dispatch({
        type: 'MESSAGE_APPENDED',
        message: {
          id: id('msg'),
          seatId: seat.id,
          kind: 'chat',
          text: `Taking ${share.percent}% — ${share.responsibility}.`,
          status: 'done',
          createdAt: now(),
        },
      });
      dispatch({ type: 'SET_SEAT_STATUS', seatId: seat.id, status: 'idle', now: now() });
    }
    if (!alive(token)) return;
    dispatch({ type: 'KICKOFF_DONE' });
  }

  async function streamPreview(token, seat, text) {
    const messageId = id('msg');
    dispatch({
      type: 'MESSAGE_APPENDED',
      message: {
        id: messageId,
        seatId: seat.id,
        kind: 'chat',
        text: '',
        status: 'streaming',
        createdAt: now(),
      },
    });
    const parts = text.split(/(\s+)/);
    let acc = '';
    for (const part of parts) {
      acc += part;
      if (!alive(token)) return;
      dispatch({ type: 'MESSAGE_PATCHED', id: messageId, text: acc, status: 'streaming' });
      await delay(16);
    }
    if (!alive(token)) return;
    dispatch({ type: 'MESSAGE_PATCHED', id: messageId, text: acc, status: 'done' });
  }

  async function converse(token, question) {
    const state = getState();
    const proposal = latestProposal(state);
    let seatId = state.targetSeatId;
    if (!seatId) {
      const lead = [...(proposal?.allocations || [])].sort((a, b) => b.percent - a.percent)[0];
      seatId = lead?.seatId || 'botbot';
      const leadSeat = seatById(seatId, roster);
      await speakStatus(token, seatById('botbot', roster), `Handing this to ${leadSeat?.name || 'the table'}…`, 'chat');
    }
    const seat = seatById(seatId, roster);
    if (!seat) return;
    dispatch({ type: 'SET_SEAT_STATUS', seatId: seat.id, status: 'thinking', now: now() });
    await speakStatus(token, seat, initialStatusLine(seat.name, 'thinking'), 'chat');
    const secret = getSecrets()[seat.providerId];
    const allocation = proposal?.allocations.find((row) => row.seatId === seat.id);
    if (secret) {
      const stop = watch(token, seat, 'chat');
      let result = { ok: false, code: 'network', message: 'The provider call failed.' };
      try {
        result = await complete({
          providerId: seat.providerId,
          apiKey: secret,
          system: `You are ${seat.name} (${seat.tagline}) at the Round Table. Answer in 2-4 sentences.`,
          user: `Quest: ${state.prompt}\nShare: ${allocation ? `${allocation.percent}% ${allocation.responsibility}` : 'arbiter'}\nKing: ${question}`,
        });
      } catch {
        result = { ok: false, code: 'network', message: 'The provider call failed.' };
      }
      if (alive(token) && !result.ok && result.code === 'timeout') {
        await speakStatus(token, seat, `${seat.name} timed out. Retrying once.`, 'chat');
        result = await complete({
          providerId: seat.providerId,
          apiKey: secret,
          system: `You are ${seat.name}. Answer briefly.`,
          user: question,
        });
      }
      stop();
      if (!alive(token)) return;
      if (!result.ok) {
        dispatch({ type: 'SET_SEAT_STATUS', seatId: seat.id, status: 'blocked', detail: result.message, now: now() });
        await speakStatus(token, seat, blockedLine(seat.name, result.message), 'chat');
        dispatch({
          type: 'MESSAGE_APPENDED',
          message: {
            id: id('msg'),
            seatId: seat.id,
            kind: 'chat',
            text: `I'm blocked. ${result.message}`,
            status: 'done',
            createdAt: now(),
          },
        });
        return;
      }
      await streamPreview(token, seat, result.text);
    } else {
      await delay(260);
      if (!alive(token)) return;
      await streamPreview(token, seat, previewReply(seat, state.prompt, question, allocation));
    }
    if (!alive(token)) return;
    if (getState().seats[seat.id]?.status !== 'blocked') {
      dispatch({ type: 'SET_SEAT_STATUS', seatId: seat.id, status: 'idle', now: now() });
    }
  }

  return {
    invalidate,
    after(action) {
      if (action.type === 'SESSION_RESET') {
        invalidate();
        return Promise.resolve();
      }
      if (action.type === 'PROMPT_SUBMITTED' || action.type === 'REVISION_REQUESTED' || action.type === 'PROPOSAL_RETRY') {
        return draft(start());
      }
      if (action.type === 'VOTE_CALLED') return votes(start());
      if (action.type === 'IMPLEMENT') return kickoff(start());
      if (action.type === 'SEND') {
        const question = getState().messages.find((message) => message.id === action.messageId)?.text || '';
        return converse(start(), question);
      }
      return Promise.resolve();
    },
  };
}
