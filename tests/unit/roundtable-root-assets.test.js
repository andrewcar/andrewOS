/**
 * Cheap check: serve roundtable/ as a standalone site root and assert key assets 200.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';

const PORT = 4198;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await sleep(100);
  }
  throw new Error(`server did not start: ${url}`);
}

describe('roundtable static root serve', () => {
  it('serves UI shell and relative assets without 404', async () => {
    const child = spawn(
      'npx',
      ['serve', 'roundtable', '-l', String(PORT), '--no-clipboard'],
      { stdio: ['ignore', 'pipe', 'pipe'], cwd: process.cwd() },
    );
    try {
      await waitForServer(`${BASE}/`);
      const paths = [
        '/',
        '/favicon.svg',
        '/favicon.png',
        '/favicon.ico',
        '/favicon-16.png',
        '/favicon-32.png',
        '/apple-touch-icon.png',
        '/icon-192.png',
        '/icon-512.png',
        '/icon-512-maskable.png',
        '/site.webmanifest',
        '/styles.css',
        '/js/app.js',
        '/js/canonical-home.js',
      ];
      for (const path of paths) {
        const res = await fetch(`${BASE}${path}`);
        expect(res.status, path).toBe(200);
      }
      const html = await (await fetch(`${BASE}/`)).text();
      expect(html).toContain('Round Table');
      expect(html).toContain('./favicon.svg?v=9');
      expect(html).toContain('./favicon.png?v=9');
      expect(html).not.toContain('href="/favicon.png"');
      expect(html).toContain('?v=9');
    } finally {
      child.kill('SIGTERM');
      await sleep(50);
    }
  }, 30_000);
});
