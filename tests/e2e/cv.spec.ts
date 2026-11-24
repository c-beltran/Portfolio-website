import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { titleFor } from '../../lib/deskRoutes';
import { atNight, gotoDesk, hotspot, panelTitle, path } from './desk';

/** The six review windows. */
const VIEWPORTS: [number, number][] = [
  [1920, 1080],
  [1280, 800],
  [768, 1024],
  [390, 844],
  [2560, 720],
  [844, 390],
];

test.describe('the name on the monitor', () => {
  test.skip(({ isMobile }) => isMobile, 'the window matrix runs in the desktop project');

  for (const [W, H] of VIEWPORTS) {
    test(`${W}×${H}: the page's h1 sits on the monitor's right half`, async ({ page }) => {
      await page.setViewportSize({ width: W, height: H });
      await gotoDesk(page, '/');
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toHaveCount(1);
      await expect(h1).toHaveText('Carlos Beltran');
      const n = (await h1.boundingBox())!;
      const cv = (await hotspot(page, 'cv').boundingBox())!;
      expect(n.x).toBeGreaterThanOrEqual(cv.x - 1);
      expect(n.y).toBeGreaterThanOrEqual(cv.y - 1);
      expect(n.x + n.width).toBeLessThanOrEqual(cv.x + cv.width + 1);
      expect(n.y + n.height).toBeLessThanOrEqual(cv.y + cv.height + 1);
    });
  }
});

test.describe('the title under the name stays readable on small screens', () => {
  test.skip(({ isMobile }) => isMobile, 'window sizes set here');
  for (const [W, H] of [
    [844, 390],
    [320, 480],
  ] as const) {
    test(`${W}×${H}`, async ({ page }) => {
      await page.setViewportSize({ width: W, height: H });
      await gotoDesk(page, '/');
      const title = page.locator('.monitor-name__title');
      expect(
        await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(9);
      const t = (await title.boundingBox())!;
      const cv = (await hotspot(page, 'cv').boundingBox())!;
      expect(t.y + t.height).toBeLessThanOrEqual(cv.y + cv.height);
      expect(t.x + t.width).toBeLessThanOrEqual(cv.x + cv.width);
    });
  }
});

for (const theme of ['day', 'lamp'] as const) {
  test(`axe passes on / and /cv in ${theme}`, async ({ page }) => {
    if (theme === 'lamp') await atNight(page);
    for (const url of ['/', '/cv']) {
      await gotoDesk(page, url);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .exclude('.desk-still__layer')
        .analyze();
      expect(results.violations, url).toEqual([]);
    }
  });
}

test('/cv loads with its panel open: the ten-second facts and the Classic version', async ({
  page,
}) => {
  await gotoDesk(page, '/cv');
  await expect(page).toHaveTitle(titleFor('cv'));
  await expect(panelTitle(page)).toBeVisible();
  const panel = page.locator('section.panel');
  await expect(panel).toContainText('Go · backend & performance');
  await expect(panel.getByRole('link', { name: /Classic version/ })).toHaveAttribute(
    'href',
    '/classic',
  );
  await expect(hotspot(page, 'cv')).toHaveAttribute('aria-pressed', 'true');
});

test('the monitor is two objects: How I build on the left, the CV on the right', async ({
  page,
}) => {
  await gotoDesk(page, '/');
  await hotspot(page, 'monitor').click();
  await expect.poll(() => path(page)).toBe('/how-i-build');
  await gotoDesk(page, '/');
  await hotspot(page, 'cv').click();
  await expect.poll(() => path(page)).toBe('/cv');
});
