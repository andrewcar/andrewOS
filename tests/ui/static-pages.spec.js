import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '../../ai/logs/4/screenshots');

test.describe('static pages', () => {
  test('boredgames and ruleofthree support pages render with CSS', async ({ page }, testInfo) => {
    const pages = [
      {
        path: '/boredgames/support.html',
        title: 'Bored Games',
        heading: /BORED[\s\u00a0]GAMES/i,
        css: '/boredgames/support.css',
        shot: 'boredgames-support',
      },
      {
        path: '/ruleofthree/support.html',
        title: 'Rule of Three',
        heading: /RULE[\s\u00a0]OF[\s\u00a0]THREE/i,
        css: '/ruleofthree/support.css',
        shot: 'ruleofthree-support',
      },
    ];

    mkdirSync(SCREENSHOT_DIR, { recursive: true });

    for (const spec of pages) {
      const cssResponse = page.waitForResponse(
        (res) => res.url().includes(spec.css) && res.request().resourceType() === 'stylesheet'
      );
      const response = await page.goto(spec.path);
      expect(response?.ok(), spec.path).toBeTruthy();
      await expect(page).toHaveTitle(spec.title);

      const css = await cssResponse;
      expect(css.ok(), `${spec.css} failed`).toBeTruthy();
      expect(css.headers()['content-type'] ?? '').toMatch(/text\/css/i);

      await expect(page.locator('.terminal-output')).toContainText(spec.heading, {
        timeout: 15_000,
      });

      await page.screenshot({
        path: join(SCREENSHOT_DIR, `${spec.shot}-${testInfo.project.name}.png`),
        fullPage: true,
      });
    }
  });

  test('boredgames and ruleofthree privacy pages render headings', async ({ page }) => {
    for (const path of ['/boredgames/privacypolicy.html', '/ruleofthree/privacypolicy.html']) {
      const response = await page.goto(path);
      expect(response?.ok(), path).toBeTruthy();
      await expect(page.locator('[data-custom-class="title"]')).toContainText(/PRIVACY NOTICE/i);
    }
  });

  test('docs assets return 200 with correct content types', async ({ request }) => {
    const pdf = await request.get('/docs/cv.pdf');
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()['content-type'] ?? '').toMatch(/application\/pdf|octet-stream/i);
    const pdfBody = await pdf.body();
    expect(pdfBody.subarray(0, 4).toString('utf8')).toBe('%PDF');

    const txt = await request.get('/docs/privacyPolicy.txt');
    expect(txt.ok()).toBeTruthy();
    expect(txt.headers()['content-type'] ?? '').toMatch(/text\/plain/i);
    const text = await txt.text();
    expect(text).toMatch(/Privacy Policy/i);
  });
});
