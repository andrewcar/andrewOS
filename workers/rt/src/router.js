/**
 * Round Table connector HTTP API — /rt/v1/*
 */

import { json, noContent, readJson, matchPath } from './http.js';
import { publicRoster, seatById } from './roster.js';
import { mintSession, verifySessionToken, bearerFromRequest, resolveTtlMs, remainingTtlSeconds } from './session.js';
import { normalizeSecretMap, putSecrets, getSecrets, secretSummary } from './secrets.js';
import { createQuest, getQuest, readQuest, saveQuest, publicQuest } from './quests.js';
import { proxyChat, shapeProxyRequest } from './proxy.js';
import { createMemoryStore, createKvStore } from './store.js';
import { connectorHealth } from './health.js';
import { isMcpPath, handleMcp } from './mcp.js';
import { randomId } from './crypto-util.js';
import {
  arbiterWebhookEnabled,
  validateWebhookUrl,
  putArbiterWebhook,
  getArbiterWebhook,
  deleteArbiterWebhook,
  mintCallbackToken,
  verifyCallbackToken,
  callbackUrlFor,
  arbiterTurnPayload,
  normalizeArbiterDecision,
  deliverArbiterTurn,
} from './arbiter-webhook.js';

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
  return { ok: true, sessionId: verified.sessionId, expiresAt: verified.expiresAt };
}

function webhookDisabled() {
  return json(403, { error: 'arbiter_webhook_disabled' });
}

/**
 * @param {Request} request
 * @param {object} env
 * @param {{ fetchImpl?: typeof fetch }} [deps]
 */
export async function handleRequest(request, env, deps = {}) {
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // `/` is the static UI (Workers assets). API lives under /rt/v1/* plus the /mcp alias.

  if (request.method === 'OPTIONS') {
    return noContent();
  }

  if (isMcpPath(pathname)) {
    return handleMcp(request, env, deps);
  }

  // GET /rt/v1/health
  if (request.method === 'GET' && matchPath(pathname, `${API_PREFIX}/health`)) {
    return json(200, connectorHealth());
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
    let sessionBody = {};
    try {
      sessionBody = await readJson(request);
    } catch {
      return json(400, { error: 'invalid JSON body' });
    }
    const ttl = resolveTtlMs(sessionBody.ttlSeconds);
    if (!ttl.ok) return json(400, { error: ttl.error });
    try {
      const store = getStore(env);
      const session = await mintSession(env, { store, ttlMs: ttl.ttlMs });
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
    const result = await putSecrets(env, store, auth.sessionId, normalized.keys, {
      ttlSeconds: remainingTtlSeconds(auth.expiresAt),
    });
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
    const webhook = await resolveQuestWebhook(request, env, store, auth, body);
    if (!webhook.ok) return webhook.response;
    const result = await createQuest(env, store, {
      sessionId: auth.sessionId,
      goal: body.goal,
      enabledSeatIds: body.enabledSeatIds,
      fetchImpl,
      ttlSeconds: remainingTtlSeconds(auth.expiresAt),
    });
    if (!result.ok) return json(result.status, { error: result.error });
    if (webhook.url) {
      await notifyArbiterWebhook(request, env, store, result.quest, webhook.url, fetchImpl);
    }
    return json(201, { quest: publicQuest(result.quest) });
  }

  // PUT/GET/DELETE /rt/v1/arbiter-webhook
  if (matchPath(pathname, `${API_PREFIX}/arbiter-webhook`)) {
    if (!arbiterWebhookEnabled(env)) return webhookDisabled();
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;
    const store = getStore(env);
    if (request.method === 'GET') {
      const current = await getArbiterWebhook(store, auth.sessionId);
      return json(200, { enabled: true, url: current?.url || null });
    }
    if (request.method === 'DELETE') {
      await deleteArbiterWebhook(store, auth.sessionId);
      return json(200, { ok: true, enabled: true, url: null });
    }
    if (request.method === 'PUT') {
      let hookBody;
      try {
        hookBody = await readJson(request);
      } catch {
        return json(400, { error: 'invalid JSON body' });
      }
      const checked = validateWebhookUrl(hookBody.url);
      if (!checked.ok) return json(400, { error: checked.error });
      await putArbiterWebhook(store, auth.sessionId, checked.url, remainingTtlSeconds(auth.expiresAt));
      return json(200, { ok: true, enabled: true, url: checked.url });
    }
  }

  // POST /rt/v1/quests/:id/arbiter
  {
    const params = matchPath(pathname, `${API_PREFIX}/quests/:id/arbiter`);
    if (request.method === 'POST' && params) {
      if (!arbiterWebhookEnabled(env)) return webhookDisabled();
      const token = bearerFromRequest(request);
      const callback = await verifyCallbackToken(env, token, params.id);
      const store = getStore(env);
      let questResult;
      if (callback.ok) {
        questResult = await readQuest(store, params.id);
      } else {
        const auth = await requireAuth(request, env);
        if (!auth.ok) return auth.response;
        questResult = await getQuest(store, params.id, auth.sessionId);
      }
      if (!questResult.ok) return json(questResult.status, { error: questResult.error });
      let decisionBody;
      try {
        decisionBody = await readJson(request);
      } catch {
        return json(400, { error: 'invalid JSON body' });
      }
      const decision = normalizeArbiterDecision(decisionBody, questResult.quest.enabledSeatIds);
      if (!decision.ok) return json(400, { error: decision.error });
      const next = applyArbiterDecision(questResult.quest, decision);
      await saveQuest(store, next, { ttlSeconds: 3600 });
      return json(200, { quest: publicQuest(next) });
    }
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

async function resolveQuestWebhook(_request, env, store, auth, body) {
  const explicit = body.arbiterWebhook != null;
  if (!arbiterWebhookEnabled(env)) {
    if (explicit) return { ok: false, response: webhookDisabled() };
    return { ok: true, url: null };
  }
  if (explicit) {
    const candidate = typeof body.arbiterWebhook === 'string'
      ? body.arbiterWebhook
      : body.arbiterWebhook?.url;
    const checked = validateWebhookUrl(candidate);
    if (!checked.ok) return { ok: false, response: json(400, { error: checked.error }) };
    return { ok: true, url: checked.url };
  }
  const stored = await getArbiterWebhook(store, auth.sessionId);
  if (!stored?.url) return { ok: true, url: null };
  const checked = validateWebhookUrl(stored.url);
  return { ok: true, url: checked.ok ? checked.url : null };
}

async function notifyArbiterWebhook(request, env, store, quest, url, fetchImpl) {
  const callbackToken = await mintCallbackToken(env, quest.id);
  const seats = publicRoster().filter((seat) => (
    seat.role === 'arbiter' || quest.enabledSeatIds?.includes(seat.id)
  ));
  const payload = arbiterTurnPayload({
    quest,
    seats,
    callbackUrl: callbackUrlFor(request, quest.id),
    callbackToken,
  });
  const delivery = await deliverArbiterTurn({ url, payload, fetchImpl });
  quest.arbiterWebhook = { status: delivery.status };
  if (delivery.error) quest.arbiterWebhook.error = delivery.error;
  await saveQuest(store, quest);
}

function applyArbiterDecision(quest, decision) {
  const receivedAt = new Date().toISOString();
  const arbiter = seatById('botbot');
  const name = arbiter?.name || 'Grok';
  const next = {
    ...quest,
    updatedAt: receivedAt,
    arbiterDecision: {
      source: 'webhook',
      approach: decision.approach,
      text: decision.text,
      allocations: decision.allocations,
      receivedAt,
    },
    messages: [
      ...(quest.messages || []),
      {
        id: randomId('msg'),
        seatId: 'botbot',
        kind: 'status',
        text: decision.text
          ? `${name} posted an arbiter decision. ${decision.text}`.slice(0, 500)
          : `${name} posted an arbiter decision.`,
        createdAt: receivedAt,
      },
    ],
  };
  if (decision.allocations) {
    next.proposal = {
      ...(quest.proposal || {}),
      id: quest.proposal?.id || randomId('prop'),
      revision: quest.proposal?.revision || 1,
      pattern: 'percent-split',
      source: 'webhook',
      approach: decision.approach || quest.proposal?.approach || 'Arbiter decision',
      allocations: decision.allocations,
      superseded: false,
    };
    next.source = 'webhook';
  }
  return next;
}
