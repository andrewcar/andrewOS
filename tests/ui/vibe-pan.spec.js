import { test, expect } from '@playwright/test';

async function touchDrag(page, from, to, steps = 12) {
  await page.evaluate(
    ({ from, to, steps }) => {
      const el = document.querySelector('canvas.webgl');
      const makeTouch = (x, y) =>
        new Touch({
          identifier: 1,
          target: el,
          clientX: x,
          clientY: y,
          pageX: x,
          pageY: y,
          radiusX: 2.5,
          radiusY: 2.5,
          rotationAngle: 0,
          force: 1,
        });

      const fire = (type, x, y) => {
        const touch = makeTouch(x, y);
        const active = type === 'touchend' ? [] : [touch];
        el.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: active,
            targetTouches: active,
            changedTouches: [touch],
          })
        );
      };

      fire('touchstart', from.x, from.y);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        fire('touchmove', from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      }
      fire('touchend', to.x, to.y);
    },
    { from, to, steps }
  );
}

test.describe('vibe pan sensitivity', () => {
  test('touch look sensitivity is 0.005 (+25% vs 0.004)', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/vibe/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('canvas.webgl')).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => page.evaluate(() => window.__vibecadeDebug?.touchLookSensitivity), {
        timeout: 45_000,
      })
      .toBe(0.005);

    const sensitivity = await page.evaluate(() => window.__vibecadeDebug.touchLookSensitivity);
    expect(sensitivity / 0.004).toBeCloseTo(1.25, 5);
  });

  test('right-half touch drag rotates camera', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    // Touch-look is a mobile gesture; desktop uses mouse + pointer lock instead.
    test.skip(
      testInfo.project.name !== 'mobile-chromium',
      'touch pan drag only applies on the mobile project'
    );

    await page.goto('/vibe/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('canvas.webgl')).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => page.evaluate(() => window.__vibecadeDebug?.touchLookSensitivity), {
        timeout: 45_000,
      })
      .toBeTruthy();

    await page.waitForTimeout(3000);

    const before = await page.evaluate(() => window.__vibecadeDebug.getCameraYawPitch());
    const box = await page.locator('canvas.webgl').boundingBox();
    expect(box).toBeTruthy();

    const startX = box.x + box.width * 0.8;
    const startY = box.y + box.height * 0.45;
    await touchDrag(page, { x: startX, y: startY }, { x: startX - 160, y: startY });

    await expect
      .poll(
        async () => {
          const after = await page.evaluate(() => window.__vibecadeDebug.getCameraYawPitch());
          return Math.abs(after.yaw - before.yaw);
        },
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0.05);
  });
});
