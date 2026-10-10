/**
 * Same-origin bug-report proxy.
 * The relay host is hardcoded in this Worker module so shipped markup and
 * client JS stay white-label. The widget loads /rt/v1/bug/widget.js and POSTs
 * to that script's directory + /api/projects/roundtable/feedback.
 */

import { json } from './http.js';

export const BUG_PROJECT_SLUG = 'roundtable';
export const MAX_FEEDBACK_BYTES = 8 * 1024 * 1024;
export const WIDGET_CACHE_CONTROL = 'public, max-age=300';

const RELAY_ORIGIN = 'https://relay.andrewos.com';
const WIDGET_PATH = '/rt/v1/bug/widget.js';
const FEEDBACK_PATH = `/rt/v1/bug/api/projects/${BUG_PROJECT_SLUG}/feedback`;

const PASSTHROUGH_RESPONSE_HEADERS = [
  'content-type',
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-allow-credentials',
  'access-control-max-age',
  'vary',
];

export function isBugProxyPath(pathname) {
  return pathname === '/rt/v1/bug' || pathname.startsWith('/rt/v1/bug/');
}

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.replace(/\/+$/, '');
  return pathname;
}

function upstreamFailure() {
  return json(502, { error: 'Bug report is temporarily unavailable.' });
}

function declaredContentLength(request) {
  const raw = request.headers.get('content-length');
  if (raw == null) return null;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

async function readLimitedBody(request) {
  const declared = declaredContentLength(request);
  if (declared != null && declared > MAX_FEEDBACK_BYTES) return { ok: false };

  if (request.method !== 'POST') return { ok: true, body: undefined };
  if (!request.body) return { ok: true, body: new Uint8Array(0) };

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FEEDBACK_BYTES) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, malformed: true };
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, body };
}

async function passthrough(upstream, extraHeaders = {}) {
  const headers = new Headers();
  for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  for (const [name, value] of Object.entries(extraHeaders)) {
    if (!headers.get(name)) headers.set(name, value);
  }
  const status = upstream.status;
  if (status === 204 || status === 205 || status === 304) {
    return new Response(null, { status, headers });
  }
  let body;
  try {
    body = await upstream.arrayBuffer();
  } catch {
    return upstreamFailure();
  }
  return new Response(body, { status, headers });
}

async function relay(fetchImpl, target, init, extraHeaders) {
  let upstream;
  try {
    upstream = await fetchImpl(target, { ...init, redirect: 'follow' });
  } catch {
    return upstreamFailure();
  }
  if (!upstream || typeof upstream.arrayBuffer !== 'function') return upstreamFailure();
  return passthrough(upstream, extraHeaders);
}

function feedbackHeaders(request) {
  const headers = new Headers();
  const origin = request.headers.get('origin');
  if (origin) headers.set('origin', origin);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  // Rate-limit key is Cloudflare's connecting IP, not a client-supplied XFF.
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers.set('x-forwarded-for', ip);
  return headers;
}

/**
 * @param {Request} request
 * @param {{ fetchImpl?: typeof fetch }} [deps]
 * @returns {Promise<Response | null>}
 */
export async function handleBugProxy(request, deps = {}) {
  const url = new URL(request.url);
  if (!isBugProxyPath(url.pathname)) return null;

  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const pathname = normalizePath(url.pathname);

  if (request.method === 'GET' && pathname === WIDGET_PATH) {
    return relay(
      fetchImpl,
      `${RELAY_ORIGIN}/widget.js?p=${BUG_PROJECT_SLUG}`,
      { method: 'GET' },
      {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': WIDGET_CACHE_CONTROL,
      },
    );
  }

  if ((request.method === 'POST' || request.method === 'OPTIONS') && pathname === FEEDBACK_PATH) {
    const limited = await readLimitedBody(request);
    if (!limited.ok) {
      if (limited.malformed) return json(400, { error: 'invalid_body' });
      return json(413, { error: 'payload_too_large' });
    }
    const init = {
      method: request.method,
      headers: feedbackHeaders(request),
    };
    if (request.method === 'POST') init.body = limited.body;
    return relay(
      fetchImpl,
      `${RELAY_ORIGIN}/api/projects/${BUG_PROJECT_SLUG}/feedback`,
      init,
    );
  }

  return json(404, { error: 'not_found', path: url.pathname });
}
