import { test as withHint } from '@playwright/test';
import { expect, test, type Page } from './fixtures';
import { gotoDesk, hotspot } from './desk';

/** Computed opacity of each object's tape label, by data-item. */
const labels = (page: Page) =>
  page
    .locator('button.hotspot')
    .evaluateAll((els) =>
      Object.fromEntries(
        els.map((el) => [
          (el as HTMLElement).dataset.item!,
          Number(getComputedStyle(el.querySelector('.sticker')!).opacity),
        ]),
      ),
    );
const shown = async (page: Page) =>
  Object.entries(await labels(page))
    .filter(([, o]) => o > 0.99)
    .map(([k]) => k)
    .sort();
const centre = async (page: Page, item: string) => {
  const b = (await hotspot(page, item).boundingBox())!;
  return [b.x + b.width / 2, b.y + b.height / 2] as const;
};

/** Tab through the Sections list to a button, as a keyboard visitor does. */
async function tabTo(page: Page, label: string) {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === label) return;
  }
  throw new Error(`Tab never reached ${label}`);
}

test.describe('with a mouse', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer: fine');

  test('labels are hidden at rest; the one near the cursor fades in, and out again', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    expect(await shown(page)).toEqual([]);
    for (const o of Object.values(await labels(page))) expect(o).toBe(0);
    const [x, y] = await centre(page, 'kit');
    await page.mouse.move(x, y - 40);
    await expect.poll(() => shown(page), { timeout: 500 }).toEqual(['kit']);
    await page.mouse.move(8, 10);
    await expect.poll(() => shown(page)).toEqual([]);
  });

  test("the open object's label stays visible", async ({ page }) => {
    await gotoDesk(page, '/experience');
    await page.mouse.move(8, 10);
    await expect.poll(() => shown(page)).toEqual(['badge']);
  });

  test('an object that came forward has no label on the desk', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    const [x, y] = await centre(page, 'phone');
    await page.mouse.move(x, y);
    await page.mouse.move(8, 10);
    await expect.poll(() => shown(page)).toEqual([]);
  });

  test('opened with the mouse and closed with Esc: the Sections card stays hidden', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'kit').click();
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe('/potaflow');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe('/');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    await expect(nav.getByRole('button', { name: 'Potaflow' })).toBeFocused();
    expect((await nav.boundingBox())!.width).toBeLessThanOrEqual(1);
    await page.keyboard.press('Tab'); // and a real keyboard step shows it
    await expect.poll(async () => (await nav.boundingBox())!.width).toBeGreaterThan(100);
  });

  test("keyboard focus on a section shows that object's label", async ({ page }) => {
    await gotoDesk(page, '/');
    await tabTo(page, 'Potaflow');
    await expect.poll(() => shown(page)).toEqual(['kit']);
  });

  test('in a portrait window, focusing a section pans its object into view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoDesk(page, '/');
    await page
      .locator('.desk-still')
      .evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
    await tabTo(page, 'This site');
    await expect
      .poll(async () => {
        const b = (await hotspot(page, 'notepad').boundingBox())!;
        return b.x >= 0 && b.x + b.width <= 390;
      })
      .toBe(true);
  });

  test('with reduced motion, labels never transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDesk(page, '/');
    const durations = await page
      .locator('.sticker')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).transitionDuration));
    for (const d of durations) expect(d.split(',').every((s) => parseFloat(s) === 0)).toBe(true);
  });
});

test.describe('on a touch screen', () => {
  test.skip(({ isMobile }) => !isMobile, 'pointer: coarse, hover: none');

  test('every label shows on arrival, then fades', async ({ page }) => {
    await gotoDesk(page, '/');
    const all = (await page.locator('button.hotspot').count()) > 0;
    expect(all).toBe(true);
    await expect
      .poll(async () => (await shown(page)).length)
      .toBe(await page.locator('.sticker').count());
    await page.waitForTimeout(3000);
    expect(await shown(page)).toEqual([]);
  });
});

withHint(
  'on a touch screen, the labels show as the turn-sideways hint ends',
  async ({ page, isMobile }) => {
    withHint.skip(!isMobile, 'touch only');
    await gotoDesk(page, '/');
    await expect(page.locator('.turn-hint')).toBeVisible();
    await page.waitForTimeout(2000);
    expect(await shown(page)).toEqual([]);
    await expect(page.locator('.turn-hint')).toBeHidden({ timeout: 4000 });
    await expect
      .poll(async () => (await shown(page)).length)
      .toBe(await page.locator('.sticker').count());
  },
);
