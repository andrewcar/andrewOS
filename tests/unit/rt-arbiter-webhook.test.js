import { describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../../workers/rt/src/router.js';
import { createMemoryStore } from '../../workers/rt/src/store.js';
import { validateWebhookUrl } from '../../workers/rt/src/arbiter-webhook.js';

const SECRET = 'test-session-secret-32chars!!';
const PLANTED_KEY = 'super-secret-provider-key';

function testEnv(overrides = {}) {
  return {
    RT_SESSION_SECRET: SECRET,
    __store: createMemoryStore(),
    ...overrides,
  };
}

async function call(env, method, path, { body, token, fetchImpl } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const request = new Request(`https://roundtable.lol${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const response = await handleRequest(request, env, { fetchImpl });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: response.status, json, text };
}

async function session(env) {
  const opened = await call(env, 'POST', '/rt/v1/sessions', { body: {} });
  return opened.json.accessToken;
}

describe('arbiter webhook flag', () => {
  it('rejects private and non-https webhook URLs', () => {
    expect(validateWebhookUrl('https://hooks.example.com/round-table').ok).toBe(true);
    for (const url of [
      'http://hooks.example.com/hook',
      'https://user:pass@hooks.example.com/hook',
      'https://127.0.0.1/hook',
      'https://10.1.1.1/hook',
      'https://192.168.1.9/hook',
      'https://localhost/hook',
      'https://metadata.google.internal/hook',
      'https://169.254.169.254/latest',
      'not a url',
    ]) {
      expect(validateWebhookUrl(url).ok, url).toBe(false);
    }
  });

  it('stays off by default and does not call a webhook', async () => {
    const env = testEnv();
    const token = await session(env);
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 200 }));

    const registered = await call(env, 'PUT', '/rt/v1/arbiter-webhook', {
      token,
      body: { url: 'https://hooks.example.com/rt' },
      fetchImpl,
    });
    expect(registered.status).toBe(403);
    expect(registered.json.error).toBe('arbiter_webhook_disabled');

    const quest = await call(env, 'POST', '/rt/v1/quests', {
      token,
      body: {
        goal: 'Ship the settings page',
        arbiterWebhook: { url: 'https://hooks.example.com/rt' },
      },
      fetchImpl,
    });
    expect(quest.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();

    const plain = await call(env, 'POST', '/rt/v1/quests', {
      token,
      body: { goal: 'Ship the settings page' },
      fetchImpl,
    });
    expect(plain.status).toBe(201);
    expect(plain.json.quest.source).toBe('preview');
    expect(plain.json.quest.arbiterWebhook).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();

    const callback = await call(env, 'POST', `/rt/v1/quests/${plain.json.quest.id}/arbiter`, {
      token,
      body: { text: 'take the preview' },
      fetchImpl,
    });
    expect(callback.status).toBe(403);
  });

  it('delivers an arbiter turn and accepts the callback when enabled', async () => {
    const env = testEnv({ RT_ARBITER_WEBHOOK: 'true' });
    const token = await session(env);
    await call(env, 'PUT', '/rt/v1/secrets', {
      token,
      body: { keys: { arbiter: PLANTED_KEY } },
    });

    let outbound;
    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).includes('hooks.example.com')) {
        outbound = { url, body: init.body, redirect: init.redirect };
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              approach: 'Live split',
              allocations: [
                { seatId: 'codex', percent: 40, responsibility: 'API' },
                { seatId: 'claude', percent: 30, responsibility: 'UX' },
                { seatId: 'gemini', percent: 15, responsibility: 'Research' },
                { seatId: 'muse', percent: 10, responsibility: 'Copy' },
                { seatId: 'deepseek', percent: 5, responsibility: 'Review' },
              ],
            }),
          },
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const created = await call(env, 'POST', '/rt/v1/quests', {
      token,
      body: {
        goal: 'Design the settings page',
        arbiterWebhook: { url: 'https://hooks.example.com/round-table' },
      },
      fetchImpl,
    });
    expect(created.status).toBe(201);
    expect(created.json.quest.source).toBe('live');
    expect(created.json.quest.arbiterWebhook.status).toBe('delivered');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(outbound.url).toBe('https://hooks.example.com/round-table');
    expect(outbound.redirect).toBe('manual');
    const payload = JSON.parse(outbound.body);
    expect(payload.event).toBe('arbiter_turn');
    expect(payload.questId).toBe(created.json.quest.id);
    expect(payload.goal).toBe('Design the settings page');
    expect(payload.seats.map((seat) => seat.name)).toContain('Claude');
    expect(payload.callback.url).toBe(`https://roundtable.lol/rt/v1/quests/${created.json.quest.id}/arbiter`);
    expect(payload.callback.authorization.startsWith('Bearer ')).toBe(true);
    expect(outbound.body).not.toContain(PLANTED_KEY);
    expect(created.text).not.toContain(payload.callback.authorization.slice('Bearer '.length));
    expect(created.text).not.toContain(PLANTED_KEY);

    const callbackToken = payload.callback.authorization.slice('Bearer '.length);
    const posted = await call(env, 'POST', `/rt/v1/quests/${created.json.quest.id}/arbiter`, {
      token: callbackToken,
      body: {
        approach: 'Claude leads the UI',
        text: 'Use the preview as a starting point.',
        allocations: [
          { seatId: 'claude', percent: 50, responsibility: 'UI' },
          { seatId: 'codex', percent: 30, responsibility: 'API' },
          { seatId: 'gemini', percent: 20, responsibility: 'Research' },
        ],
      },
    });
    expect(posted.status).toBe(200);
    expect(posted.json.quest.arbiterDecision.approach).toBe('Claude leads the UI');
    expect(posted.json.quest.proposal.source).toBe('webhook');
    expect(posted.json.quest.source).toBe('webhook');
    const sum = posted.json.quest.proposal.allocations.reduce((total, row) => total + row.percent, 0);
    expect(sum).toBe(100);
    expect(posted.text).not.toContain(PLANTED_KEY);
    expect(posted.text).not.toContain(callbackToken);

    const read = await call(env, 'GET', `/rt/v1/quests/${created.json.quest.id}`, { token });
    expect(read.json.quest.arbiterDecision.text).toMatch(/preview/);
  });

  it('uses a session-level webhook and blocks redirects', async () => {
    const env = testEnv({ RT_ARBITER_WEBHOOK: '1' });
    const token = await session(env);
    const saved = await call(env, 'PUT', '/rt/v1/arbiter-webhook', {
      token,
      body: { url: 'https://hooks.example.com/session' },
    });
    expect(saved.status).toBe(200);
    expect(saved.json.url).toBe('https://hooks.example.com/session');

    const fetchImpl = vi.fn(async () => new Response('', {
      status: 302,
      headers: { location: 'https://127.0.0.1/internal' },
    }));
    const created = await call(env, 'POST', '/rt/v1/quests', {
      token,
      body: { goal: 'Keep the redirect from being followed' },
      fetchImpl,
    });
    expect(created.status).toBe(201);
    expect(created.json.quest.source).toBe('preview');
    expect(created.json.quest.arbiterWebhook).toEqual({
      status: 'failed',
      error: 'redirect_blocked',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe('https://hooks.example.com/session');
  });

  it('does not let another session post a decision', async () => {
    const env = testEnv({ RT_ARBITER_WEBHOOK: 'true' });
    const owner = await session(env);
    const other = await session(env);
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 }));
    const created = await call(env, 'POST', '/rt/v1/quests', {
      token: owner,
      body: {
        goal: 'Owner only',
        arbiterWebhook: 'https://hooks.example.com/owner',
      },
      fetchImpl,
    });
    const denied = await call(env, 'POST', `/rt/v1/quests/${created.json.quest.id}/arbiter`, {
      token: other,
      body: { text: 'not my quest' },
    });
    expect(denied.status).toBe(404);

    const allowed = await call(env, 'POST', `/rt/v1/quests/${created.json.quest.id}/arbiter`, {
      token: owner,
      body: { text: 'owner decision' },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.json.quest.arbiterDecision.text).toBe('owner decision');
  });
});
