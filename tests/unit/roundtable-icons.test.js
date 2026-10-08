import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function pngSize(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(buffer.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe('round table icons', () => {
  it('ships an original svg and sized png fallbacks', () => {
    const svg = readFileSync('roundtable/favicon.svg', 'utf8');
    expect(svg).toContain('#0b0c10');
    expect(svg).toContain('#e4b363');
    expect(svg).toContain('<circle');
    expect(svg).not.toMatch(/andrewOS/i);

    expect(pngSize(readFileSync('roundtable/favicon-16.png'))).toEqual({ width: 16, height: 16 });
    expect(pngSize(readFileSync('roundtable/favicon-32.png'))).toEqual({ width: 32, height: 32 });
    expect(pngSize(readFileSync('roundtable/favicon.png'))).toEqual({ width: 32, height: 32 });
    expect(pngSize(readFileSync('roundtable/apple-touch-icon.png'))).toEqual({ width: 180, height: 180 });
    expect(pngSize(readFileSync('roundtable/icon-192.png'))).toEqual({ width: 192, height: 192 });
    expect(pngSize(readFileSync('roundtable/icon-512.png'))).toEqual({ width: 512, height: 512 });
    expect(pngSize(readFileSync('roundtable/icon-512-maskable.png'))).toEqual({ width: 512, height: 512 });

    const ico = readFileSync('roundtable/favicon.ico');
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);

    const root = createHash('sha256').update(readFileSync('favicon.png')).digest('hex');
    const round = createHash('sha256').update(readFileSync('roundtable/favicon.png')).digest('hex');
    expect(round).not.toBe(root);
  });

  it('points the manifest at the round table icons', () => {
    const manifest = JSON.parse(readFileSync('roundtable/site.webmanifest', 'utf8'));
    expect(manifest.name).toBe('Round Table');
    expect(manifest.theme_color).toBe('#0b0c10');
    expect(manifest.icons.map((icon) => icon.src)).toEqual([
      'icon-192.png?v=10',
      'icon-512.png?v=10',
      'icon-512-maskable.png?v=10',
    ]);
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(false);
      expect(icon.src).toContain('?v=10');
    }
  });
});