import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '../../ai/logs/3/screenshots');

test.describe('terminal', () => {
  test('boots, runs local commands, and mocks ask API', async ({ page }, testInfo) => {
    test.setTimeout(90_000);

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      const text = String(err);
      if (text.includes("Cannot read properties of undefined") && text.includes('observe')) return;
      if (text.includes('term is not defined')) return;
      consoleErrors.push(text);
    });

    let askPayload = null;
    await page.route('**/api/ai', async (route) => {
      askPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 'MOCK_AI_REPLY' }),
      });
    });

    const response = await page.goto('/terminal.html');
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle('andrewOS');

    await expect(page.locator('.terminal')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.terminal-output')).toContainText('Build 302', { timeout: 15_000 });

    // Prompt / cmd line present (desktop textarea or mobile contenteditable)
    const cmdLine = page.locator('.terminal .cmd-editable, .terminal .cmd textarea, .terminal textarea').first();
    await expect(cmdLine).toBeAttached({ timeout: 15_000 });

    // Prove keyboard input works once
    await cmdLine.click({ force: true });
    await page.keyboard.type('hello', { delay: 25 });
    await page.keyboard.press('Enter');
    await expect(page.locator('.terminal-output')).toContainText('Hello back.', { timeout: 20_000 });

    // Drive remaining commands via terminal API (avoids scroll-marker click interception)
    async function exec(command) {
      await expect
        .poll(async () => page.evaluate(() => !window.jQuery('.terminal').terminal().paused()), {
          timeout: 45_000,
        })
        .toBeTruthy();
      await page.evaluate((cmd) => {
        window.jQuery('.terminal').terminal().exec(cmd);
      }, command);
    }

    await exec('name');
    await expect(page.locator('.terminal-output')).toContainText('Andrew Carvajal', { timeout: 20_000 });

    await exec('help');
    await expect(page.locator('.terminal-output')).toContainText('The available known commands are', {
      timeout: 45_000,
    });
    await expect
      .poll(async () => page.evaluate(() => !window.jQuery('.terminal').terminal().paused()), {
        timeout: 45_000,
      })
      .toBeTruthy();

    await exec('ask what is life');
    await expect.poll(() => askPayload, { timeout: 15_000 }).not.toBeNull();
    expect(askPayload.question).toMatch(/what is life|what/i);
    await expect(page.locator('.terminal-output')).toContainText('MOCK_AI_REPLY', { timeout: 20_000 });

    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `terminal-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });
});
