import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handleRequest } from '../../workers/rt/src/router.js';
import { createMemoryStore } from '../../workers/rt/src/store.js';
import { mcpToolDefinitions } from '../../workers/rt/src/mcp-tools.js';
import worker from '../../workers/rt/src/index.js';

const SECRET = 'test-session-secret-32chars!!';
const ACCEPT = 'application/json, text/event-stream';

function testEnv(overrides = {}) {
  return {
    RT_SESSION_SECRET: SECRET,
    __store: createMemoryStore(),
    ...overrides,
  };
}

async function mcp(env, body, {
  method = 'POST',
  path = '/rt/v1/mcp',
  token,
  protocol,
  accept = ACCEPT,
  origin,
  host = 'roundtable.lol',
  fetchImpl,
} = {}) {
  const headers = {};
  if (accept != null) headers.accept = accept;
  if (method !== 'GET' && method !== 'DELETE') headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (protocol) headers['mcp-protocol-version'] = protocol;
  if (origin) headers.origin = origin;
  const request = new Request(`https://${host}${path}`, {
    method,
    headers,
    body: body != null && method !== 'GET' && method !== 'DELETE' ? JSON.stringify(body) : undefined,
  });
  const response = await handleRequest(request, env, { fetchImpl });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: response.status, json, text, headers: response.headers };
}

function rpc(method, params, id = 1) {
  return { jsonrpc: '2.0', id, method, params };
}

describe('rt mcp transport', () => {
  it('initializes over Streamable HTTP and lists tools', async () => {
    const env = testEnv();
    const init = await mcp(env, rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'grok', version: '1.0.0' },
    }));
    expect(init.status).toBe(200);
    expect(init.json.result.protocolVersion).toBe('2025-06-18');
    expect(init.json.result.serverInfo.name).toBe('round-table');
    expect(init.json.result.capabilities.tools).toBeTruthy();
    expect(init.json.result.instructions).not.toMatch(/grok bot|botbot|___bot/i);
    expect(init.headers.get('mcp-session-id')).toBeNull();

    const noted = await mcp(env, { jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(noted.status).toBe(202);

    const listed = await mcp(env, rpc('tools/list', {}), { protocol: '2025-06-18' });
    expect(listed.status).toBe(200);
    const names = listed.json.result.tools.map((tool) => tool.name);
    expect(names).toEqual([
      'rt_health',
      'rt_roster',
      'rt_open_session',
      'rt_set_secrets',
      'rt_start_quest',
      'rt_quest_status',
    ]);
    expect(names).not.toContain('rt_set_arbiter_webhook');
    const blob = JSON.stringify(listed.json.result.tools);
    expect(blob).not.toMatch(/Grok Bot|BotBot|___Bot|CodexBot|ClaudeBot/);
  });

  it('negotiates the older protocol version and rejects an unknown header', async () => {
    const env = testEnv();
    const older = await mcp(env, rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {} }));
    expect(older.json.result.protocolVersion).toBe('2025-03-26');
    const bad = await mcp(env, rpc('ping', {}), { protocol: '1999-01-01' });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toBe('unsupported_protocol_version');
  });

  it('requires an Accept header, refuses batches, and does not open SSE', async () => {
    const env = testEnv();
    const missing = await mcp(env, rpc('ping', {}), { accept: null });
    expect(missing.status).toBe(406);
    const batch = await mcp(env, [rpc('ping', {})]);
    expect(batch.status).toBe(400);
    const got = await mcp(env, null, { method: 'GET', accept: 'text/event-stream' });
    expect(got.status).toBe(405);
    const removed = await mcp(env, null, { method: 'DELETE' });
    expect(removed.status).toBe(405);
  });

  it('blocks a foreign browser origin when the host is local', async () => {
    const env = testEnv();
    const blocked = await mcp(env, rpc('ping', {}), {
      host: '127.0.0.1',
      origin: 'https://evil.example',
    });
    expect(blocked.status).toBe(403);
    const allowed = await mcp(env, rpc('ping', {}), {
      host: '127.0.0.1',
      origin: 'http://127.0.0.1:8787',
    });
    expect(allowed.status).toBe(200);
  });

  it('serves the same tools on /mcp for roundtable.lol and rt.andrewos.com', async () => {
    const env = testEnv();
    for (const host of ['roundtable.lol', 'rt.andrewos.com']) {
      const listed = await mcp(env, rpc('tools/list', {}), { path: '/mcp', host });
      expect(listed.status, host).toBe(200);
      expect(listed.json.result.tools.map((tool) => tool.name)).toContain('rt_roster');
    }
  });
});

describe('rt mcp tools', () => {
  it('calls health and roster without a session', async () => {
    const env = testEnv();
    const health = await mcp(env, rpc('tools/call', { name: 'rt_health', arguments: {} }));
    expect(health.json.result.isError).toBe(false);
    const healthBody = JSON.parse(health.json.result.content[0].text);
    expect(healthBody.ok).toBe(true);
    expect(healthBody.honesty).not.toMatch(/botbot|grok bot/i);

    const roster = await mcp(env, rpc('tools/call', { name: 'rt_roster', arguments: {} }, 2));
    const seats = JSON.parse(roster.json.result.content[0].text).seats;
    expect(seats.map((seat) => seat.name)).toEqual([
      'Grok (API)',
      'Codex',
      'Claude',
      'Gemini',
      'Muse',
      'DeepSeek',
    ]);
  });

  it('mints a session, previews a quest, and reads it back', async () => {
    const env = testEnv();
    const opened = await mcp(env, rpc('tools/call', {
      name: 'rt_open_session',
      arguments: { ttlSeconds: 120 },
    }));
    const session = JSON.parse(opened.json.result.content[0].text);
    expect(session.accessToken).toBeTruthy();
    expect(session.expiresInMs).toBe(120_000);
    expect(opened.json.result.content[0].text).not.toMatch(/sk-|xai-/);

    const started = await mcp(env, rpc('tools/call', {
      name: 'rt_start_quest',
      arguments: {
        goal: 'Compare API designs for a settings page',
        accessToken: session.accessToken,
      },
    }, 3));
    expect(started.json.result.isError).toBe(false);
    const quest = JSON.parse(started.json.result.content[0].text).quest;
    expect(quest.source).toBe('preview');
    expect(quest.id).toMatch(/^quest_/);
    expect(started.text).not.toContain(session.accessToken);

    const status = await mcp(env, rpc('tools/call', {
      name: 'rt_quest_status',
      arguments: { id: quest.id },
    }, 4), { token: session.accessToken });
    const again = JSON.parse(status.json.result.content[0].text).quest;
    expect(again.id).toBe(quest.id);
    expect(again.proposal.allocations.length).toBeGreaterThan(0);
  });

  it('refuses quests without a session and never echoes stored keys', async () => {
    const env = testEnv();
    const denied = await mcp(env, rpc('tools/call', {
      name: 'rt_start_quest',
      arguments: { goal: 'no session' },
    }));
    expect(denied.json.result.isError).toBe(true);
    expect(denied.json.result.content[0].text).toMatch(/unauthorized/);

    const opened = await mcp(env, rpc('tools/call', { name: 'rt_open_session', arguments: {} }, 2));
    const token = JSON.parse(opened.json.result.content[0].text).accessToken;
    const secret = 'super-secret-provider-key';
    const stored = await mcp(env, rpc('tools/call', {
      name: 'rt_set_secrets',
      arguments: { keys: { arbiter: secret, openai: 'sk-test-value' } },
    }, 3), { token });
    expect(stored.json.result.isError).toBe(false);
    expect(stored.text).not.toContain(secret);
    expect(stored.text).not.toContain('sk-test-value');
    const summary = JSON.parse(stored.json.result.content[0].text);
    expect(summary.providers).toEqual(['arbiter', 'openai']);
  });

  it('hides the arbiter webhook tool until the flag is on', () => {
    expect(mcpToolDefinitions(testEnv()).map((tool) => tool.name)).not.toContain('rt_set_arbiter_webhook');
    const enabled = mcpToolDefinitions(testEnv({ RT_ARBITER_WEBHOOK: '1' }));
    expect(enabled.map((tool) => tool.name)).toContain('rt_set_arbiter_webhook');
  });
});

describe('rt public hosts', () => {
  it('routes /mcp through the Worker on both public hosts', async () => {
    const env = testEnv();
    for (const host of ['https://roundtable.lol', 'https://rt.andrewos.com']) {
      const response = await worker.fetch(new Request(`${host}/mcp`, {
        method: 'POST',
        headers: { accept: ACCEPT, 'content-type': 'application/json' },
        body: JSON.stringify(rpc('ping', {})),
      }), env, {});
      expect(response.status, host).toBe(200);
      const json = await response.json();
      expect(json.result).toEqual({});
    }
  });

  it('delegates the icon to static assets on both public hosts', async () => {
    const seen = [];
    const env = {
      RT_SESSION_SECRET: SECRET,
      ASSETS: {
        async fetch(request) {
          seen.push(`${new URL(request.url).host}${new URL(request.url).pathname}`);
          return new Response('<svg></svg>', {
            status: 200,
            headers: { 'content-type': 'image/svg+xml' },
          });
        },
      },
    };
    for (const host of ['https://roundtable.lol', 'https://rt.andrewos.com']) {
      const response = await worker.fetch(new Request(`${host}/favicon.svg`), env, {});
      expect(response.status, host).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/svg/);
    }
    expect(seen).toEqual([
      'roundtable.lol/favicon.svg',
      'rt.andrewos.com/favicon.svg',
    ]);
  });

  it('does not declare an andrewos.com/rt route', () => {
    const toml = readFileSync('workers/rt/wrangler.toml', 'utf8');
    const patterns = toml.split('\n').filter((line) => /pattern\s*=/.test(line));
    expect(patterns.join('\n')).not.toMatch(/andrewos\.com\/rt/);
    expect(patterns.some((line) => line.includes('rt.andrewos.com'))).toBe(true);
    expect(patterns.some((line) => line.includes('roundtable.lol'))).toBe(true);
    expect(toml).not.toMatch(/RT_ARBITER_WEBHOOK\s*=\s*["']1["']/);
  });
});
