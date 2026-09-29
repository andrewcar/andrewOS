import { describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, createVault } from '../../roundtable/js/auth.js';
import { createOrchestrator } from '../../roundtable/js/orchestrator.js';
import { heartbeatLine, initialStatusLine } from '../../roundtable/js/progress.js';
import { completeLive } from '../../roundtable/js/providers.js';
import { ROSTER } from '../../roundtable/js/roster.js';
import { buildProposal, percentSplit } from '../../roundtable/js/split.js';
import {
  PROMPT_ANCHOR,
  createState,
  dockSeatIds,
  enabledKnights,
  reduce,
  stripText,
} from '../../roundtable/js/state.js';

function harness() {
  let now = '2026-01-01T00:00:00.000Z';
  let n = 0;
  const ctx = {
    now: () => now,
    id: (kind) => `${kind}_${(n += 1)}`,
    roster: ROSTER,
  };
  let state = createState({ now, sessionId: 'sess_1', kingName: 'Ada', roster: ROSTER });
  return {
    ctx,
    get state() { return state; },
    dispatch(action) { state = reduce(state, action, ctx); },
  };
}

describe('round table council', () => {
  it('keeps the prompt in the planning panel, not under the table', () => {
    expect(PROMPT_ANCHOR).toBe('planning-panel');
  });

  it('splits a job across enabled knights', () => {
    const proposal = buildProposal({
      id: 'prop_1',
      prompt: 'Design a settings page for API keys',
      knights: enabledKnights(createState({
        now: 't',
        sessionId: 's',
        kingName: 'Ada',
        roster: ROSTER,
      }), ROSTER),
    });
    const sum = proposal.allocations.reduce((total, row) => total + row.percent, 0);
    expect(sum).toBe(100);
    expect(proposal.allocations.filter((row) => row.percent > 0).length).toBeGreaterThan(1);
    expect(percentSplit([
      { seatId: 'a', weight: 1, responsibility: 'A' },
      { seatId: 'b', weight: 1, responsibility: 'B' },
      { seatId: 'c', weight: 1, responsibility: 'C' },
    ]).reduce((total, row) => total + row.percent, 0)).toBe(100);
  });

  it('walks planning into chat and hides disabled seats on the dock', () => {
    const round = harness();
    round.dispatch({ type: 'SEAT_TOGGLED', seatId: 'muse', enabled: false });
    round.dispatch({ type: 'SEATS_CONFIRMED' });
    round.dispatch({ type: 'PROMPT_CHANGED', text: 'Design a settings page' });
    round.dispatch({ type: 'PROMPT_SUBMITTED' });
    const proposal = buildProposal({
      id: 'prop_1',
      revision: 1,
      prompt: round.state.prompt,
      knights: enabledKnights(round.state, ROSTER),
    });
    round.dispatch({ type: 'PROPOSAL_RECEIVED', proposal });
    expect(round.state.focus).toBe('table');
    round.dispatch({ type: 'FOCUS_SET', focus: 'chat' });
    expect(round.state.focus).toBe('table');
    round.dispatch({ type: 'VOTE_CALLED' });
    for (const seat of enabledKnights(round.state, ROSTER)) {
      round.dispatch({
        type: 'VOTE_CAST',
        vote: { kind: 'vote', seatId: seat.id, proposalId: proposal.id, choice: 'agree', reason: 'yes' },
      });
    }
    round.dispatch({ type: 'VOTES_RESOLVED' });
    expect(round.state.phase.name).toBe('ready');
    round.dispatch({ type: 'IMPLEMENT' });
    expect(round.state.focus).toBe('chat');
    expect(dockSeatIds(round.state, ROSTER)).not.toContain('muse');
    expect(dockSeatIds(round.state, ROSTER)).toContain('codex');
    expect(dockSeatIds(round.state, ROSTER)).toContain('botbot');
    round.dispatch({ type: 'FOCUS_SET', focus: 'table' });
    round.dispatch({ type: 'SEAT_TOGGLED', seatId: 'muse', enabled: true, messageId: 'join_1' });
    expect(round.state.messages.some((message) => message.text.includes('joined the quest'))).toBe(true);
    round.dispatch({ type: 'FOCUS_SET', focus: 'chat' });
    expect(dockSeatIds(round.state, ROSTER)).toContain('muse');
  });

  it('names a wait immediately and again if it drags on', () => {
    expect(initialStatusLine('CodexBot', 'thinking')).toBe('CodexBot is thinking…');
    expect(heartbeatLine('CodexBot', 'thinking', 1000)).toBeNull();
    expect(heartbeatLine('CodexBot', 'waiting', 3000)).toMatch(/still waiting/);
    expect(heartbeatLine('CodexBot', 'working', 12000)).toMatch(/timed out/);
  });

  it('posts a drafting status before the proposal exists', async () => {
    const round = harness();
    const seen = [];
    let state = round.state;
    const orchestrator = createOrchestrator({
      getState: () => state,
      dispatch(action) {
        seen.push(action);
        state = reduce(state, action, round.ctx);
      },
      getSecrets: () => ({}),
      roster: ROSTER,
      delay: async () => {},
      now: () => '2026-01-01T00:00:00.000Z',
      id: (kind) => `${kind}_${seen.length}`,
    });
    state = reduce(state, { type: 'SEATS_CONFIRMED' }, round.ctx);
    state = reduce(state, { type: 'PROMPT_CHANGED', text: 'Design a settings page' }, round.ctx);
    state = reduce(state, { type: 'PROMPT_SUBMITTED' }, round.ctx);
    await orchestrator.after({ type: 'PROMPT_SUBMITTED' });
    const feed = seen.find((action) => action.type === 'FEED_ADD');
    const proposal = seen.find((action) => action.type === 'PROPOSAL_RECEIVED');
    expect(feed.text).toMatch(/thinking/i);
    expect(seen.indexOf(feed)).toBeLessThan(seen.indexOf(proposal));
    expect(state.phase.status).toBe('revealed');
    expect(state.feed.some((line) => /thinking/i.test(line.text))).toBe(false);
  });

  it('clears weighing lines when the vote lands and sends one message', () => {
    const round = harness();
    round.dispatch({ type: 'SEATS_CONFIRMED' });
    round.dispatch({ type: 'PROMPT_CHANGED', text: 'Design a settings page' });
    round.dispatch({ type: 'PROMPT_SUBMITTED' });
    const proposal = buildProposal({
      id: 'prop_1',
      revision: 1,
      prompt: round.state.prompt,
      knights: enabledKnights(round.state, ROSTER),
    });
    round.dispatch({ type: 'FEED_ADD', id: 'feed_think', text: 'BotBot is thinking…', ephemeral: true });
    round.dispatch({ type: 'PROPOSAL_RECEIVED', proposal });
    expect(round.state.feed.some((line) => /thinking/i.test(line.text))).toBe(false);
    round.dispatch({ type: 'VOTE_CALLED' });
    round.dispatch({ type: 'FEED_ADD', id: 'feed_vote', text: 'CodexBot is weighing the split…', ephemeral: true });
    for (const seat of enabledKnights(round.state, ROSTER)) {
      round.dispatch({
        type: 'VOTE_CAST',
        vote: { kind: 'vote', seatId: seat.id, proposalId: proposal.id, choice: 'agree', reason: 'yes' },
      });
    }
    round.dispatch({ type: 'VOTES_RESOLVED' });
    expect(round.state.phase.name).toBe('ready');
    expect(round.state.feed.some((line) => /weighing/i.test(line.text))).toBe(false);
    round.dispatch({ type: 'IMPLEMENT' });
    expect(stripText(round.state, ROSTER, Date.parse('2026-01-01T00:00:00.000Z'))).toMatch(/Opening the quest/);
    round.dispatch({ type: 'KICKOFF_DONE' });
    round.dispatch({
      type: 'MESSAGE_APPENDED',
      message: { id: 'status_1', seatId: 'codex', kind: 'status', text: 'CodexBot is thinking…', ephemeral: true, status: 'done' },
    });
    round.dispatch({
      type: 'MESSAGE_APPENDED',
      message: { id: 'chat_1', seatId: 'codex', kind: 'chat', text: 'Start with the empty state.', status: 'done' },
    });
    expect(round.state.messages.some((message) => message.id === 'status_1')).toBe(false);
    round.dispatch({ type: 'SEND', text: '  Hello there  ', messageId: 'king_1' });
    round.dispatch({ type: 'SET_SEAT_STATUS', seatId: 'codex', status: 'thinking', now: '2026-01-01T00:00:01.000Z' });
    round.dispatch({ type: 'SEND', text: 'Second', messageId: 'king_2' });
    const king = round.state.messages.filter((message) => message.seatId === 'king');
    expect(king).toHaveLength(1);
    expect(king[0].text).toBe('Hello there');
  });

  it('keeps a chosen arbiter and will not borrow another seat key', async () => {
    const round = harness();
    expect(round.state.arbiterId).toBe('botbot');
    round.dispatch({ type: 'ARBITER_SET', seatId: 'claude' });
    expect(round.state.arbiterId).toBe('claude');
    expect(enabledKnights(round.state, ROSTER).map((seat) => seat.id)).not.toContain('claude');
    expect(enabledKnights(round.state, ROSTER).map((seat) => seat.id)).toContain('botbot');
    round.dispatch({ type: 'SEAT_TOGGLED', seatId: 'claude', enabled: false });
    expect(round.state.seats.claude.enabled).toBe(true);
    round.ctx.arbiterId = 'claude';
    round.dispatch({ type: 'SESSION_RESET' });
    expect(round.state.phase.name).toBe('seats');
    expect(round.state.arbiterId).toBe('claude');

    let state = round.state;
    let n = 0;
    const calls = [];
    const orchestrator = createOrchestrator({
      getState: () => state,
      dispatch(action) { state = reduce(state, action, round.ctx); },
      getSecrets: () => ({ arbiter: 'sk-bot-only' }),
      roster: ROSTER,
      delay: async () => {},
      now: () => '2026-01-01T00:00:00.000Z',
      id: (kind) => `${kind}_${(n += 1)}`,
      complete: async (request) => {
        calls.push(request);
        throw new Error('should not call a provider');
      },
    });
    state = reduce(state, { type: 'SEATS_CONFIRMED' }, round.ctx);
    state = reduce(state, { type: 'PROMPT_CHANGED', text: 'Design a settings page' }, round.ctx);
    state = reduce(state, { type: 'PROMPT_SUBMITTED' }, round.ctx);
    expect(stripText(state, ROSTER, Date.parse('2026-01-01T00:00:00.000Z'))).toMatch(/ClaudeBot · drafting/);
    await orchestrator.after({ type: 'PROMPT_SUBMITTED' });
    expect(calls).toHaveLength(0);
    expect(state.feed.some((line) => /ClaudeBot has no API key/i.test(line.text))).toBe(true);
    expect(state.proposals.at(-1).source).toBe('preview');
    expect(state.proposals.at(-1).allocations.some((row) => row.seatId === 'claude')).toBe(false);
    expect(dockSeatIds(state, ROSTER)).toContain('claude');

    const live = [];
    const liveOrchestrator = createOrchestrator({
      getState: () => state,
      dispatch(action) { state = reduce(state, action, round.ctx); },
      getSecrets: () => ({ anthropic: 'sk-claude' }),
      roster: ROSTER,
      delay: async () => {},
      now: () => '2026-01-01T00:00:00.000Z',
      id: (kind) => `${kind}_live_${(n += 1)}`,
      complete: async (request) => {
        live.push(request);
        return {
          ok: true,
          text: JSON.stringify({
            approach: 'ClaudeBot leads the cut',
            allocations: enabledKnights(state, ROSTER).map((seat) => ({
              seatId: seat.id,
              percent: 20,
              responsibility: 'A share',
            })),
          }),
        };
      },
    });
    state = reduce(state, { type: 'REVISION_REQUESTED', note: 'Try Claude live' }, round.ctx);
    await liveOrchestrator.after({ type: 'REVISION_REQUESTED' });
    expect(live.map((request) => request.providerId)).toEqual(['anthropic']);
    expect(live[0].apiKey).toBe('sk-claude');
    expect(live[0].system).toMatch(/ClaudeBot/);
    expect(state.proposals.at(-1).source).toBe('live');
    state = reduce(state, { type: 'VOTE_CALLED' }, round.ctx);
    await liveOrchestrator.after({ type: 'VOTE_CALLED' });
    expect(state.feed.some((line) => line.text === 'ClaudeBot is opening the vote.')).toBe(true);
    expect(state.phase.name).toBe('ready');
    state = reduce(state, { type: 'IMPLEMENT' }, round.ctx);
    await liveOrchestrator.after({ type: 'IMPLEMENT' });
    expect(state.messages.some((message) => message.seatId === 'claude' && /Plan approved/.test(message.text))).toBe(true);
    expect(state.messages.some((message) => message.seatId === 'claude' && /Handing off/.test(message.text))).toBe(true);
  });
});

describe('round table accounts', () => {
  it('stores provider keys as ciphertext', async () => {
    const storage = createMemoryStorage();
    const session = createMemoryStorage();
    const vault = createVault({ storage, session, iterations: 1200 });
    const created = await vault.signUp({
      email: 'Ada@Example.com',
      password: 'correct-horse',
      name: 'Ada',
    });
    await vault.saveSecrets(created.account.id, created.aesKey, { openai: 'sk-test-secret' });
    const dump = JSON.stringify(storage.dump());
    expect(dump).not.toContain('sk-test-secret');
    expect(dump).not.toContain('correct-horse');
    const signedIn = await vault.signIn({ email: 'ada@example.com', password: 'correct-horse' });
    expect(signedIn.secrets.openai).toBe('sk-test-secret');
    await expect(vault.signIn({ email: 'ada@example.com', password: 'wrong-password' })).rejects.toThrow(/wrong password/i);
  });
});

describe('provider calls', () => {
  it('redacts keys and does not log them', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'unauthorized sk-test-secret',
    }));
    const result = await completeLive({
      providerId: 'openai',
      apiKey: 'sk-test-secret',
      system: 'Be brief.',
      user: 'Hello',
      fetchImpl,
    });
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain('sk-test-secret');
    expect(fetchImpl).toHaveBeenCalledOnce();
    const blocked = await completeLive({
      providerId: 'meta',
      apiKey: 'muse-secret',
      system: 's',
      user: 'u',
      fetchImpl,
    });
    expect(blocked.code).toBe('no-relay');
    expect(blocked.message).not.toContain('muse-secret');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(spy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    spy.mockRestore();
    errorSpy.mockRestore();
  });
});
