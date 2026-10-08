import { expect, test } from '@playwright/test';

test.describe('round table', () => {
  test('serves root-safe assets under /roundtable/', async ({ page }) => {
    const pageRes = await page.goto('/roundtable/');
    expect(pageRes?.ok()).toBeTruthy();
    await expect(page).toHaveTitle('Round Table');
    const favicon = await page.request.get('/roundtable/favicon.svg');
    expect(favicon.ok()).toBeTruthy();
    const png = await page.request.get('/roundtable/favicon.png');
    expect(png.ok()).toBeTruthy();
    const manifest = await page.request.get('/roundtable/site.webmanifest');
    expect(manifest.ok()).toBeTruthy();
    const css = await page.request.get('/roundtable/styles.css?v=8');
    expect(css.ok()).toBeTruthy();
    const js = await page.request.get('/roundtable/js/app.js?v=8');
    expect(js.ok()).toBeTruthy();
    const html = await page.content();
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('./favicon.svg?v=8');
    expect(html).toContain('./favicon.png?v=8');
    expect(html).not.toContain('href="/favicon.png"');
  });

  test('plans in view of the table, then docks chat at top center', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    await page.goto('/roundtable/');
    await expect(page).toHaveTitle('Round Table');
    expect(page.url()).not.toContain('relay.andrewos.com');

    await page.getByLabel('Display name').fill('Ada');
    await page.getByLabel('Email').fill(`ada-${testInfo.project.name}@example.com`);
    await page.getByLabel('Password').fill('correct-horse');
    await page.getByTestId('auth-form').getByRole('button', { name: 'Create account' }).click();

    await page.getByRole('banner').getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByTestId('keys-empty')).toBeVisible();
    await expect(page.getByText('Not set').first()).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByTestId('sound-toggle').click();
    await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-label', 'Sound off');
    await page.getByTestId('sound-toggle').click();
    await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-label', 'Sound on');

    const layout = page.getByTestId('stage-layout');
    await expect(layout).toHaveAttribute('data-focus', 'table');
    await page.getByTestId('confirm-seats').click();
    const prompt = page.getByTestId('prompt-card');
    await expect(prompt).toBeVisible();
    await expect(page.getByTestId('prompt-textarea')).toHaveAttribute('placeholder', /Describe the/);
    const overlap = await page.evaluate(() => {
      const table = document.querySelector('[data-testid="round-table"]').getBoundingClientRect();
      const card = document.querySelector('[data-testid="prompt-card"]').getBoundingClientRect();
      const width = Math.max(0, Math.min(table.right, card.right) - Math.max(table.left, card.left));
      const height = Math.max(0, Math.min(table.bottom, card.bottom) - Math.max(table.top, card.top));
      return width * height;
    });
    expect(overlap).toBe(0);
    if (!testInfo.project.name.startsWith('mobile')) {
      await expect(prompt).toBeInViewport();
    }

    await page.getByTestId('prompt-textarea').fill('Design a settings page for provider keys');
    await page.getByTestId('prompt-submit').click();
    await expect(page.getByTestId('planning-feed')).toContainText(/thinking/i);
    await expect(page.getByTestId('proposal-card')).toHaveCount(0);
    await expect(page.getByTestId('proposal-card')).toBeVisible();
    await expect(page.getByTestId('planning-feed')).not.toContainText(/thinking/i);
    await page.getByTestId('call-vote').click();
    await expect(page.getByTestId('planning-feed')).toContainText(/weighing/i);
    await expect(layout).toHaveAttribute('data-phase', 'ready');
    await expect(page.getByTestId('planning-feed')).not.toContainText(/weighing|thinking/i);
    const approve = page.getByTestId('approve-plan');
    await approve.click();
    await expect(layout).toHaveAttribute('data-focus', 'chat');

    await expect(layout).toHaveAttribute('data-focus', 'chat');
    await expect(layout).toHaveAttribute('data-phase-status', 'done');
    const table = await page.getByTestId('round-table').boundingBox();
    const viewport = page.viewportSize();
    expect(table).toBeTruthy();
    expect(Math.abs(table.x + table.width / 2 - viewport.width / 2)).toBeLessThan(16);
    expect(table.y).toBeGreaterThan(40);
    expect(table.y).toBeLessThan(220);
    expect(table.x).toBeGreaterThan(24);

    const scroller = page.getByTestId('chat-panel');
    const before = await page.getByTestId('round-table').boundingBox();
    await scroller.evaluate((element) => { element.scrollTop = 0; });
    await scroller.evaluate((element) => { element.scrollTop = 100; });
    const scrolled = await scroller.evaluate((element) => element.scrollTop);
    expect(scrolled).toBeGreaterThan(20);
    const after = await page.getByTestId('round-table').boundingBox();
    expect(Math.abs(after.x - before.x)).toBeLessThan(1);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);

    await expect(page.locator('.bubble').first()).toBeVisible();
    const msg = page.locator('.msg').last();
    const reply = msg.locator('.reply-btn');
    await msg.evaluate((element) => {
      const scroller = element.closest('[data-testid="chat-panel"]');
      const dock = document.querySelector('[data-testid="round-table"]')?.getBoundingClientRect();
      const clearTop = (dock?.bottom ?? 0) + 24;
      const top = element.getBoundingClientRect().top;
      scroller.scrollTop += top - clearTop;
    });
    if (testInfo.project.name.startsWith('mobile')) {
      await expect.poll(async () => reply.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
    } else {
      await expect.poll(async () => reply.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeLessThan(0.2);
      await msg.hover();
      await expect.poll(async () => reply.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.9);
    }

    const heldScroll = await scroller.evaluate((element) => element.scrollTop);
    await page.getByTestId('table-center').click();
    await expect(layout).toHaveAttribute('data-focus', 'table');
    await expect(page.getByTestId('seat-muse')).toBeVisible();
    const muse = page.getByTestId('seat-muse');
    await muse.click();
    await expect(muse).toHaveAttribute('aria-label', /Enable Muse/);
    await page.getByTestId('table-center').click();
    await expect.poll(async () => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(heldScroll - 2);
    await expect(layout).toHaveAttribute('data-focus', 'chat');
    await expect(page.getByTestId('seat-target-muse')).toHaveCount(0);
    await expect(page.getByTestId('seat-target-codex')).toBeVisible();
    await page.getByTestId('table-center').click();
    await page.getByTestId('seat-muse').click();
    await page.getByTestId('table-center').click();
    await expect(page.getByTestId('seat-target-muse')).toBeVisible();

    await page.getByTestId('seat-target-codex').click();
    await expect(page.getByTestId('target-chip')).toContainText('Codex');
    await msg.hover();
    await reply.click();
    const composer = page.getByTestId('composer-textarea');
    await composer.fill('keep');
    await composer.press('Shift+Enter');
    await expect(composer).toHaveValue('keep\n');
    await composer.fill('Where should we start?');
    await composer.press('Enter');
    await expect(composer).toHaveValue('');
    await expect(page.locator('.bubble', { hasText: 'Where should we start?' })).toHaveCount(1);
    await expect(page.getByTestId('status-strip')).toContainText(/thinking|working|handoff|Opening|Live/i);
    await expect(page.locator('.bubble').last()).toContainText(/start|share|cut|%/i, { timeout: 15_000 });
  });

  test('uses the arbiter picked on the seats card', async ({ page }, testInfo) => {
    test.setTimeout(45_000);
    await page.goto('/roundtable/');
    await page.getByLabel('Display name').fill('Ada');
    await page.getByLabel('Email').fill(`arbiter-${testInfo.project.name}@example.com`);
    await page.getByLabel('Password').fill('correct-horse');
    await page.getByTestId('auth-form').getByRole('button', { name: 'Create account' }).click();

    const arbiter = page.getByTestId('arbiter-select');
    await expect(arbiter).toHaveValue('botbot');
    await arbiter.selectOption('claude');
    await expect(arbiter).toHaveValue('claude');
    await expect(page.getByTestId('arbiter-note')).toContainText(/Claude has no API key/i);

    await page.getByRole('banner').getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByTestId('arbiter-key-note')).toContainText(/Claude is the arbiter and has no key/i);
    await page.getByRole('button', { name: 'Back' }).click();

    await page.getByTestId('new-table').click();
    await page.getByTestId('new-table').click();
    await expect(page.getByTestId('arbiter-select')).toHaveValue('claude');
    await page.getByTestId('confirm-seats').click();
    await expect(page.getByTestId('arbiter-select')).toHaveValue('claude');
    await page.getByTestId('prompt-textarea').fill('Sketch a landing page');
    await page.getByTestId('prompt-submit').click();
    await expect(page.getByTestId('planning-feed')).toContainText(/Claude is thinking/i);
    await expect(page.getByTestId('planning-feed')).toContainText(/Claude has no API key/i);
    await expect(page.getByTestId('proposal-card')).toContainText(/Claude/);
    await expect(page.getByTestId('proposal-card')).toContainText(/preview/i);

    await page.reload();
    await expect(page.getByTestId('proposal-card')).toContainText(/Claude/);
    await page.getByTestId('call-vote').click();
    await page.getByTestId('approve-plan').click();
    const chat = page.getByTestId('chat-panel');
    const handoff = page.locator('.msg', { hasText: /Claude is handing off to/ });
    await expect(chat).toContainText(/Claude: Plan approved/);
    await expect(handoff.first()).toBeVisible();
    await expect(handoff.first().locator('.seat-icon')).toHaveText('CL');
    await expect(page.locator('.status-line', { hasText: /Handing off to/ })).toHaveCount(0);
    await expect(chat).not.toContainText(/BotBot|CodexBot|ClaudeBot|GeminiBot|MuseBot|DeepSeekBot/);
    await expect(page.locator('.msg', { hasText: /Taking / }).first().locator('.seat-icon')).not.toHaveText('⬡');
    expect(page.url()).not.toContain('relay.andrewos.com');
  });
});
