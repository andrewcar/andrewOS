import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '../../ai/logs/8/screenshots');

async function settledHeader(page) {
  const raw = await page.locator('.header').innerText();
  return raw.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

test.describe('voxbot creator feedback', () => {
  test('/feedback shows a separate feedback form, not the madlib', async ({ page }, testInfo) => {
    const response = await page.goto('/feedback');
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveTitle('andrewOS');

    await expect(page.locator('#what')).toHaveCount(0);
    await expect(page.locator('#does')).toHaveCount(0);
    await expect(page.locator('.madlib')).toHaveCount(0);
    await expect(page.locator('.initial-button')).toHaveCount(0);

    await expect(page.locator('#voxbot-feedback-form')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#feedback-message')).toBeVisible();
    await expect(page.locator('#feedback-name')).toBeVisible();
    await expect(page.locator('#feedback-contact')).toBeVisible();
    await expect(page.locator('#feedback-send')).toBeVisible();
    await expect(page.locator('#feedback-source')).toHaveValue('voxbot');

    await expect
      .poll(async () => settledHeader(page), { timeout: 15_000 })
      .toMatch(/savage/i);

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `feedback-page-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('stores source from query (source= or from=)', async ({ page }) => {
    await page.goto('/feedback?from=egg');
    await expect(page.locator('#feedback-source')).toHaveValue('egg');

    await page.goto('/feedback?source=homepage');
    await expect(page.locator('#feedback-source')).toHaveValue('homepage');
  });

  test('homepage button opens the feedback page without using madlib fields', async ({ page }, testInfo) => {
    await page.goto('/');
    const open = page.locator('.feedback-open-button');
    await expect(open).toHaveClass(/fade-in/, { timeout: 15_000 });
    await expect(open).toHaveAttribute('href', /\/feedback/);
    await open.click();
    await expect(page).toHaveURL(/\/feedback/);
    await expect(page.locator('#feedback-message')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#what')).toHaveCount(0);

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `feedback-from-home-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });

  test('?feedback=1 deep-links to /feedback and keeps source=voxbot', async ({ page }) => {
    await page.goto('/?feedback=1&source=voxbot');
    await expect(page).toHaveURL(/\/feedback\/?\?source=voxbot/);
    await expect(page.locator('#feedback-message')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#feedback-source')).toHaveValue('voxbot');
  });

  test('submit posts voxbot-feedback to Formspree and shows thanks', async ({ page }, testInfo) => {
    let posted = null;
    await page.route('https://formspree.io/**', async (route) => {
      posted = {
        url: route.request().url(),
        body: route.request().postDataJSON(),
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/feedback?source=voxbot');
    await expect(page.locator('#feedback-send')).toHaveClass(/fade-in/, { timeout: 15_000 });
    await page.locator('#feedback-message').fill('the voice is too pleased with itself');
    await page.locator('#feedback-name').fill('qa');
    await page.locator('#feedback-contact').fill('qa@example.com');
    await page.locator('#feedback-send').click();

    await expect
      .poll(() => posted, { timeout: 10_000 })
      .toBeTruthy();
    expect(posted.url).toBe('https://formspree.io/f/mwpljayb');
    expect(posted.body).toMatchObject({
      type: 'voxbot-feedback',
      form: 'voxbot-feedback',
      feedback: 'the voice is too pleased with itself',
      name: 'qa',
      contact: 'qa@example.com',
      source: 'voxbot',
    });
    expect(posted.body.idea).toBeUndefined();

    await expect
      .poll(async () => settledHeader(page), { timeout: 15_000 })
      .toBe("Thanks! I'll be in touch.");

    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: join(SCREENSHOT_DIR, `feedback-thanks-${testInfo.project.name}.png`),
      fullPage: true,
    });
  });
});
