/**
 * Server-side provider chat completions using the session's stored key.
 * Slice 1: xAI (arbiter) + OpenAI-compatible paths work.
 * Anthropic / Google return 501 with a clear message. Muse has no relay.
 */

export const PROVIDER_ENDPOINTS = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    kind: 'openai',
    model: 'gpt-4o-mini',
    label: 'Codex',
  },
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    kind: 'openai',
    model: 'deepseek-chat',
    label: 'DeepSeek',
  },
  arbiter: {
    url: 'https://api.x.ai/v1/chat/completions',
    kind: 'openai',
    model: 'grok-4.3',
    label: 'Grok (API)',
  },
  anthropic: {
    kind: 'todo',
    label: 'Claude',
    message: 'Anthropic proxy is not implemented in connector slice 1. Use arbiter (xAI) or openai.',
  },
  google: {
    kind: 'todo',
    label: 'Gemini',
    message: 'Google Gemini proxy is not implemented in connector slice 1. Use arbiter (xAI) or openai.',
  },
  meta: {
    kind: 'none',
    label: 'Muse',
    message: 'Muse has no connector relay yet.',
  },
};

export function redact(text, secret, { maxLen = Infinity } = {}) {
  let value = String(text ?? '');
  if (secret) value = value.split(secret).join('•••');
  if (Number.isFinite(maxLen) && value.length > maxLen) value = value.slice(0, maxLen);
  return value;
}

/** Short redaction for error payloads (never dump full upstream bodies). */
export function redactError(text, secret) {
  return redact(text, secret, { maxLen: 180 });
}

/**
 * Shape an OpenAI-compatible chat completions request (xAI / OpenAI / DeepSeek).
 */
export function buildOpenAiChatRequest({ model, messages, temperature = 0.4 }) {
  return {
    model,
    temperature,
    messages,
  };
}

export function parseOpenAiChatResponse(payload) {
  return payload?.choices?.[0]?.message?.content?.trim() || '';
}

export function shapeProxyRequest(providerId, { messages, model, temperature } = {}) {
  const endpoint = PROVIDER_ENDPOINTS[providerId];
  if (!endpoint) {
    return { ok: false, status: 400, error: `unknown providerId: ${providerId}` };
  }
  if (endpoint.kind === 'todo') {
    return { ok: false, status: 501, error: endpoint.message };
  }
  if (endpoint.kind === 'none') {
    return { ok: false, status: 501, error: endpoint.message };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, status: 400, error: 'messages must be a non-empty array' };
  }
  const headers = {
    'content-type': 'application/json',
    authorization: 'Bearer <redacted>',
  };
  const body = buildOpenAiChatRequest({
    model: model || endpoint.model,
    messages,
    temperature: temperature ?? 0.4,
  });
  return {
    ok: true,
    providerId,
    label: endpoint.label,
    url: endpoint.url,
    headers,
    body,
  };
}

/**
 * Call the real provider with the session key. fetchImpl is injectable for tests.
 */
export async function proxyChat({
  providerId,
  apiKey,
  messages,
  model,
  temperature,
  timeoutMs = 30000,
  fetchImpl = globalThis.fetch,
}) {
  const shaped = shapeProxyRequest(providerId, { messages, model, temperature });
  if (!shaped.ok) {
    return { ok: false, status: shaped.status, error: shaped.error };
  }
  if (!apiKey) {
    return {
      ok: false,
      status: 400,
      error: `No API key stored for providerId "${providerId}". PUT /rt/v1/secrets first.`,
    };
  }
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(shaped.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(shaped.body),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `${shaped.label} returned ${response.status}. ${redactError(raw, apiKey)}`,
      };
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, status: 502, error: `${shaped.label} returned non-JSON.` };
    }
    const text = parseOpenAiChatResponse(parsed);
    if (!text) {
      return { ok: false, status: 502, error: `${shaped.label} returned an empty reply.` };
    }
    return {
      ok: true,
      status: 200,
      providerId,
      model: shaped.body.model,
      // Scrub key if the model echoed it; do not truncate successful replies.
      text: redact(text, apiKey),
      usage: parsed.usage || null,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, status: 504, error: `${shaped.label} timed out after ${Math.round(timeoutMs / 1000)}s.` };
    }
    return {
      ok: false,
      status: 502,
      error: `${shaped.label} network error: ${redactError(error?.message || 'failed', apiKey)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
