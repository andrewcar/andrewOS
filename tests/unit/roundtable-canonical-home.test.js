import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildApexRedirectUrl,
  shouldRedirectAndrewOsHost,
  CANONICAL_ORIGIN,
} from '../../roundtable/js/canonical-home.js';

describe('canonical home redirect helpers', () => {
  it('only targets andrewos.com hosts', () => {
    expect(shouldRedirectAndrewOsHost('andrewos.com')).toBe(true);
    expect(shouldRedirectAndrewOsHost('www.andrewos.com')).toBe(true);
    expect(shouldRedirectAndrewOsHost('localhost')).toBe(false);
    expect(shouldRedirectAndrewOsHost('127.0.0.1')).toBe(false);
    expect(shouldRedirectAndrewOsHost('roundtable.lol')).toBe(false);
  });

  it('maps /roundtable paths to apex', () => {
    expect(
      buildApexRedirectUrl({
        hostname: 'andrewos.com',
        pathname: '/roundtable',
        search: '',
        hash: '',
      }),
    ).toBe(`${CANONICAL_ORIGIN}/`);
    expect(
      buildApexRedirectUrl({
        hostname: 'www.andrewos.com',
        pathname: '/roundtable/',
        search: '?v=8',
        hash: '#seats',
      }),
    ).toBe(`${CANONICAL_ORIGIN}/?v=8#seats`);
    expect(
      buildApexRedirectUrl({
        hostname: 'andrewos.com',
        pathname: '/roundtable/js/app.js',
        search: '',
        hash: '',
      }),
    ).toBe(`${CANONICAL_ORIGIN}/js/app.js`);
  });

  it('does not redirect localhost', () => {
    expect(
      buildApexRedirectUrl({
        hostname: 'localhost',
        pathname: '/roundtable/',
        search: '',
        hash: '',
      }),
    ).toBeNull();
  });

  it('index.html is root-safe and pins canonical + cache-bust v=8', () => {
    const html = readFileSync(resolve('roundtable/index.html'), 'utf8');
    expect(html).toContain('rel="canonical" href="https://roundtable.lol/"');
    expect(html).toContain('href="./favicon.svg?v=8"');
    expect(html).toContain('href="./favicon.png?v=8"');
    expect(html).toContain('href="./site.webmanifest?v=8"');
    expect(html).toContain('apple-touch-icon');
    expect(html).not.toContain('href="/favicon.png"');
    expect(html).not.toContain('href="/favicon.svg"');
    expect(html).toContain('styles.css?v=8');
    expect(html).toContain('app.js?v=8');
    expect(html).not.toContain('?v=7');
    expect(html).toMatch(/location\.replace\(\s*['"]https:\/\/roundtable\.lol['"]/);
    expect(html).toMatch(/andrewos\.com/);
  });
});
