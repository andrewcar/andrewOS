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
    await expect(page.locator('body')).toHaveAttribute('data-term-boot', 'ready', { timeout: 15_000 });
    await expect(page.locator('.terminal .cmd-prompt').first()).toContainText('guest@andrewos:~$');
    await expect(page.locator('.andrewos-banner')).toContainText('▄▄█▀▀██', { timeout: 15_000 });
    await expect(page.locator('.andrewos-banner')).toContainText('//// Build 302 ////');
    await expect(page.locator('.terminal-output')).toContainText('try help, ls, or ask');
    const phosphor = await page.locator('.terminal').evaluate((el) => getComputedStyle(el).getPropertyValue('--color'));
    expect(phosphor.replace(/\s/g, '')).toContain('0,200,0');
    const promptBox = await page.locator('.terminal .cmd-prompt').first().boundingBox();
    expect(promptBox).toBeTruthy();
    expect(promptBox.y + promptBox.height).toBeLessThan((page.viewportSize()?.height || 800) + 1);
    if (testInfo.project.name.includes('mobile')) {
      await expect(page.locator('.terminal-output')).not.toContainText('guest session');
    }
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el = document.activeElement;
          return Boolean(el && el.closest('.terminal, .cmd'));
        })
      )
      .toBeTruthy();

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

    await exec('ls');
    await expect(page.locator('.terminal-output')).toContainText('projects/', { timeout: 15_000 });
    await expect(page.locator('.terminal-output')).toContainText('littlefly/');
    await expect(page.locator('.terminal-output')).toContainText('feedback');

    await exec('cd projects');
    await expect(page.locator('.terminal .cmd-prompt').first()).toContainText('guest@andrewos:~/projects$', {
      timeout: 15_000,
    });
    await exec('ls');
    await expect(page.locator('.terminal-output')).toContainText('andrewos.txt', { timeout: 15_000 });
    await exec('cd ~');

    await exec('whoami');
    await expect(page.locator('.terminal-output')).toContainText('guest@andrewos', { timeout: 15_000 });
    await expect(page.locator('.terminal-output')).toContainText('(954) 292-5454');
    await exec('neofetch');
    await expect(page.locator('.terminal-output')).toContainText('andrew.carvajal@me.com');

    await exec('ask --help');
    await expect(page.locator('.terminal-output')).toContainText('ask <question>', { timeout: 20_000 });
    await expect(page.locator('.terminal-output')).toContainText('chunk');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);

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

  test('exit returns home with the shell door faded in and focused', async ({ page }) => {
    test.setTimeout(60_000);
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

    await page.goto('/terminal.html');
    await expect(page.locator('body')).toHaveAttribute('data-term-boot', 'ready', { timeout: 15_000 });
    await page.evaluate(() => {
      window.jQuery('.terminal').terminal().exec('exit');
    });
    await expect(page).toHaveURL(/\/$/);
    const shell = page.locator('a.shell-entry');
    await expect(shell).toHaveClass(/fade-in/, { timeout: 20_000 });
    await expect(shell).toContainText('guest@andrewos:~$');
    await expect(shell).toBeFocused();
    await expect(page.locator('.feedback-open-button')).toHaveClass(/fade-in/);

    await shell.click();
    await expect(page).toHaveURL(/\/terminal$/);
    await expect(page.locator('.terminal .cmd-prompt').first()).toContainText('guest@andrewos:~$', {
      timeout: 20_000,
    });
  });

  test('cold /terminal matches the terminal.html boot', async ({ page }) => {
    await page.goto('/terminal');
    await expect(page.locator('body')).toHaveAttribute('data-term-boot', 'ready', { timeout: 15_000 });
    await expect(page.locator('.terminal .cmd-prompt').first()).toContainText('guest@andrewos:~$');
    await expect(page.locator('.terminal-output')).toContainText('try help, ls, or ask');

    await page.goto('/terminal.html');
    await expect(page.locator('body')).toHaveAttribute('data-term-boot', 'ready', { timeout: 15_000 });
    await expect(page.locator('.terminal .cmd-prompt').first()).toContainText('guest@andrewos:~$');
  });

  test('reduced motion skips the boot fade and the shell blink', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/terminal.html');
    await expect(page.locator('body')).toHaveAttribute('data-term-boot', 'ready', { timeout: 15_000 });
    await expect(page.locator('body')).not.toHaveClass(/term-boot/);
    await expect(page.locator('.terminal .cmd-prompt').first()).toContainText('guest@andrewos:~$');

    await page.goto('/');
    const cursor = page.locator('.shell-cursor');
    await expect(page.locator('a.shell-entry')).toHaveClass(/fade-in/, { timeout: 15_000 });
    const animation = await cursor.evaluate((el) => getComputedStyle(el).animationName);
    expect(animation === 'none' || animation === '').toBeTruthy();
  });
});
