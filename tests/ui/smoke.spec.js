import { test, expect } from '@playwright/test';

test('site root responds', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/andrewOS/i);
});
