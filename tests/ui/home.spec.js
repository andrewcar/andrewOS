import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertColorNear, samplePixels } from '../helpers/samplePixels.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '../../ai/logs/2/screenshots');

test.describe('landing page', () => {
  test.beforeEach(async ({ page }) => {
    // Keep third-party Ko-fi out of the critical path so load is deterministic.
    await page.route('https://storage.ko-fi.com/**', async (route) => {
      if (route.request().url().includes('overlay-widget.js')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: 'window.kofiWidgetOverlay = { draw() {} };',
        });
        return;
      }
      await route.abort();
    });
  });

  test('loads cleanly with title, ascii art, and working anchors', async ({ page }, testInfo) => {
    const consoleErrors = [];
    const failedRequests = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('requestfailed', (req) => {
      const url = req.url();
      // Ignore aborted third-party stubs
      if (url.includes('ko-fi.com')) return;
      failedRequests.push(`${req.failure()?.errorText ?? 'failed'}: ${url}`);
    });

    const response = await page.goto('/');
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle('andrewOS');

    const ascii = page.locator('.ascii-art');
    await expect(ascii).toBeVisible();
    await expect(ascii).not.toBeEmpty();
    const asciiText = await ascii.innerText();
    expect(asciiText.length).toBeGreaterThan(20);

    // Wait for typewriter header (spaces are &nbsp; in the animated spans)
    await expect(page.locator('.header')).toContainText(/Let's/, { timeout: 15_000 });
    await expect(page.locator('.header')).toContainText(/something/i);
    await expect(page.locator('.madlib')).toHaveClass(/fade-in/, { timeout: 10_000 });
    await expect(page.locator('.initial-button')).toHaveClass(/fade-in/);
    await expect(page.locator('a.shell-entry')).toHaveClass(/fade-in/);

    const anchors = page.locator('a[href]');
    const count = await anchors.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await anchors.nth(i).getAttribute('href');
      expect(href, `anchor ${i} missing href`).toBeTruthy();
      if (/^https?:\/\//i.test(href)) {
        expect(href).toMatch(/^https?:\/\/\S+/i);
        continue;
      }
      // Local path — resolve against baseURL
      const local = await page.request.get(href.startsWith('/') ? href : `/${href}`);
      expect(local.ok(), `local anchor failed: ${href}`).toBeTruthy();
    }

    // Favicon
    const favicon = await page.request.get('/favicon.png');
    expect(favicon.ok()).toBeTruthy();

    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
    expect(failedRequests, `failed requests:\n${failedRequests.join('\n')}`).toEqual([]);

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const shotPath = join(SCREENSHOT_DIR, `home-${testInfo.project.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    const [bg] = samplePixels(shotPath, [{ label: 'body-bg', x: 0.92, y: 0.08 }]);
    assertColorNear(bg, '#FAF4E8', 18);
  });

  async function settledHeader(page) {
    const raw = await page.locator('.header').innerText();
    return raw.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  test('thank-you header drops leftover something. letters', async ({ page }, testInfo) => {
    await page.route('https://formspree.io/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );

    await page.goto('/');
    await expect(page.locator('.header')).toContainText(/something/i, { timeout: 15_000 });

    await page.evaluate(() => {
      const header = document.querySelector('.header');
      window.typeHeaderText(header, "Let's build<br>something.");
      window.typeHeaderText(header, "Thanks!<br>I'll be in touch.");
    });

    await expect
      .poll(async () => settledHeader(page), { timeout: 10_000 })
      .toBe("Thanks! I'll be in touch.");

    const overlapText = await settledHeader(page);
    expect(overlapText).not.toMatch(/h\.I|thing\.I|something/i);

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `thank-you-overlap-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('submit settles on Thanks! I\'ll be in touch.', async ({ page }, testInfo) => {
    await page.route('https://formspree.io/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    );

    await page.goto('/');
    await expect(page.locator('.initial-button')).toHaveClass(/fade-in/, { timeout: 15_000 });
    await page.locator('.initial-button').click();
    await expect
      .poll(async () => settledHeader(page), { timeout: 15_000 })
      .toBe('Want me to follow up?');
    await expect(page.locator('.send-button')).toBeVisible();
    await page.locator('#contact').fill('qa@example.com');
    await page.locator('.send-button').click();

    await expect
      .poll(async () => settledHeader(page), { timeout: 15_000 })
      .toBe("Thanks! I'll be in touch.");

    const thanksText = await settledHeader(page);
    expect(thanksText).not.toMatch(/h\.I|thing\.I|something/i);

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const shotPath = join(SCREENSHOT_DIR, `thank-you-submit-${testInfo.project.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
  });

  async function madlibPlaceholders(page, { waitForFade } = { waitForFade: true }) {
    await page.waitForFunction(() => Boolean(document.getElementById('what')?.placeholder), null, {
      timeout: 10_000,
    });
    if (waitForFade) {
      await expect(page.locator('.madlib')).toHaveClass(/fade-in/, { timeout: 15_000 });
    }
    return page.evaluate(() => ({
      what: document.getElementById('what').placeholder,
      does: document.getElementById('does').placeholder,
      pool: window.MADLIB_PLACEHOLDERS,
    }));
  }

  test('madlib placeholder pool is complete and applied', async ({ page }, testInfo) => {
    await page.goto('/');
    const { what, does, pool } = await madlibPlaceholders(page);
    expect(pool.length).toBeGreaterThanOrEqual(8);
    for (const pair of pool) {
      expect(pair).toHaveLength(2);
      expect(String(pair[0]).trim()).not.toBe('');
      expect(String(pair[1]).trim()).not.toBe('');
    }
    expect(pool).toContainEqual([what, does]);

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `madlib-pool-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('madlib picker can show the last pair', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Math.random = () => 0.999999;
    });
    await page.goto('/');
    const { what, does, pool } = await madlibPlaceholders(page);
    expect([what, does]).toEqual(pool[pool.length - 1]);

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `madlib-last-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('shell prompt is the visible door into the terminal', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.goto('/');

    const entry = page.locator('a.shell-entry');
    await expect(entry).toHaveClass(/fade-in/, { timeout: 15_000 });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText('guest@andrewos:~$');
    await expect(entry).toContainText('open terminal');
    await expect(entry).toHaveAttribute('href', '/terminal.html');
    await expect(entry.locator('.shell-cursor')).toBeAttached();

    const ascii = page.locator('.ascii-art');
    await expect(ascii).toHaveAttribute('onclick', /openAndrewTerminal/);

    await entry.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/terminal$/);
    await expect(page.locator('.terminal')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.terminal-output')).toContainText('Build 302', { timeout: 20_000 });

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `terminal-entry-keyboard-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('shell prompt click uses the same terminal swap', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.goto('/');
    const entry = page.locator('a.shell-entry');
    await expect(entry).toHaveClass(/fade-in/, { timeout: 15_000 });

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `terminal-entry-home-${testInfo.project.name}.png`),
      fullPage: true,
    });

    await entry.click();
    await expect(page).toHaveURL(/\/terminal$/);
    await expect(page.locator('.terminal')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.terminal-output')).toContainText('Build 302', { timeout: 20_000 });
  });

  test('madlib reloads never show empty placeholders', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      Math.random = () => {
        const n = window.MADLIB_PLACEHOLDERS?.length || 1;
        const raw = Number(sessionStorage.getItem('madlib-i') || '0');
        sessionStorage.setItem('madlib-i', String(raw + 1));
        return (raw % n) / n;
      };
    });

    const reloads = testInfo.project.name === 'desktop-chromium' ? 12 : 1;
    const seen = new Set();
    for (let r = 0; r < reloads; r += 1) {
      await page.goto('/');
      const { what, does } = await madlibPlaceholders(page, { waitForFade: false });
      expect(what.trim()).not.toBe('');
      expect(does.trim()).not.toBe('');
      seen.add(`${what}|||${does}`);
    }
    if (reloads >= 8) {
      expect(seen.size).toBeGreaterThanOrEqual(8);
    }
  });
});
