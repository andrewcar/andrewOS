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
});
