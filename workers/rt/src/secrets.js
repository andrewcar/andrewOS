/**
 * Session-scoped provider key map. Keys come from the caller; never hardcoded.
 * Encrypted at rest with AES-GCM using RT_SESSION_SECRET.
 * Never log secret values.
 */

import { decryptJson, encryptJson } from './crypto-util.js';
import { secretsKey } from './store.js';

const ALLOWED_PROVIDER_IDS = new Set([
  'arbiter',
  'openai',
  'anthropic',
  'google',
  'meta',
  'deepseek',
]);

export function normalizeSecretMap(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'body must be an object of providerId → apiKey strings' };
  }
  const keys = {};
  for (const [providerId, value] of Object.entries(input)) {
    if (!ALLOWED_PROVIDER_IDS.has(providerId)) {
      return { ok: false, error: `unknown providerId: ${providerId}` };
    }
    if (value == null || value === '') continue;
    if (typeof value !== 'string') {
      return { ok: false, error: `key for ${providerId} must be a string` };
    }
    keys[providerId] = value;
  }
  return { ok: true, keys };
}

export async function putSecrets(env, store, sessionId, keyMap, { ttlSeconds = 3600 } = {}) {
  const secret = env.RT_SESSION_SECRET;
  const envelope = await encryptJson(secret, keyMap);
  await store.put(secretsKey(sessionId), JSON.stringify(envelope), {
    expirationTtl: ttlSeconds,
  });
  return { stored: Object.keys(keyMap).sort() };
}

export async function getSecrets(env, store, sessionId) {
  const raw = await store.get(secretsKey(sessionId));
  if (!raw) return {};
  try {
    const envelope = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return await decryptJson(env.RT_SESSION_SECRET, envelope);
  } catch {
    return {};
  }
}

/** Safe summary for responses — provider ids present, never values. */
export function secretSummary(keyMap) {
  return {
    providers: Object.keys(keyMap || {}).sort(),
  };
}
