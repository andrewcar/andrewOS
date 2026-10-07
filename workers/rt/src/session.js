/**
 * Connector auth: short-lived HMAC bearer sessions.
 * This is NOT fleet identity — just a way for a Grok Bot (or other MCP client)
 * to call the Round Table HTTP API with user-supplied provider keys.
 */

import { hmacSign, hmacVerify, randomId } from './crypto-util.js';
import { sessionIndexKey } from './store.js';

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

function requireSecret(env) {
  const secret = env?.RT_SESSION_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('RT_SESSION_SECRET must be set (min 16 chars)');
  }
  return secret;
}

/**
 * Mint a bearer token: base64url(payload).signature
 * payload = { sid, exp, iat }
 */
export async function mintSession(env, { ttlMs = DEFAULT_TTL_MS, now = Date.now(), store } = {}) {
  const secret = requireSecret(env);
  const sid = randomId('sess');
  const iat = now;
  const exp = now + ttlMs;
  const payload = JSON.stringify({ sid, iat, exp });
  const body = btoa(payload);
  const sig = await hmacSign(secret, body);
  const token = `${body}.${sig}`;
  if (store) {
    await store.put(
      sessionIndexKey(sid),
      JSON.stringify({ sid, iat, exp }),
      { expirationTtl: Math.ceil(ttlMs / 1000) },
    );
  }
  return {
    token,
    sessionId: sid,
    expiresAt: new Date(exp).toISOString(),
    expiresInMs: ttlMs,
  };
}

export async function verifySessionToken(env, token, { now = Date.now() } = {}) {
  const secret = requireSecret(env);
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
  if (!payload?.sid || !payload?.exp) return { ok: false, error: 'invalid_payload' };
  if (payload.exp < now) return { ok: false, error: 'expired' };
  return { ok: true, sessionId: payload.sid, expiresAt: payload.exp, issuedAt: payload.iat };
}

export function bearerFromRequest(request) {
  const header = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
