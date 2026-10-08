/**
 * Arbiter webhook groundwork.
 * Off unless RT_ARBITER_WEBHOOK is "1" or "true".
 * Never sends provider API keys. Callback tokens are quest-scoped bearers.
 */

import { hmacSign, hmacVerify } from './crypto-util.js';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);

export function arbiterWebhookEnabled(env) {
  const value = String(env?.RT_ARBITER_WEBHOOK ?? '').trim().toLowerCase();
  return value === '1' || value === 'true';
}

export function arbiterWebhookKey(sessionId) {
  return `rt:arbiter-webhook:${sessionId}`;
}

function ipv4Blocked(host) {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  if (!parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return false;
  const [a, b] = parts.map(Number);
  if (a === 0 || a === 10 || a === 127 || a === 255) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function ipv6Blocked(host) {
  const value = host.toLowerCase();
  if (value === '::1' || value === '::') return true;
  if (value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) return true;
  if (value.startsWith('::ffff:')) {
    const mapped = value.slice('::ffff:'.length);
    if (ipv4Blocked(mapped)) return true;
  }
  return false;
}

export function validateWebhookUrl(raw) {
  if (typeof raw !== 'string' || raw.length < 8 || raw.length > 2048) {
    return { ok: false, error: 'webhook url must be an https URL' };
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'webhook url must be an https URL' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'webhook url must use https' };
  }
  if (url.username || url.password) {
    return { ok: false, error: 'webhook url must not include credentials' };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (
    !bare
    || BLOCKED_HOSTS.has(bare)
    || bare.endsWith('.local')
    || bare.endsWith('.localhost')
    || bare.endsWith('.internal')
    || /^\d+$/.test(bare)
  ) {
    return { ok: false, error: 'webhook host is not allowed' };
  }
  if (bare.includes(':') ? ipv6Blocked(bare) : ipv4Blocked(bare)) {
    return { ok: false, error: 'webhook host is not allowed' };
  }
  return { ok: true, url: url.toString() };
}

export async function putArbiterWebhook(store, sessionId, url, ttlSeconds = 3600) {
  await store.put(
    arbiterWebhookKey(sessionId),
    JSON.stringify({ url }),
    { expirationTtl: Math.max(60, ttlSeconds) },
  );
  return { url };
}

export async function getArbiterWebhook(store, sessionId) {
  const raw = await store.get(arbiterWebhookKey(sessionId));
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return typeof parsed?.url === 'string' ? { url: parsed.url } : null;
  } catch {
    return null;
  }
}

export async function deleteArbiterWebhook(store, sessionId) {
  await store.delete(arbiterWebhookKey(sessionId));
}

export async function mintCallbackToken(env, questId, { ttlMs = 60 * 60 * 1000, now = Date.now() } = {}) {
  const secret = env?.RT_SESSION_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('RT_SESSION_SECRET must be set (min 16 chars)');
  }
  const payload = JSON.stringify({
    purpose: 'arbiter_cb',
    qid: questId,
    iat: now,
    exp: now + ttlMs,
  });
  const body = btoa(payload);
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

export async function verifyCallbackToken(env, token, questId, { now = Date.now() } = {}) {
  const secret = env?.RT_SESSION_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    return { ok: false, error: 'missing_secret' };
  }
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, error: 'missing_or_malformed_token' };
  }
  const [body, sig] = token.split('.');
  if (!body || !sig) return { ok: false, error: 'missing_or_malformed_token' };
  const valid = await hmacVerify(secret, body, sig);
  if (!valid) return { ok: false, error: 'invalid_signature' };
  let payload;
  try {
    payload = JSON.parse(atob(body));
  } catch {
    return { ok: false, error: 'invalid_payload' };
  }
  if (payload?.purpose !== 'arbiter_cb' || !payload?.qid || !payload?.exp) {
    return { ok: false, error: 'invalid_payload' };
  }
  if (payload.qid !== questId) return { ok: false, error: 'wrong_quest' };
  if (payload.exp < now) return { ok: false, error: 'expired' };
  return { ok: true, questId: payload.qid, expiresAt: payload.exp };
}

export function callbackUrlFor(request, questId) {
  const origin = new URL(request.url).origin;
  return `${origin}/rt/v1/quests/${encodeURIComponent(questId)}/arbiter`;
}

export function arbiterTurnPayload({ quest, seats, callbackUrl, callbackToken }) {
  return {
    event: 'arbiter_turn',
    questId: quest.id,
    goal: quest.goal,
    seats,
    callback: {
      method: 'POST',
      url: callbackUrl,
      authorization: `Bearer ${callbackToken}`,
    },
    note: 'Post the arbiter decision as JSON with approach, allocations, and optional text. Do not send provider API keys.',
  };
}

export function normalizeArbiterDecision(body, enabledSeatIds = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'decision body must be an object' };
  }
  const approach = body.approach != null ? String(body.approach).slice(0, 240) : '';
  const text = body.text != null ? String(body.text).slice(0, 2000) : '';
  let allocations = null;
  if (body.allocations != null) {
    if (!Array.isArray(body.allocations)) {
      return { ok: false, error: 'allocations must be an array' };
    }
    const allowed = new Set(enabledSeatIds);
    allocations = body.allocations
      .filter((row) => row && allowed.has(row.seatId))
      .map((row) => ({
        seatId: row.seatId,
        percent: Math.max(0, Math.round(Number(row.percent) || 0)),
        responsibility: String(row.responsibility || 'Review & integration').slice(0, 80),
      }));
    const sum = allocations.reduce((total, row) => total + row.percent, 0);
    if (!allocations.length || sum < 90 || sum > 110) {
      return { ok: false, error: 'allocations must use seated ids and sum near 100' };
    }
  }
  if (!approach && !text && !allocations) {
    return { ok: false, error: 'decision needs approach, text, or allocations' };
  }
  return { ok: true, approach, text, allocations };
}

export async function deliverArbiterTurn({
  url,
  payload,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
} = {}) {
  const checked = validateWebhookUrl(url);
  if (!checked.ok) return { status: 'failed', error: checked.error };
  try {
    const response = await fetchImpl(checked.url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'round-table-connector',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel?.().catch(() => {});
      return { status: 'failed', error: 'redirect_blocked' };
    }
    if (response.status < 200 || response.status >= 300) {
      await response.body?.cancel?.().catch(() => {});
      return { status: 'failed', error: `http_${response.status}` };
    }
    await response.body?.cancel?.().catch(() => {});
    return { status: 'delivered' };
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return { status: 'failed', error: timedOut ? 'timeout' : 'unreachable' };
  }
}
