#!/usr/bin/env node
/**
 * Rasterize roundtable/favicon.svg into PNG fallbacks and favicon.ico.
 * Run from the repo root: node scripts/render-roundtable-icons.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(resolve(root, 'roundtable/favicon.svg'), 'utf8');
const outDir = resolve(root, 'roundtable');

function pageHtml(size, { padded = false } = {}) {
  const art = padded ? Math.round(size * 0.78) : size;
  const offset = Math.round((size - art) / 2);
  return `<!doctype html>
<html>
<head>
  <style>
    html, body { margin: 0; background: #0b0c10; }
    .frame { width: ${size}px; height: ${size}px; background: #0b0c10; }
    svg { display: block; width: ${art}px; height: ${art}px; margin: ${offset}px; }
  </style>
</head>
<body>
  <div class="frame">${svg}</div>
</body>
</html>`;
}

async function raster(page, size, padded) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(pageHtml(size, { padded }), { waitUntil: 'load' });
  return page.locator('.frame').screenshot({
    type: 'png',
    omitBackground: false,
  });
}

function pngIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = 6 + 16 * count;
  const entries = [];
  for (const { size, buffer } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buffer.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.buffer)]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

const tight = {};
for (const size of [16, 32, 180, 192, 512]) {
  tight[size] = await raster(page, size, false);
}
const padded512 = await raster(page, 512, true);

await browser.close();

writeFileSync(resolve(outDir, 'favicon-16.png'), tight[16]);
writeFileSync(resolve(outDir, 'favicon-32.png'), tight[32]);
writeFileSync(resolve(outDir, 'favicon.png'), tight[32]);
writeFileSync(resolve(outDir, 'apple-touch-icon.png'), tight[180]);
writeFileSync(resolve(outDir, 'icon-192.png'), tight[192]);
writeFileSync(resolve(outDir, 'icon-512.png'), tight[512]);
writeFileSync(resolve(outDir, 'icon-512-maskable.png'), padded512);
writeFileSync(resolve(outDir, 'favicon.ico'), pngIco([
  { size: 16, buffer: tight[16] },
  { size: 32, buffer: tight[32] },
]));

console.log('wrote roundtable icon pngs + favicon.ico');
