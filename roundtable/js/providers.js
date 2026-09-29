/**
 * Browser calls to provider APIs. Keys travel only to that provider.
 * Missing relays return immediately so the UI can show a blocked seat.
 */

const ENDPOINTS = {
  openai: { url: 'https://api.openai.com/v1/chat/completions', kind: 'openai', model: 'gpt-4o-mini' },
  deepseek: { url: 'https://api.deepseek.com/chat/completions', kind: 'openai', model: 'deepseek-chat' },
  arbiter: { url: 'https://api.openai.com/v1/chat/completions', kind: 'openai', model: 'gpt-4o-mini' },
  anthropic: { url: 'https://api.anthropic.com/v1/messages', kind: 'anthropic', model: 'claude-3-5-haiku-latest' },
  google: { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', kind: 'google', model: 'gemini-2.0-flash' },
  meta: null,
};

const LABELS = {
  openai: 'Codex',
  anthropic: 'Claude',
  google: 'Gemini',
  meta: 'Muse',
  deepseek: 'DeepSeek',
  arbiter: 'BotBot',
};

export function redact(text, secret) {
  const value = String(text ?? '');
  if (!secret) return value.slice(0, 180);
  return value.split(secret).join('•••').slice(0, 180);
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), ms);
  controller.signal.addEventListener('abort', () => clearTimeout(timer));
  return controller.signal;
}

function parseBody(providerId, payload) {
  if (providerId === 'anthropic') {
    return (payload.content || []).map((part) => part.text || '').join('').trim();
  }
  if (providerId === 'google') {
    const parts = payload.candidates?.[0]?.content?.parts || [];
    return parts.map((part) => part.text || '').join('').trim();
  }
  return payload.choices?.[0]?.message?.content?.trim() || '';
}

export async function completeLive({
  providerId,
  apiKey,
  system,
  user,
  timeoutMs = 12000,
  fetchImpl = globalThis.fetch,
}) {
  const label = LABELS[providerId] || providerId;
  const endpoint = ENDPOINTS[providerId];
  if (!apiKey) {
    return { ok: false, code: 'missing-key', message: `${label} has no key saved.` };
  }
  if (!endpoint) {
    return {
      ok: false,
      code: 'no-relay',
      message: `${label} has no browser relay on this host. The seat is blocked instead of waiting.`,
    };
  }
  const headers = { 'content-type': 'application/json' };
  let body;
  if (endpoint.kind === 'openai') {
    headers.authorization = `Bearer ${apiKey}`;
    body = {
      model: endpoint.model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
  } else if (endpoint.kind === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
    body = { model: endpoint.model, max_tokens: 400, system, messages: [{ role: 'user', content: user }] };
  } else {
    headers['x-goog-api-key'] = apiKey;
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
    };
  }
  try {
    const response = await fetchImpl(endpoint.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: timeoutSignal(timeoutMs),
    });
    const raw = await response.text();
    if (!response.ok) {
      return { ok: false, code: 'http', message: `${label} returned ${response.status}. ${redact(raw, apiKey)}` };
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const text = parseBody(providerId, parsed);
    if (!text) return { ok: false, code: 'empty', message: `${label} returned an empty reply.` };
    return { ok: true, text: redact(text, apiKey) };
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      return { ok: false, code: 'timeout', message: `${label} timed out after ${Math.round(timeoutMs / 1000)}s.` };
    }
    return {
      ok: false,
      code: 'network',
      message: `${label} blocked the browser request. This host has no relay, so the seat stops instead of waiting in silence.`,
    };
  }
}
