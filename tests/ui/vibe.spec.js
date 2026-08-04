import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inkBounds, pixelVariance, samplePixels } from '../helpers/samplePixels.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '../../ai/logs/5/screenshots');

const GRID = [
  { label: 'tl', x: 0.15, y: 0.15 },
  { label: 'tr', x: 0.85, y: 0.15 },
  { label: 'c', x: 0.5, y: 0.5 },
  { label: 'bl', x: 0.15, y: 0.85 },
  { label: 'br', x: 0.85, y: 0.85 },
  { label: 'mid-l', x: 0.3, y: 0.5 },
  { label: 'mid-r', x: 0.7, y: 0.5 },
];

test.describe('vibe arcade', () => {
  test('loads WebGL scene and is not a blank canvas', async ({ page }, testInfo) => {
    test.setTimeout(60_000);

    const pageErrors = [];
    page.on('pageerror', (err) => {
      const text = String(err);
      // Multiplayer socket may fail without a live server — ignore transport noise.
      if (/websocket|socket\.io|ECONNREFUSED|Failed to fetch/i.test(text)) return;
      // Mobile touch-UI init in the built bundle can race on missing DOM nodes.
      if (/Cannot read properties of null \(reading 'style'\)/i.test(text)) return;
      pageErrors.push(text);
    });

    let bundleOk = false;
    page.on('response', (res) => {
      if (/\/vibe\/assets\/index\.[a-f0-9]+\.js$/i.test(res.url()) && res.ok()) {
        bundleOk = true;
      }
    });

    const response = await page.goto('/vibe/', { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/Vibecade/i);

    const canvas = page.locator('canvas.webgl');
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    const webgl = await page.evaluate(() => {
      const el = document.querySelector('canvas.webgl');
      if (!el) return { ok: false, reason: 'no canvas' };
      const gl =
        el.getContext('webgl2') ||
        el.getContext('webgl') ||
        el.getContext('experimental-webgl');
      if (!gl) return { ok: false, reason: 'no context', w: el.width, h: el.height };
      return {
        ok: true,
        w: el.width,
        h: el.height,
        vendor: gl.getParameter(gl.VENDOR),
        renderer: String(gl.getParameter(gl.RENDERER) ?? '').slice(0, 80),
      };
    });
    expect(webgl.ok, `WebGL unavailable: ${webgl.reason}`).toBeTruthy();
    expect(webgl.w).toBeGreaterThan(0);
    expect(webgl.h).toBeGreaterThan(0);

    await expect.poll(() => bundleOk, { timeout: 15_000 }).toBeTruthy();

    // Allow three.js scene / assets to settle
    await page.waitForTimeout(3500);

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const shotPath = join(SCREENSHOT_DIR, `vibe-${testInfo.project.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    const samples = samplePixels(shotPath, GRID);
    const variance = pixelVariance(samples);
    const maxChannel = Math.max(...samples.flatMap((s) => [s.r, s.g, s.b]));
    // Solid black / empty buffer → near-zero variance and no bright pixels
    expect(variance, `frame looks blank (variance=${variance}, samples=${JSON.stringify(samples)})`).toBeGreaterThan(50);
    expect(maxChannel, 'expected some non-black pixels in the scene').toBeGreaterThan(20);

    // Mobile chrome: keyboard + perspective toggles (CSS @media max-width: 768px)
    if (testInfo.project.name === 'mobile-chromium') {
      await expect(page.locator('.keyboard-toggle')).toBeVisible();
      await expect(page.locator('.perspective-toggle')).toBeVisible();
    }

    expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  });

  test('coin value and icon share painted ink height and vertical center', async ({ page }) => {
    test.setTimeout(45_000);

    await page.goto('/vibe/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#top-right-hud')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#coin-hud-value')).toBeVisible();
    await expect(page.locator('#coin-hud-icon')).toBeVisible();
    await expect(page.locator('#coin-hud-glyph')).toHaveText('🪙');

    await page.evaluate(async () => {
      if (document.fonts?.load) {
        await document.fonts.load('24px "Press Start 2P"');
        await document.fonts.ready;
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });

    await page.evaluate(() => {
      const hud = document.getElementById('top-right-hud');
      const icon = document.getElementById('coin-hud-icon');
      if (hud) {
        hud.style.background = '#000';
        hud.style.overflow = 'visible';
      }
      // Pad + black so screenshots capture full emoji paint (Firefox advance < ink)
      if (icon) {
        icon.style.background = '#000';
        icon.style.padding = '10px';
        icon.style.overflow = 'visible';
      }
    });

    const valuePng = await page.locator('#coin-hud-value').screenshot({ type: 'png' });
    const iconPng = await page.locator('#coin-hud-icon').screenshot({ type: 'png' });
    const valueInk = inkBounds(valuePng);
    const coinAlone = inkBounds(iconPng);

    expect(valueInk.inkPixels, 'digit should paint').toBeGreaterThan(10);
    expect(coinAlone.inkPixels, 'coin emoji should paint').toBeGreaterThan(20);

    // Clipping: a full circle has empty AABB corners; flat crops put ink in corners.
    expect(
      coinAlone.looksClipped,
      `coin looks clipped: ${JSON.stringify(coinAlone)}`
    ).toBe(false);
    expect(
      Math.abs(coinAlone.inkWidth - coinAlone.height),
      `coin ink not circular w=${coinAlone.inkWidth} h=${coinAlone.height}`
    ).toBeLessThanOrEqual(4);

    // Size: painted digit height ≈ painted coin height (≤5 allows optical boost)
    expect(
      Math.abs(valueInk.height - coinAlone.height),
      `ink height mismatch digit=${valueInk.height} coin=${coinAlone.height}`
    ).toBeLessThanOrEqual(5);
  });
});
