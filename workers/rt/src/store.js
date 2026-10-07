/**
 * Session-scoped store. Memory by default; optional KV for durable secrets/quests.
 * Never log secret values.
 */

export function createMemoryStore() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value, _options) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
    dump() {
      return Object.fromEntries(map);
    },
  };
}

/** Adapt a Cloudflare KV namespace to the same async interface. */
export function createKvStore(kv) {
  if (!kv) return createMemoryStore();
  return {
    async get(key) {
      return kv.get(key);
    },
    async put(key, value, options) {
      await kv.put(key, value, options);
    },
    async delete(key) {
      await kv.delete(key);
    },
  };
}

export function secretsKey(sessionId) {
  return `rt:secrets:${sessionId}`;
}

export function questKey(questId) {
  return `rt:quest:${questId}`;
}

export function sessionIndexKey(sessionId) {
  return `rt:session:${sessionId}`;
}
