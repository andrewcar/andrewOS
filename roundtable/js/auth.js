/**
 * Device accounts for a static host.
 * Passwords become a PBKDF2 verifier. Provider keys are AES-GCM ciphertext.
 * The password and the raw keys are never written to the account record.
 */

const ACCOUNTS = 'round-table:accounts:v1';
const SESSION = 'round-table:session:v1';

const text = new TextEncoder();
const decoder = new TextDecoder();

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    dump() { return Object.fromEntries(map); },
  };
}

function bytesToB64(bytes) {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64ToBytes(value) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function readAccounts(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(ACCOUNTS) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(storage, accounts) {
  storage.setItem(ACCOUNTS, JSON.stringify(accounts));
}

function sameString(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function deriveBits(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', text.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function deriveAes(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', text.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function secretKey(userId) {
  return `round-table:secrets:v1:${userId}`;
}

export function createVault({ storage, session, iterations = 100_000 }) {
  const persist = storage;
  const sessions = session;

  return {
    iterations,
    accounts() {
      return readAccounts(persist);
    },
    session() {
      try {
        return JSON.parse(sessions.getItem(SESSION) || 'null');
      } catch {
        return null;
      }
    },
    clearSession() {
      sessions.removeItem(SESSION);
    },
    hasSecrets(userId) {
      return Boolean(persist.getItem(secretKey(userId)));
    },
    async signUp({ email, password, name }) {
      const normalized = String(email || '').trim().toLowerCase();
      const display = String(name || '').trim() || normalized.split('@')[0] || 'You';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw new Error('Enter a valid email.');
      }
      if (String(password || '').length < 8) {
        throw new Error('Use at least 8 characters.');
      }
      const accounts = readAccounts(persist);
      if (accounts.some((account) => account.email === normalized)) {
        throw new Error('That email already has an account on this device.');
      }
      const authSalt = randomBytes(16);
      const keysSalt = randomBytes(16);
      const authHash = await deriveBits(password, authSalt, iterations);
      const account = {
        id: `user_${bytesToB64(randomBytes(9)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`,
        email: normalized,
        name: display,
        authSalt: bytesToB64(authSalt),
        authHash: bytesToB64(authHash),
        keysSalt: bytesToB64(keysSalt),
        iterations,
        createdAt: new Date().toISOString(),
      };
      accounts.push(account);
      writeAccounts(persist, accounts);
      const aesKey = await deriveAes(password, keysSalt, iterations);
      sessions.setItem(SESSION, JSON.stringify({ userId: account.id, email: account.email, name: account.name }));
      return { account: publicAccount(account), aesKey, secrets: {} };
    },
    async signIn({ email, password }) {
      const normalized = String(email || '').trim().toLowerCase();
      const account = readAccounts(persist).find((row) => row.email === normalized);
      if (!account) throw new Error('No account for that email on this device.');
      const authHash = bytesToB64(await deriveBits(password, b64ToBytes(account.authSalt), account.iterations));
      if (!sameString(authHash, account.authHash)) throw new Error('Wrong password.');
      const aesKey = await deriveAes(password, b64ToBytes(account.keysSalt), account.iterations);
      const secrets = await decryptPayload(persist.getItem(secretKey(account.id)), aesKey);
      sessions.setItem(SESSION, JSON.stringify({ userId: account.id, email: account.email, name: account.name }));
      return { account: publicAccount(account), aesKey, secrets: secrets || {} };
    },
    async unlock(password) {
      const current = this.session();
      if (!current) throw new Error('Sign in first.');
      const account = readAccounts(persist).find((row) => row.id === current.userId);
      if (!account) throw new Error('Account missing on this device.');
      const authHash = bytesToB64(await deriveBits(password, b64ToBytes(account.authSalt), account.iterations));
      if (!sameString(authHash, account.authHash)) throw new Error('Wrong password.');
      const aesKey = await deriveAes(password, b64ToBytes(account.keysSalt), account.iterations);
      const secrets = await decryptPayload(persist.getItem(secretKey(account.id)), aesKey);
      return { account: publicAccount(account), aesKey, secrets: secrets || {} };
    },
    async saveSecrets(userId, aesKey, secrets) {
      const iv = randomBytes(12);
      const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        text.encode(JSON.stringify(secrets)),
      );
      persist.setItem(secretKey(userId), JSON.stringify({
        iv: bytesToB64(iv),
        ct: bytesToB64(cipher),
      }));
    },
    async clearSecrets(userId) {
      persist.removeItem(secretKey(userId));
    },
  };
}

function publicAccount(account) {
  return { id: account.id, email: account.email, name: account.name };
}

async function decryptPayload(raw, aesKey) {
  if (!raw) return {};
  try {
    const payload = JSON.parse(raw);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(payload.iv) },
      aesKey,
      b64ToBytes(payload.ct),
    );
    const parsed = JSON.parse(decoder.decode(plain));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return null;
  }
}

export function questStorageKey(userId) {
  return `round-table:v1:${userId}`;
}

export function arbiterStorageKey(userId) {
  return `round-table:arbiter:v1:${userId}`;
}
