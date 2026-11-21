import { expect, test, type Page } from './fixtures';
import { drawerButton, gotoDesk, hotspot } from './desk';

/**
 * The hover glow (Carlos, 2026-11-20): "the rectangular outlines do not look so good … make the
 * selections glow slightly instead". A soft warm glow follows the object's silhouette, on hover, on
 * the open object, with keyboard focus in the Sections list, and with the touch labels.
 */
const glow = (page: Page, item: string) => page.locator(`.desk-glow[data-item="${item}"]`);
const opacityOf = (page: Page, item: string) =>
  glow(page, item).evaluate((el) => Number(getComputedStyle(el).opacity));
const lit = (page: Page) =>
  page.locator('.desk-glow').evaluateAll((els) =>
    els
      .filter((el) => Number(getComputedStyle(el).opacity) > 0.99)
      .map((el) => (el as HTMLElement).dataset.item)
      .sort(),
  );

test.describe('with a mouse', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer: fine');

  test('hovering an object glows it, with no rectangle', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(glow(page, 'kit')).toHaveCount(1, { timeout: 10_000 });
    await hotspot(page, 'kit').hover();
    await expect.poll(() => lit(page)).toEqual(['kit']);
    expect(await hotspot(page, 'kit').evaluate((el) => getComputedStyle(el).boxShadow)).toBe(
      'none',
    );
    await page.mouse.move(8, 10);
    await expect.poll(() => lit(page)).toEqual([]);
  });

  test('the open object keeps its glow instead of a ring', async ({ page }) => {
    await gotoDesk(page, '/experience');
    await expect.poll(() => opacityOf(page, 'badge'), { timeout: 10_000 }).toBe(1);
    expect(await hotspot(page, 'badge').evaluate((el) => getComputedStyle(el).boxShadow)).toBe(
      'none',
    );
  });

  test('nothing glows while an object is out', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    await expect(glow(page, 'phone')).toHaveCount(1, { timeout: 10_000 });
    const b = (await hotspot(page, 'phone').boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(400);
    expect(await lit(page)).toEqual([]);
  });

  test('keyboard focus on a section glows its object', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(glow(page, 'kit')).toHaveCount(1, { timeout: 10_000 });
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Potaflow')
        break;
    }
    await expect(drawerButton(page, 'Potaflow')).toBeFocused();
    await expect.poll(() => lit(page)).toEqual(['kit']);
  });

  test('the glow images load after the page, never before it', async ({ page }) => {
    const seen: { url: string; at: number }[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/glow/')) seen.push({ url: r.url(), at: Date.now() });
    });
    let loaded = 0;
    page.on('load', () => (loaded = Date.now()));
    await gotoDesk(page, '/');
    await expect.poll(() => seen.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(loaded).toBeGreaterThan(0);
    for (const s of seen) expect(s.at).toBeGreaterThanOrEqual(loaded);
  });
});

test.describe('on a touch screen', () => {
  test.skip(({ isMobile }) => !isMobile, 'pointer: coarse, hover: none');

  test('the objects glow with their labels on arrival, then fade', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(glow(page, 'kit')).toHaveCount(1, { timeout: 10_000 });
    await expect.poll(async () => (await lit(page)).length, { timeout: 6000 }).toBeGreaterThan(5);
    await expect.poll(async () => (await lit(page)).length, { timeout: 8000 }).toBe(0);
  });
});
