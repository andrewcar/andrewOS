import { describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../../workers/rt/src/router.js';
import { createMemoryStore } from '../../workers/rt/src/store.js';
import { mintSession, verifySessionToken } from '../../workers/rt/src/session.js';
import { publicRoster, CONNECTOR_ROSTER } from '../../workers/rt/src/roster.js';
import { buildProposal } from '../../workers/rt/src/split.js';
import { shapeProxyRequest, buildOpenAiChatRequest, parseOpenAiChatResponse, proxyChat } from '../../workers/rt/src/proxy.js';
import { normalizeSecretMap, putSecrets, getSecrets } from '../../workers/rt/src/secrets.js';
import { knights } from '../../workers/rt/src/roster.js';

const SECRET = 'test-session-secret-32chars!!';

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
  const request = new Request(`http://rt.test${path}`, {
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
  return { status: response.status, json };
}

describe('rt roster', () => {
  it('returns product display names without fleet ___Bot branding', () => {
    const seats = publicRoster();
    expect(seats.map((s) => s.id)).toEqual([
      'botbot',
      'codex',
      'claude',
      'gemini',
      'muse',
      'deepseek',
    ]);
    expect(seats.map((s) => s.name)).toEqual([
      'Grok (API)',
      'Codex',
      'Claude',
      'Gemini',
      'Muse',
      'DeepSeek',
    ]);
    for (const seat of seats) {
      expect(seat.name).not.toMatch(/Bot$/);
      expect(seat.name).not.toBe('BotBot');
      expect(seat).toHaveProperty('providerId');
      expect(seat).not.toHaveProperty('apiKey');
    }
  });

  it('GET /rt/v1/roster matches public shape', async () => {
    const { status, json } = await call(testEnv(), 'GET', '/rt/v1/roster');
    expect(status).toBe(200);
    expect(json.seats).toEqual(publicRoster());
  });
});

describe('rt session mint/verify', () => {
  it('mints and verifies a bearer session', async () => {
    const env = testEnv();
    const minted = await mintSession(env, { store: env.__store });
    expect(minted.token).toContain('.');
    expect(minted.sessionId).toMatch(/^sess_/);
    const verified = await verifySessionToken(env, minted.token);
    expect(verified.ok).toBe(true);
    expect(verified.sessionId).toBe(minted.sessionId);
  });

  it('rejects tampered and expired tokens', async () => {
    const env = testEnv();
    const minted = await mintSession(env, { ttlMs: 1000, now: 1_000_000 });
    const bad = await verifySessionToken(env, minted.token.replace(/\.$/, '.AAAA'));
    expect(bad.ok).toBe(false);
    const expired = await verifySessionToken(env, minted.token, { now: 1_000_000 + 5_000 });
    expect(expired.ok).toBe(false);
    expect(expired.error).toBe('expired');
  });

  it('POST /rt/v1/sessions returns a bearer token', async () => {
    const { status, json } = await call(testEnv(), 'POST', '/rt/v1/sessions');
    expect(status).toBe(201);
    expect(json.accessToken).toBeTruthy();
    expect(json.tokenType).toBe('Bearer');
    expect(json.sessionId).toMatch(/^sess_/);
  });
});

describe('rt secrets', () => {
  it('normalizes provider key maps and rejects unknown providers', () => {
    expect(normalizeSecretMap({ arbiter: 'xai-key', openai: 'sk' }).ok).toBe(true);
    expect(normalizeSecretMap({ fleet: 'nope' }).ok).toBe(false);
  });

  it('encrypts at rest and never echoes values on PUT', async () => {
    const env = testEnv();
    const session = await mintSession(env, { store: env.__store });
    const { status, json } = await call(env, 'PUT', '/rt/v1/secrets', {
      token: session.token,
      body: { keys: { arbiter: 'super-secret-xai-key', openai: 'sk-test' } },
    });
    expect(status).toBe(200);
    expect(json.providers).toEqual(['arbiter', 'openai']);
    expect(JSON.stringify(json)).not.toContain('super-secret');
    expect(JSON.stringify(json)).not.toContain('sk-test');

    const stored = await env.__store.get(`rt:secrets:${session.sessionId}`);
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('super-secret-xai-key');

    const loaded = await getSecrets(env, env.__store, session.sessionId);
    expect(loaded.arbiter).toBe('super-secret-xai-key');
    expect(loaded.openai).toBe('sk-test');
  });
});

describe('rt quest preview', () => {
  it('buildProposal produces a 100% split', () => {
    const proposal = buildProposal({
      id: 'prop_1',
      prompt: 'Design a settings page for API keys and backend auth',
      knights: knights(CONNECTOR_ROSTER),
    });
    const sum = proposal.allocations.reduce((t, row) => t + row.percent, 0);
    expect(sum).toBe(100);
    expect(proposal.source).toBe('preview');
  });

  it('POST /rt/v1/quests creates a preview quest without keys', async () => {
    const env = testEnv();
    const session = await mintSession(env, { store: env.__store });
    const { status, json } = await call(env, 'POST', '/rt/v1/quests', {
      token: session.token,
      body: { goal: 'Ship a research report comparing API designs' },
    });
    expect(status).toBe(201);
    expect(json.quest.id).toMatch(/^quest_/);
    expect(json.quest.status).toBe('proposed');
    expect(json.quest.source).toBe('preview');
    expect(json.quest.proposal.allocations.length).toBeGreaterThan(0);
    const sum = json.quest.proposal.allocations.reduce((t, row) => t + row.percent, 0);
    expect(sum).toBe(100);

    const got = await call(env, 'GET', `/rt/v1/quests/${json.quest.id}`, {
      token: session.token,
    });
    expect(got.status).toBe(200);
    expect(got.json.quest.id).toBe(json.quest.id);
    expect(got.json.quest.messages.length).toBeGreaterThan(0);
  });

  it('requires auth for quests', async () => {
    const { status } = await call(testEnv(), 'POST', '/rt/v1/quests', {
      body: { goal: 'x' },
    });
    expect(status).toBe(401);
  });
});

describe('rt proxy request shaping + mocked upstream', () => {
  it('shapes xAI and OpenAI-compatible requests', () => {
    const xai = shapeProxyRequest('arbiter', {
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(xai.ok).toBe(true);
    expect(xai.url).toBe('https://api.x.ai/v1/chat/completions');
    expect(xai.body.model).toBe('grok-4.3');
    expect(xai.body.messages[0].content).toBe('hi');

    const oai = shapeProxyRequest('openai', {
      messages: [{ role: 'user', content: 'yo' }],
      model: 'gpt-4o-mini',
    });
    expect(oai.ok).toBe(true);
    expect(oai.url).toContain('api.openai.com');

    const body = buildOpenAiChatRequest({
      model: 'grok-4.3',
      messages: [{ role: 'user', content: 'a' }],
    });
    expect(parseOpenAiChatResponse({
      choices: [{ message: { content: '  hello  ' } }],
    })).toBe('hello');
    expect(body.model).toBe('grok-4.3');
  });

  it('returns 501 for Anthropic / Google / Muse', () => {
    expect(shapeProxyRequest('anthropic', { messages: [{ role: 'user', content: 'x' }] }).status).toBe(501);
    expect(shapeProxyRequest('google', { messages: [{ role: 'user', content: 'x' }] }).status).toBe(501);
    expect(shapeProxyRequest('meta', { messages: [{ role: 'user', content: 'x' }] }).status).toBe(501);
  });

  it('proxyChat calls xAI with the session key (mocked fetch)', async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(url).toBe('https://api.x.ai/v1/chat/completions');
      const headers = init.headers;
      expect(headers.authorization).toBe('Bearer xai-test-key');
      const body = JSON.parse(init.body);
      expect(body.model).toBe('grok-4.3');
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'council ready' } }],
        usage: { total_tokens: 12 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const result = await proxyChat({
      providerId: 'arbiter',
      apiKey: 'xai-test-key',
      messages: [{ role: 'user', content: 'ping' }],
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(result.text).toBe('council ready');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('POST /rt/v1/proxy/chat uses stored key and mocks upstream', async () => {
    const env = testEnv();
    const session = await mintSession(env, { store: env.__store });
    await putSecrets(env, env.__store, session.sessionId, { arbiter: 'xai-live-key' });

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'from xAI' } }],
    }), { status: 200 }));

    const { status, json } = await call(env, 'POST', '/rt/v1/proxy/chat', {
      token: session.token,
      body: {
        providerId: 'arbiter',
        messages: [{ role: 'user', content: 'status?' }],
      },
      fetchImpl,
    });
    expect(status).toBe(200);
    expect(json.text).toBe('from xAI');
    expect(json.providerId).toBe('arbiter');
    expect(JSON.stringify(json)).not.toContain('xai-live-key');
  });

  it('POST /rt/v1/proxy/chat returns 501 for anthropic', async () => {
    const env = testEnv();
    const session = await mintSession(env, { store: env.__store });
    const { status, json } = await call(env, 'POST', '/rt/v1/proxy/chat', {
      token: session.token,
      body: {
        providerId: 'anthropic',
        messages: [{ role: 'user', content: 'hi' }],
      },
    });
    expect(status).toBe(501);
    expect(json.error).toMatch(/Anthropic/i);
  });

  it('live quest path uses arbiter key when present (mocked)', async () => {
    const env = testEnv();
    const session = await mintSession(env, { store: env.__store });
    await putSecrets(env, env.__store, session.sessionId, { arbiter: 'xai-key' });

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
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
    }), { status: 200 }));

    const { status, json } = await call(env, 'POST', '/rt/v1/quests', {
      token: session.token,
      body: { goal: 'Build an API and polish the settings UI' },
      fetchImpl,
    });
    expect(status).toBe(201);
    expect(json.quest.source).toBe('live');
    expect(json.quest.proposal.source).toBe('live');
    expect(fetchImpl).toHaveBeenCalled();
  });
});

describe('rt health', () => {
  it('GET /rt/v1/health is honest about API seats', async () => {
    const { status, json } = await call(testEnv(), 'GET', '/rt/v1/health');
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.honesty).toMatch(/does not make them fleet/i);
    expect(json.honesty).not.toMatch(/___Bot/);
  });
});
