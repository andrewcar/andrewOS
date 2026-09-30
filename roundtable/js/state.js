import { seatById } from './roster.js';

/**
 * Prompt anchor. The old client painted this card in the center of the stage,
 * under the fixed round table. It now lives in the planning panel.
 */
export const PROMPT_ANCHOR = 'planning-panel';

export function normalizeArbiterId(roster, arbiterId) {
  const chosen = roster.find((seat) => seat.id === arbiterId && seat.role !== 'king');
  if (chosen) return chosen.id;
  const fallback = roster.find((seat) => seat.id === 'botbot' && seat.role !== 'king')
    || roster.find((seat) => seat.role !== 'king');
  return fallback?.id || 'botbot';
}

export function resolveArbiter(state, roster) {
  return seatById(normalizeArbiterId(roster, state?.arbiterId), roster);
}

export function createState({ now, sessionId, kingName, roster, arbiterId }) {
  const seats = {};
  for (const seat of roster) {
    if (seat.role === 'king') continue;
    seats[seat.id] = {
      id: seat.id,
      enabled: seat.defaultEnabled !== false,
      joinedMidQuest: false,
      status: 'idle',
      since: null,
      detail: '',
    };
  }
  return {
    version: 1,
    sessionId,
    kingName: kingName || 'You',
    arbiterId: normalizeArbiterId(roster, arbiterId),
    phase: { name: 'seats' },
    seats,
    prompt: '',
    proposals: [],
    votes: {},
    feed: [],
    messages: [],
    focus: 'table',
    targetSeatId: null,
    replyTo: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Knights who take a share. The chosen arbiter stays at 0% and leads chat.
 * BotBot is not given a share when another seat is arbiter.
 */
export function enabledKnights(state, roster) {
  const arbiterId = resolveArbiter(state, roster)?.id;
  return roster
    .filter((seat) => seat.role === 'knight' && seat.id !== arbiterId && state.seats[seat.id]?.enabled)
    .sort((a, b) => a.order - b.order);
}

export function latestProposal(state) {
  for (let index = state.proposals.length - 1; index >= 0; index -= 1) {
    const proposal = state.proposals[index];
    if (proposal && !proposal.superseded) return proposal;
  }
  return null;
}

export function tally(votes, seatIds) {
  const rows = (votes || []).filter((vote) => seatIds.includes(vote.seatId));
  const agree = rows.filter((vote) => vote.kind === 'vote' && vote.choice === 'agree').length;
  const disagree = rows.filter((vote) => vote.kind === 'vote' && vote.choice === 'disagree').length;
  const failed = rows.filter((vote) => vote.kind === 'failure').length;
  const pending = seatIds.length - agree - disagree - failed;
  let outcome = 'pending';
  if (pending <= 0) outcome = agree >= 1 && agree > disagree ? 'passed' : 'failed';
  return { agree, disagree, failed, pending, outcome };
}

export function currentTally(state, roster) {
  const proposal = latestProposal(state);
  const ids = enabledKnights(state, roster).map((seat) => seat.id);
  return tally(proposal ? state.votes[proposal.id] || [] : [], ids);
}

/** Dock shows the arbiter plus knights actually on this quest. Disabled and unused seats hide. */
export function dockSeatIds(state, roster) {
  const proposal = latestProposal(state);
  const allocated = new Set(
    (proposal?.allocations || []).filter((row) => row.percent > 0).map((row) => row.seatId),
  );
  const arbiterId = resolveArbiter(state, roster)?.id;
  return roster.filter((seat) => {
    if (seat.role === 'king') return false;
    const seatState = state.seats[seat.id];
    if (!seatState?.enabled) return false;
    if (seat.id === arbiterId) return true;
    if (seatState.joinedMidQuest) return true;
    if (!proposal) return true;
    return allocated.has(seat.id);
  }).map((seat) => seat.id);
}

export function isBusy(state) {
  if (state.phase.name === 'implementing' && state.phase.kickoff === 'running') return true;
  return Object.values(state.seats).some((seat) => (
    seat.status === 'thinking' || seat.status === 'working' || seat.status === 'waiting'
  ));
}

function seatActivity(state, roster, now) {
  return Object.values(state.seats).filter((seat) => (
    seat.status && seat.status !== 'idle' && seat.status !== 'done'
  )).map((seat) => {
    const name = seatById(seat.id, roster)?.name || seat.id;
    const elapsed = seat.since ? Math.max(0, Math.round((now - Date.parse(seat.since)) / 1000)) : 0;
    return elapsed >= 2 ? `${name} · ${seat.status} · ${elapsed}s` : `${name} · ${seat.status}`;
  }).join('   ');
}

export function stripText(state, roster, now) {
  const active = seatActivity(state, roster, now);
  if (state.phase.name === 'implementing' && state.phase.kickoff === 'running') {
    if (active) return active;
    const last = [...state.messages].reverse().find((message) => message.kind === 'status');
    return last?.text || 'Opening the quest…';
  }
  if (active) return active;
  if (state.phase.name === 'proposal' && state.phase.status === 'drafting') {
    return `${resolveArbiter(state, roster)?.name || 'BotBot'} · drafting`;
  }
  if (state.phase.name === 'voting') return 'The council is weighing the split…';
  if (state.phase.name === 'implementing') return 'Live · the council is listening';
  return '';
}

function dropEphemeralFeed(feed) {
  return (feed || []).filter((line) => !line.ephemeral);
}

function touch(state, now, patch) {
  return { ...state, ...patch, updatedAt: now };
}

export function reduce(state, action, ctx) {
  const now = ctx.now();
  switch (action.type) {
    case 'SEAT_TOGGLED': {
      const seat = seatById(action.seatId, ctx.roster);
      const current = state.seats[action.seatId];
      const phaseOk = state.phase.name === 'seats'
        || state.phase.name === 'prompt'
        || (state.phase.name === 'implementing' && state.focus === 'table');
      const arbiterId = resolveArbiter(state, ctx.roster)?.id;
      if (!seat || seat.role === 'king' || seat.id === arbiterId || !current || !phaseOk) return state;
      if (current.enabled === action.enabled) return state;
      if (!action.enabled && enabledKnights(state, ctx.roster).length <= 1) return state;
      const nextSeat = {
        ...current,
        enabled: action.enabled,
        joinedMidQuest: current.joinedMidQuest || (action.enabled && state.phase.name === 'implementing'),
        status: 'idle',
        since: null,
      };
      const messages = action.enabled && state.phase.name === 'implementing'
        ? [...state.messages, {
          id: action.messageId,
          seatId: resolveArbiter(state, ctx.roster)?.id || 'botbot',
          kind: 'status',
          text: `${seat.name} joined the quest.`,
          status: 'done',
          createdAt: now,
        }]
        : state.messages;
      return touch(state, now, {
        seats: { ...state.seats, [seat.id]: nextSeat },
        messages,
      });
    }
    case 'SEATS_CONFIRMED': {
      if (state.phase.name !== 'seats') return state;
      if (enabledKnights(state, ctx.roster).length < 1) return state;
      return touch(state, now, { phase: { name: 'prompt' } });
    }
    case 'PROMPT_CHANGED': {
      if (state.phase.name !== 'seats' && state.phase.name !== 'prompt') return state;
      if (state.prompt === action.text) return state;
      return touch(state, now, { prompt: action.text });
    }
    case 'PROMPT_SUBMITTED': {
      if (state.phase.name !== 'prompt') return state;
      const text = state.prompt.trim();
      if (!text || text.length > 8000) return state;
      if (enabledKnights(state, ctx.roster).length < 1) return state;
      return touch(state, now, {
        prompt: text,
        phase: { name: 'proposal', status: 'drafting', revision: 1 },
      });
    }
    case 'PROPOSAL_RECEIVED': {
      if (state.phase.name !== 'proposal' || state.phase.status !== 'drafting') return state;
      if (action.proposal.revision !== state.phase.revision) return state;
      return touch(state, now, {
        proposals: [...state.proposals, action.proposal],
        phase: { name: 'proposal', status: 'revealed', revision: action.proposal.revision },
        feed: dropEphemeralFeed(state.feed),
      });
    }
    case 'PROPOSAL_FAILED': {
      if (state.phase.name !== 'proposal' || state.phase.status !== 'drafting') return state;
      return touch(state, now, {
        phase: { ...state.phase, status: 'error', error: action.error },
        feed: dropEphemeralFeed(state.feed),
      });
    }
    case 'PROPOSAL_RETRY': {
      if (state.phase.name !== 'proposal' || state.phase.status !== 'error') return state;
      return touch(state, now, {
        phase: { name: 'proposal', status: 'drafting', revision: state.phase.revision },
      });
    }
    case 'REVISION_REQUESTED': {
      const current = latestProposal(state);
      const open = state.phase.name === 'proposal' && state.phase.status === 'revealed';
      const ready = state.phase.name === 'ready';
      const stalled = state.phase.name === 'voting' && state.phase.stalled;
      if ((!open && !ready && !stalled) || !current || current.revision >= 3) return state;
      return touch(state, now, {
        proposals: state.proposals.map((proposal) => (
          proposal.id === current.id ? { ...proposal, superseded: true } : proposal
        )),
        phase: {
          name: 'proposal',
          status: 'drafting',
          revision: current.revision + 1,
          note: action.note?.trim() || '',
        },
      });
    }
    case 'VOTE_CALLED': {
      if (state.phase.name !== 'proposal' || state.phase.status !== 'revealed') return state;
      const proposal = latestProposal(state);
      if (!proposal) return state;
      return touch(state, now, {
        phase: { name: 'voting', stalled: false },
        votes: { ...state.votes, [proposal.id]: state.votes[proposal.id] || [] },
      });
    }
    case 'VOTE_CAST': {
      if (state.phase.name !== 'voting') return state;
      const proposal = latestProposal(state);
      const vote = action.vote;
      if (!proposal || vote.proposalId !== proposal.id) return state;
      const ids = enabledKnights(state, ctx.roster).map((seat) => seat.id);
      if (!ids.includes(vote.seatId)) return state;
      const existing = state.votes[proposal.id] || [];
      if (existing.some((row) => row.seatId === vote.seatId)) return state;
      return touch(state, now, {
        votes: { ...state.votes, [proposal.id]: [...existing, vote] },
      });
    }
    case 'VOTES_RESOLVED': {
      if (state.phase.name !== 'voting' || state.phase.stalled) return state;
      const proposal = latestProposal(state);
      if (!proposal) return state;
      const ids = enabledKnights(state, ctx.roster).map((seat) => seat.id);
      const result = tally(state.votes[proposal.id] || [], ids);
      if (result.pending > 0) return state;
      if (result.outcome === 'passed') {
        return touch(state, now, {
          phase: { name: 'ready', via: 'vote' },
          feed: dropEphemeralFeed(state.feed),
        });
      }
      if (proposal.revision < 3) {
        return touch(state, now, {
          proposals: state.proposals.map((row) => (
            row.id === proposal.id ? { ...row, superseded: true } : row
          )),
          phase: { name: 'proposal', status: 'drafting', revision: proposal.revision + 1, note: '' },
          feed: dropEphemeralFeed(state.feed),
        });
      }
      return touch(state, now, {
        phase: { name: 'voting', stalled: true },
        feed: dropEphemeralFeed(state.feed),
      });
    }
    case 'DECREE': {
      if (state.phase.name !== 'voting' || !state.phase.stalled) return state;
      if (action.decision === 'proceed') return touch(state, now, { phase: { name: 'ready', via: 'decree' } });
      return state;
    }
    case 'IMPLEMENT': {
      if (state.phase.name !== 'ready') return state;
      return touch(state, now, {
        phase: { name: 'implementing', kickoff: 'running' },
        focus: 'chat',
        targetSeatId: null,
        replyTo: null,
      });
    }
    case 'KICKOFF_DONE': {
      if (state.phase.name !== 'implementing') return state;
      return touch(state, now, { phase: { ...state.phase, kickoff: 'done' } });
    }
    case 'FOCUS_SET': {
      if (action.focus !== 'table' && action.focus !== 'chat') return state;
      if (action.focus === 'chat' && state.phase.name !== 'implementing') return state;
      if (state.focus === action.focus) return state;
      return touch(state, now, { focus: action.focus });
    }
    case 'TARGET_SET': {
      if (state.phase.name !== 'implementing') return state;
      const arbiterId = resolveArbiter(state, ctx.roster)?.id;
      if (action.seatId && action.seatId !== arbiterId && !state.seats[action.seatId]?.enabled) return state;
      return touch(state, now, {
        targetSeatId: action.seatId || null,
        replyTo: action.replyTo || null,
      });
    }
    case 'SEND': {
      if (state.phase.name !== 'implementing' || isBusy(state)) return state;
      const text = action.text?.trim();
      if (!text) return state;
      return touch(state, now, {
        replyTo: null,
        messages: [...state.messages, {
          id: action.messageId,
          seatId: 'king',
          kind: 'chat',
          text,
          status: 'done',
          replyTo: state.replyTo,
          createdAt: now,
        }],
      });
    }
    case 'MESSAGE_APPENDED': {
      const incoming = action.message;
      const messages = incoming?.kind === 'chat'
        ? state.messages.filter((row) => !(row.ephemeral && row.seatId === incoming.seatId))
        : state.messages;
      return touch(state, now, { messages: [...messages, incoming] });
    }
    case 'MESSAGE_PATCHED': {
      let changed = false;
      const messages = state.messages.map((message) => {
        if (message.id !== action.id) return message;
        changed = true;
        return { ...message, text: action.text ?? message.text, status: action.status ?? message.status };
      });
      if (!changed) return state;
      return touch(state, now, { messages });
    }
    case 'FEED_ADD': {
      const feed = [...state.feed, {
        id: action.id,
        text: action.text,
        at: now,
        ephemeral: Boolean(action.ephemeral),
      }].slice(-40);
      return touch(state, now, { feed });
    }
    case 'SET_SEAT_STATUS': {
      const current = state.seats[action.seatId];
      if (!current) return state;
      const status = action.status;
      if (current.status === status && current.detail === (action.detail || '')) return state;
      const since = status === 'idle' || status === 'done'
        ? null
        : (current.status === status ? current.since : now);
      return touch(state, now, {
        seats: {
          ...state.seats,
          [action.seatId]: { ...current, status, since, detail: action.detail || '' },
        },
      });
    }
    case 'ARBITER_SET': {
      if (state.phase.name !== 'seats' && state.phase.name !== 'prompt') return state;
      const seat = seatById(action.seatId, ctx.roster);
      if (!seat || seat.role === 'king' || !state.seats[seat.id]) return state;
      if (state.arbiterId === seat.id) return state;
      const workers = ctx.roster.filter((item) => (
        item.role !== 'king' && item.id !== seat.id && state.seats[item.id]?.enabled
      ));
      if (workers.length < 1) return state;
      return touch(state, now, {
        arbiterId: seat.id,
        seats: {
          ...state.seats,
          [seat.id]: { ...state.seats[seat.id], enabled: true },
        },
      });
    }
    case 'SESSION_RESET':
      return createState({
        now,
        sessionId: ctx.id('sess'),
        kingName: state.kingName,
        roster: ctx.roster,
        arbiterId: ctx.arbiterId || state.arbiterId,
      });
    default:
      return state;
  }
}
