/**
 * Round Table connector HTTP API — /rt/v1/*
 */

import { json, noContent, readJson, matchPath } from './http.js';
import { publicRoster } from './roster.js';
import { mintSession, verifySessionToken, bearerFromRequest } from './session.js';
import { normalizeSecretMap, putSecrets, getSecrets, secretSummary } from './secrets.js';
import { createQuest, getQuest, publicQuest } from './quests.js';
import { proxyChat, shapeProxyRequest } from './proxy.js';
import { createMemoryStore, createKvStore } from './store.js';

export const API_PREFIX = '/rt/v1';

function getStore(env) {
  if (env?.__store) return env.__store;
  if (env?.RT_KV) return createKvStore(env.RT_KV);
  if (!env.__fallbackStore) env.__fallbackStore = createMemoryStore();
  return env.__fallbackStore;
}

async function requireAuth(request, env) {
  const token = bearerFromRequest(request);
  const verified = await verifySessionToken(env, token);
  if (!verified.ok) {
    return { ok: false, response: json(401, { error: 'unauthorized', reason: verified.error }) };
  }
  return { ok: true, sessionId: verified.sessionId };
}

/**
 * @param {Request} request
 * @param {object} env
 * @param {{ fetchImpl?: typeof fetch }} [deps]
 */
export async function handleRequest(request, env, deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Allow mounting at root or under a host that already strips a prefix.
  if (pathname === '/' || pathname === '') {
    pathname = `${API_PREFIX}/health`;
  }

  if (request.method === 'OPTIONS') {
    return noContent();
  }

  // GET /rt/v1/health
  if (request.method === 'GET' && matchPath(pathname, `${API_PREFIX}/health`)) {
    return json(200, {
      ok: true,
      service: 'round-table-connector',
      version: 1,
      honesty:
        'API seats use caller-provided provider keys (Grok (API), Codex, Claude, Gemini, Muse, DeepSeek). Storing or proxying keys does not make them fleet bots or BotBot.',
    });
  }

  // GET /rt/v1/roster
  if (request.method === 'GET' && matchPath(pathname, `${API_PREFIX}/roster`)) {
    return json(200, {
      seats: publicRoster(),
      note: 'Display names are public product names. Seat ids are stable internal ids.',
    });
  }

  // POST /rt/v1/sessions
  if (request.method === 'POST' && matchPath(pathname, `${API_PREFIX}/sessions`)) {
    try {
      const store = getStore(env);
      const session = await mintSession(env, { store });
      return json(201, {
        accessToken: session.token,
        tokenType: 'Bearer',
        expiresAt: session.expiresAt,
        expiresInMs: session.expiresInMs,
        sessionId: session.sessionId,
        note: 'Connector session only — not fleet identity. Pass Authorization: Bearer <token> on later calls.',
      });
    } catch (error) {
      return json(500, { error: error.message || 'session_mint_failed' });
    }
  }

  // PUT /rt/v1/secrets
  if (request.method === 'PUT' && matchPath(pathname, `${API_PREFIX}/secrets`)) {
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;
    let body;
    try {
      body = await readJson(request);
    } catch {
      return json(400, { error: 'invalid JSON body' });
    }
    // Accept either { keys: { ... } } or a flat provider map.
    const map = body.keys && typeof body.keys === 'object' ? body.keys : body;
    const normalized = normalizeSecretMap(map);
    if (!normalized.ok) return json(400, { error: normalized.error });
    const store = getStore(env);
    const result = await putSecrets(env, store, auth.sessionId, normalized.keys);
    return json(200, {
      ok: true,
      ...secretSummary(Object.fromEntries(result.stored.map((id) => [id, true]))),
      note: 'Provider keys stored for this session (encrypted at rest). Values are never echoed.',
    });
  }

  // POST /rt/v1/quests
  if (request.method === 'POST' && matchPath(pathname, `${API_PREFIX}/quests`)) {
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;
    let body;
    try {
      body = await readJson(request);
    } catch {
      return json(400, { error: 'invalid JSON body' });
    }
    const store = getStore(env);
    const result = await createQuest(env, store, {
      sessionId: auth.sessionId,
      goal: body.goal,
      enabledSeatIds: body.enabledSeatIds,
      fetchImpl,
    });
    if (!result.ok) return json(result.status, { error: result.error });
    return json(201, { quest: publicQuest(result.quest) });
  }

  // GET /rt/v1/quests/:id
  {
    const params = matchPath(pathname, `${API_PREFIX}/quests/:id`);
    if (request.method === 'GET' && params) {
      const auth = await requireAuth(request, env);
      if (!auth.ok) return auth.response;
      const store = getStore(env);
      const result = await getQuest(store, params.id, auth.sessionId);
      if (!result.ok) return json(result.status, { error: result.error });
      return json(200, { quest: publicQuest(result.quest) });
    }
  }

  // POST /rt/v1/proxy/chat
  if (request.method === 'POST' && matchPath(pathname, `${API_PREFIX}/proxy/chat`)) {
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;
    let body;
    try {
      body = await readJson(request);
    } catch {
      return json(400, { error: 'invalid JSON body' });
    }
    const providerId = body.providerId;
    if (!providerId) return json(400, { error: 'providerId is required' });

    // Dry-shape check for unimplemented providers before looking up keys.
    const shaped = shapeProxyRequest(providerId, {
      messages: body.messages || [{ role: 'user', content: 'ping' }],
      model: body.model,
    });
    if (!shaped.ok && shaped.status === 501) {
      return json(501, { error: shaped.error });
    }

    const store = getStore(env);
    const secrets = await getSecrets(env, store, auth.sessionId);
    const result = await proxyChat({
      providerId,
      apiKey: secrets[providerId],
      messages: body.messages,
      model: body.model,
      temperature: body.temperature,
      fetchImpl,
    });
    if (!result.ok) return json(result.status, { error: result.error });
    return json(200, {
      providerId: result.providerId,
      model: result.model,
      text: result.text,
      usage: result.usage,
    });
  }

  return json(404, { error: 'not_found', path: pathname });
}
