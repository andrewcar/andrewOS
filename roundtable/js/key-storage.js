/**
 * Settings key changes when the in-memory AES key is gone.
 * A restored session keeps the account only. The password is handed to the
 * vault to derive the PBKDF2 AES-GCM key and is not stored or returned.
 */

export const KEY_UNLOCK_PROMPT = 'Enter your password to unlock key storage.';
export const KEYS_LOCKED_NOTE = 'Saved keys are locked. Enter your password to unlock key storage.';
export const CHECKING_PASSWORD_NOTE = 'Checking your password…';
export const KEYS_SAVED_NOTE = 'Saved. Keys stay encrypted on this device.';
export const KEYS_UNLOCKED_NOTE = 'Key storage unlocked. Keys stay encrypted on this device.';
export const KEYS_READY_NOTE = 'Key storage unlocked. Paste a provider key, then save.';
export const KEY_REMOVED_NOTE = 'Key removed from this device.';
export const KEYS_CLEARED_NOTE = 'All keys removed from this device.';

export function collectKeyEdits(pairs) {
  const edits = {};
  for (const [providerId, value] of pairs || []) {
    const trimmed = String(value ?? '').trim();
    if (!providerId || !trimmed) continue;
    edits[providerId] = trimmed;
  }
  return edits;
}

function cleanEdits(edits) {
  return collectKeyEdits(Object.entries(edits || {}));
}

function hasValues(secrets) {
  return Object.values(secrets || {}).some((value) => String(value ?? '').trim());
}

/**
 * @returns {Promise<{ aesKey: CryptoKey, secrets: Record<string, string> }>}
 * Password is forwarded only to vault.unlock when no AES key is in memory.
 */
export async function openKeyStorage({ vault, aesKey, secrets, password }) {
  if (aesKey) return { aesKey, secrets: { ...(secrets || {}) } };
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error(KEY_UNLOCK_PROMPT);
  }
  const result = await vault.unlock(password);
  if (!result?.aesKey) throw new Error('Could not unlock key storage.');
  return { aesKey: result.aesKey, secrets: { ...(result.secrets || {}) } };
}

export async function saveProviderKeys({ vault, userId, aesKey, secrets, password, edits }) {
  const opened = await openKeyStorage({ vault, aesKey, secrets, password });
  const clean = cleanEdits(edits);
  const next = { ...opened.secrets, ...clean };
  const saved = hasValues(next);
  if (saved) await vault.saveSecrets(userId, opened.aesKey, next);
  return {
    aesKey: opened.aesKey,
    secrets: next,
    saved,
    edited: Object.keys(clean).length > 0,
    unlockedNow: !aesKey,
  };
}

export function saveResultNote(result) {
  if (!result?.saved) return KEYS_READY_NOTE;
  if (result.unlockedNow && !result.edited) return KEYS_UNLOCKED_NOTE;
  return KEYS_SAVED_NOTE;
}

export async function removeProviderKey({ vault, userId, aesKey, secrets, password, providerId }) {
  const opened = await openKeyStorage({ vault, aesKey, secrets, password });
  const next = { ...opened.secrets };
  delete next[providerId];
  if (hasValues(next)) await vault.saveSecrets(userId, opened.aesKey, next);
  else await vault.clearSecrets(userId);
  return { aesKey: opened.aesKey, secrets: next, unlockedNow: !aesKey };
}
