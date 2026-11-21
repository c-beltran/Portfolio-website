import sharp from 'sharp';
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
type Box = { x: number; y: number; width: number; height: number };
/** A page region's pixels (RGB, 0–255), the region clamped to the viewport. */
async function pixels(page: Page, r: Box) {
  const v = page.viewportSize()!;
  const [x, y] = [Math.max(0, r.x), Math.max(0, r.y)];
  const clip = {
    x,
    y,
    width: Math.min(v.width, r.x + r.width) - x,
    height: Math.min(v.height, r.y + r.height) - y,
  };
  return sharp(await page.screenshot({ clip }))
    .removeAlpha()
    .raw()
    .toBuffer();
}
const mean = (a: Buffer) => a.reduce((s, c) => s + c, 0) / a.length;
const meanDiff = (a: Buffer, b: Buffer) =>
  a.reduce((s, c, k) => s + Math.abs(c - (b[k] ?? 0)), 0) / a.length;

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

  // Carlos, 2026-11-21: "the glow is impacting the way the objects look. the glow should be on the
  // edges not the item … the toolbox also glows and so does the paper."
  test('the glow lies around the object, never on it', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(glow(page, 'kit')).toHaveCount(1, { timeout: 10_000 });
    // the tape label sits on the object; it is the same with or without the glow
    await page.addStyleTag({ content: '.sticker { visibility: hidden !important; }' });
    for (const item of ['kit', 'notepad']) {
      const b = (await hotspot(page, item).boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await expect.poll(() => lit(page)).toEqual([item]);
      await page.waitForTimeout(400); // the glow's fade and the glance settle
      const middle = { x: b.x + b.width / 2 - 6, y: b.y + b.height / 2 - 6, width: 12, height: 12 };
      const around = { x: b.x - 30, y: b.y - 30, width: b.width + 60, height: b.height + 60 };
      const [onMiddle, onAround] = [await pixels(page, middle), await pixels(page, around)];
      const hide = (v: string) =>
        page
          .locator('.desk-glow')
          .evaluateAll(
            (els, v) => els.forEach((el) => ((el as HTMLElement).style.visibility = v)),
            v,
          );
      await hide('hidden');
      const [offMiddle, offAround] = [await pixels(page, middle), await pixels(page, around)];
      await hide('');
      expect(
        meanDiff(onMiddle, offMiddle),
        `${item}: its middle changes under the glow`,
      ).toBeLessThan(0.5);
      expect(mean(onAround) - mean(offAround), `${item}: no glow around it`).toBeGreaterThan(1);
    }
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
