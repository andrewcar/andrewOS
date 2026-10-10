import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../../workers/rt/src/router.js';
import worker from '../../workers/rt/src/index.js';
import { MAX_FEEDBACK_BYTES } from '../../workers/rt/src/bug-proxy.js';

const RELAY_WIDGET = 'https://relay.andrewos.com/widget.js?p=roundtable';
const RELAY_FEEDBACK = 'https://relay.andrewos.com/api/projects/roundtable/feedback';
const FEEDBACK_PATH = '/rt/v1/bug/api/projects/roundtable/feedback';

function headerNames(headers) {
  return [...new Headers(headers).keys()].sort();
}

async function call(path, { method = 'GET', headers, body, fetchImpl } = {}) {
  const request = new Request(`https://roundtable.lol${path}`, { method, headers, body });
  const response = await handleRequest(request, {}, { fetchImpl });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, status: response.status, text, json };
}

describe('bug report proxy', () => {
  it('hardcodes the widget slug and ignores the client query string', async () => {
    const fetchImpl = vi.fn(async () => new Response('/* widget */', {
      status: 200,
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-store',
        via: '1.1 relay.andrewos.com',
        location: 'https://relay.andrewos.com/widget.js',
      },
    }));
    const { response, status, text } = await call(
      '/rt/v1/bug/widget.js?p=not-roundtable&x=1',
      { fetchImpl },
    );
    expect(status).toBe(200);
    expect(text).toBe('/* widget */');
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('via')).toBeNull();
    expect(`${response.headers}`).not.toContain('relay.andrewos.com');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(RELAY_WIDGET);
    expect(fetchImpl.mock.calls[0][1].method).toBe('GET');
    expect(fetchImpl.mock.calls[0][1].headers).toBeUndefined();
  });

  it('forwards Origin and CF-Connecting-IP, and passes status and body back', async () => {
    const origins = [
      'https://roundtable.lol',
      'https://www.roundtable.lol',
      'https://rt.andrewos.com',
    ];
    for (const origin of origins) {
      const fetchImpl = vi.fn(async () => new Response('{"ok":true}', {
        status: 202,
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'session=leak',
          location: 'https://relay.andrewos.com/api/projects/roundtable/feedback',
        },
      }));
      const { response, status, text } = await call(`${FEEDBACK_PATH}?extra=1`, {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json; charset=utf-8',
          'cf-connecting-ip': '203.0.113.10',
          'x-forwarded-for': '198.51.100.4',
          cookie: 'session=secret',
          authorization: 'Bearer secret-token',
        },
        body: JSON.stringify({ title: 'Broken seat', body: 'The vote hung.' }),
        fetchImpl,
      });
      expect(status).toBe(202);
      expect(text).toBe('{"ok":true}');
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(response.headers.get('location')).toBeNull();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [target, init] = fetchImpl.mock.calls[0];
      expect(target).toBe(RELAY_FEEDBACK);
      expect(init.method).toBe('POST');
      expect(headerNames(init.headers)).toEqual(['content-type', 'origin', 'x-forwarded-for']);
      expect(init.headers.get('origin')).toBe(origin);
      expect(init.headers.get('x-forwarded-for')).toBe('203.0.113.10');
      expect(init.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(init.headers.get('cookie')).toBeNull();
      expect(init.headers.get('authorization')).toBeNull();
      expect(new TextDecoder().decode(init.body)).toBe(
        JSON.stringify({ title: 'Broken seat', body: 'The vote hung.' }),
      );
    }
  });

  it('proxies OPTIONS and echoes upstream CORS headers', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': 'https://roundtable.lol',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type',
        'access-control-max-age': '600',
        vary: 'Origin',
        via: '1.1 relay.andrewos.com',
      },
    }));
    const { response, status, text } = await call(FEEDBACK_PATH, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://roundtable.lol',
        'access-control-request-method': 'POST',
        'cf-connecting-ip': '203.0.113.10',
        cookie: 'session=secret',
        authorization: 'Bearer secret-token',
      },
      fetchImpl,
    });
    expect(status).toBe(204);
    expect(text).toBe('');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://roundtable.lol');
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type');
    expect(response.headers.get('access-control-max-age')).toBe('600');
    expect(response.headers.get('vary')).toBe('Origin');
    expect(response.headers.get('via')).toBeNull();
    const [target, init] = fetchImpl.mock.calls[0];
    expect(target).toBe(RELAY_FEEDBACK);
    expect(init.method).toBe('OPTIONS');
    expect(init.body).toBeUndefined();
    expect(headerNames(init.headers)).toEqual(['origin', 'x-forwarded-for']);
    expect(init.headers.get('origin')).toBe('https://roundtable.lol');
    expect(init.headers.get('cookie')).toBeNull();
    expect(init.headers.get('authorization')).toBeNull();
  });

  it('rejects feedback bodies over 8 MB with 413', async () => {
    const fetchImpl = vi.fn();
    const declared = await call(FEEDBACK_PATH, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(MAX_FEEDBACK_BYTES + 1),
      },
      body: '{}',
      fetchImpl,
    });
    expect(declared.status).toBe(413);
    expect(declared.json).toEqual({ error: 'payload_too_large' });
    expect(fetchImpl).not.toHaveBeenCalled();

    const bytes = new Uint8Array(MAX_FEEDBACK_BYTES + 1);
    const request = new Request(`https://roundtable.lol${FEEDBACK_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: bytes,
    });
    request.headers.delete('content-length');
    const streamed = await handleRequest(request, {}, { fetchImpl });
    expect(streamed.status).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();

    const exact = new Uint8Array(MAX_FEEDBACK_BYTES);
    const allowed = vi.fn(async (_url, init) => {
      expect(init.body.byteLength).toBe(MAX_FEEDBACK_BYTES);
      return new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const ok = await call(FEEDBACK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: exact,
      fetchImpl: allowed,
    });
    expect(ok.status).toBe(200);
    expect(allowed).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for every other /rt/v1/bug path', async () => {
    const blocked = [
      ['GET', '/rt/v1/bug/other.js'],
      ['POST', '/rt/v1/bug/widget.js'],
      ['GET', FEEDBACK_PATH],
      ['PUT', FEEDBACK_PATH],
      ['POST', '/rt/v1/bug/api/projects/other/feedback'],
      ['POST', `${FEEDBACK_PATH}/extra`],
      ['GET', '/rt/v1/bug'],
    ];
    for (const [method, path] of blocked) {
      const fetchImpl = vi.fn();
      const { status, json } = await call(path, { method, fetchImpl, body: method === 'GET' ? undefined : '{}' });
      expect(status, `${method} ${path}`).toBe(404);
      expect(json.error).toBe('not_found');
      expect(json.path).toBe(path);
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it('returns a generic 502 when the upstream fetch fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connect failed https://relay.andrewos.com/widget.js?p=roundtable');
    });
    const widget = await call('/rt/v1/bug/widget.js', { fetchImpl });
    expect(widget.status).toBe(502);
    expect(widget.json).toEqual({ error: 'Bug report is temporarily unavailable.' });
    expect(widget.text).not.toContain('relay.andrewos.com');
    expect(`${widget.response.headers}`).not.toContain('relay.andrewos.com');

    const feedback = await call(FEEDBACK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://roundtable.lol' },
      body: '{"title":"x"}',
      fetchImpl,
    });
    expect(feedback.status).toBe(502);
    expect(feedback.text).not.toContain('relay.andrewos.com');
    expect(feedback.json.error).toBe('Bug report is temporarily unavailable.');
  });

  it('keeps unrelated OPTIONS on the generic preflight', async () => {
    const fetchImpl = vi.fn();
    const response = await handleRequest(
      new Request('https://roundtable.lol/rt/v1/health', { method: 'OPTIONS' }),
      {},
      { fetchImpl },
    );
    expect(response.status).toBe(204);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('serves bug routes from the worker before static assets', async () => {
    const fetchImpl = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('/* widget */', {
      status: 200,
      headers: { 'content-type': 'application/javascript; charset=utf-8' },
    }));
    const assets = { fetch: vi.fn(async () => new Response('asset', { status: 200 })) };
    try {
      const response = await worker.fetch(
        new Request('https://roundtable.lol/rt/v1/bug/widget.js?p=other'),
        { ASSETS: assets },
        {},
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('/* widget */');
      expect(response.headers.get('cache-control')).toBe('public, max-age=300');
      expect(assets.fetch).not.toHaveBeenCalled();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fetchImpl.mock.calls[0][0]).toBe(RELAY_WIDGET);
    } finally {
      fetchImpl.mockRestore();
    }
  });

  it('redirects www bug routes to apex before proxying', async () => {
    const fetchImpl = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('should not fetch'));
    try {
      const response = await worker.fetch(
        new Request('https://www.roundtable.lol/rt/v1/bug/widget.js?p=other'),
        {},
        {},
      );
      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe(
        'https://roundtable.lol/rt/v1/bug/widget.js?p=other',
      );
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      fetchImpl.mockRestore();
    }
  });

  it('ships the widget script without the relay hostname in markup', () => {
    const html = readFileSync('roundtable/index.html', 'utf8');
    expect(html).toContain('<script src="/rt/v1/bug/widget.js" defer></script>');
    expect(html).not.toContain('relay.andrewos.com');
    expect(html).not.toMatch(/content-security-policy/i);
  });
});
