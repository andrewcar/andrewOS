const text = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToB64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

export function b64ToBytes(value) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function randomId(prefix = 'id') {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}_${bytesToB64(bytes).replace(/[+/=]/g, (ch) => ({ '+': '-', '/': '_', '=': '' }[ch]))}`;
}

export async function hmacSign(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    text.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, text.encode(payload));
  return bytesToB64(sig);
}

export async function hmacVerify(secret, payload, signatureB64) {
  const expected = await hmacSign(secret, payload);
  return timingSafeEqual(expected, signatureB64);
}

export function timingSafeEqual(a, b) {
  const left = String(a ?? '');
  const right = String(b ?? '');
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export async function deriveAesKey(secret, saltBytes) {
  const base = await crypto.subtle.importKey('raw', text.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(secret, obj) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(secret, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    text.encode(JSON.stringify(obj)),
  );
  return {
    v: 1,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(cipher),
  };
}

export async function decryptJson(secret, envelope) {
  if (!envelope || envelope.v !== 1) throw new Error('invalid secret envelope');
  const key = await deriveAesKey(secret, b64ToBytes(envelope.salt));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(envelope.iv) },
    key,
    b64ToBytes(envelope.ciphertext),
  );
  return JSON.parse(decoder.decode(plain));
}
