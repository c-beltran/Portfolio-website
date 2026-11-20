import { expect, test, type Page } from '@playwright/test';
import { gotoDesk, path } from './desk';

/** The turn-sideways hint (design 2026-11-19 §3.5): an upright touch screen, on the desk itself. */
const hint = (page: Page) => page.locator('.turn-hint');
const opacity = (page: Page) => hint(page).evaluate((el) => Number(getComputedStyle(el).opacity));

test.describe('on an upright phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch screens only');
  test.use({ viewport: { width: 390, height: 844 } });

  test('grays the desk out on arrival, then goes away by itself', async ({ page }) => {
    await gotoDesk(page, '/');
    await page.waitForTimeout(500);
    await expect(hint(page)).toBeVisible();
    expect(await opacity(page)).toBeGreaterThan(0.5);
    await expect(hint(page)).toBeHidden({ timeout: 4500 });
  });

  test('a tap dismisses it, and opens nothing underneath', async ({ page }) => {
    await gotoDesk(page, '/');
    await page.waitForTimeout(1000);
    await hint(page).tap();
    await expect(hint(page)).toBeHidden();
    await page.waitForTimeout(300);
    expect(path(page)).toBe('/');
  });

  test('shows once per visit: a reload in the same tab has none', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(hint(page)).toBeHidden({ timeout: 5000 });
    await page.reload();
    await page.waitForTimeout(500);
    await expect(hint(page)).toBeHidden();
  });

  test('not on a section route', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    await page.waitForTimeout(500);
    await expect(hint(page)).toBeHidden();
  });

  test('with reduced motion it appears without fading, and still goes away', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDesk(page, '/');
    await page.waitForTimeout(200);
    expect(await opacity(page)).toBe(1);
    await expect(hint(page)).toBeHidden({ timeout: 4800 });
  });
});

test('not on a phone held sideways', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch screens only');
  await page.setViewportSize({ width: 844, height: 390 });
  await gotoDesk(page, '/');
  await page.waitForTimeout(500);
  await expect(hint(page)).toBeHidden();
});

test('not with a mouse, even in a narrow window', async ({ page, isMobile }) => {
  test.skip(isMobile, 'pointer: fine');
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoDesk(page, '/');
  await page.waitForTimeout(500);
  await expect(hint(page)).toBeHidden();
});
