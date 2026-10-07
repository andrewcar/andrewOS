import { describe, expect, it } from 'vitest';
import { wwwToApexRedirect, APEX_HOST, WWW_HOST } from '../../workers/rt/src/www-redirect.js';
import worker from '../../workers/rt/src/index.js';
import { createMemoryStore } from '../../workers/rt/src/store.js';

const SECRET = 'test-session-secret-32chars!!';

describe('www → apex redirect', () => {
  it('301s www.roundtable.lol to apex preserving path and query', () => {
    const request = new Request(`https://${WWW_HOST}/rt/v1/health?x=1`);
    const response = wwwToApexRedirect(request);
    expect(response).toBeTruthy();
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(`https://${APEX_HOST}/rt/v1/health?x=1`);
  });

  it('301s www UI paths to apex', () => {
    const request = new Request(`https://${WWW_HOST}/styles.css?v=7`);
    const response = wwwToApexRedirect(request);
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(`https://${APEX_HOST}/styles.css?v=7`);
  });

  it('does not redirect apex or other hosts', () => {
    expect(wwwToApexRedirect(new Request(`https://${APEX_HOST}/`))).toBeNull();
    expect(wwwToApexRedirect(new Request('https://rt.andrewos.com/rt/v1/health'))).toBeNull();
    expect(wwwToApexRedirect(new Request('http://127.0.0.1:8787/'))).toBeNull();
  });

  it('Worker entry applies www redirect before API handling', async () => {
    const env = { RT_SESSION_SECRET: SECRET, __store: createMemoryStore() };
    const response = await worker.fetch(
      new Request(`https://${WWW_HOST}/rt/v1/health`),
      env,
      {},
    );
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe(`https://${APEX_HOST}/rt/v1/health`);
  });
});
