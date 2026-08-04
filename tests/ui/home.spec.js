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
});
