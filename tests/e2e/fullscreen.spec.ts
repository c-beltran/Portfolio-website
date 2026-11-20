import { expect, test, type Page } from '@playwright/test';
import seat from '../../content/scene/bounds-seat.json' with { type: 'json' };
import { viewOffset } from '../../content/scene/framing';
import { DESK_OBJECTS } from '../../content/objects';
import { desk, gotoDesk, hotspot } from './desk';

/** The design's review windows (16:9 first), the plan's six (Task 4). */
const VIEWPORTS: [number, number][] = [
  [1920, 1080],
  [1280, 800],
  [768, 1024],
  [390, 844],
  [2560, 720],
  [844, 390],
];
const ITEMS = ['cv', 'photo', 'badge', 'monitor', 'kit', 'phone', 'notepad', 'card', 'lightbar'];
const objects = seat.objects as Record<string, { x0: number; y0: number; x1: number; y1: number }>;

/** The desk's pan (−1…1) from its horizontal scroll; 0 when it can't scroll. */
const panOf = (page: Page) =>
  desk(page).evaluate((el) => {
    const max = el.scrollWidth - el.clientWidth;
    return max > 0 ? (el.scrollLeft / max) * 2 - 1 : 0;
  });

/** Every hotspot sits where framing.ts puts its object, at this window and pan (±2 px). */
async function expectHotspotsOnTheirObjects(page: Page) {
  const { W, H } = await page.evaluate(() => ({ W: innerWidth, H: innerHeight }));
  const o = viewOffset(W / H, W, H, await panOf(page));
  for (const item of ITEMS) {
    const b = objects[`obj_${item}`]!;
    const r = (await hotspot(page, item).boundingBox())!;
    const cx = ((b.x0 + b.x1) / 2) * o.fullW - o.x;
    const cy = ((b.y0 + b.y1) / 2) * o.fullH - o.y;
    expect(Math.abs(r.x + r.width / 2 - cx), `${item} x`).toBeLessThanOrEqual(2);
    expect(Math.abs(r.y + r.height / 2 - cy), `${item} y`).toBeLessThanOrEqual(2);
  }
}

test.describe('the desk fills the window', () => {
  test.skip(({ isMobile }) => isMobile, 'the window matrix runs in the desktop project');

  for (const [W, H] of VIEWPORTS) {
    test(`${W}×${H}`, async ({ page }) => {
      await page.setViewportSize({ width: W, height: H });
      await gotoDesk(page, '/');
      const img = page.locator('.desk-still__photo--day img');
      const r = (await img.boundingBox())!;
      expect(r.x).toBeLessThanOrEqual(0.5);
      expect(r.y).toBeLessThanOrEqual(0.5);
      expect(r.x + r.width).toBeGreaterThanOrEqual(W - 0.5);
      expect(r.y + r.height).toBeGreaterThanOrEqual(H - 0.5);
      expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBe(H);
      await expect(page.locator('header.site-header')).toHaveCount(0);
      await expectHotspotsOnTheirObjects(page);
    });
  }

  for (const [W, H] of [
    [390, 844],
    [768, 1024],
  ] as const) {
    test(`${W}×${H} pans across the safe frame, starting centred`, async ({ page }) => {
      await page.setViewportSize({ width: W, height: H });
      await gotoDesk(page, '/');
      const sw = await desk(page).evaluate((el) => el.scrollWidth);
      expect(Math.abs(sw - 1.6 * H)).toBeLessThanOrEqual(2);
      expect(Math.abs(await panOf(page))).toBeLessThanOrEqual(0.01);

      await desk(page).evaluate((el) => el.scrollTo({ left: 0, behavior: 'instant' }));
      const notepad = (await hotspot(page, 'notepad').boundingBox())!;
      expect(notepad.x).toBeGreaterThanOrEqual(0);
      expect(notepad.x + notepad.width).toBeLessThanOrEqual(W);
      await expectHotspotsOnTheirObjects(page);

      await desk(page).evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
      const card = (await hotspot(page, 'card').boundingBox())!;
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(W);
      await expectHotspotsOnTheirObjects(page);
    });
  }

  test('a height change keeps the pan', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoDesk(page, '/');
    await desk(page).evaluate((el) =>
      el.scrollTo({ left: (el.scrollWidth - el.clientWidth) * 0.25, behavior: 'instant' }),
    );
    await expect.poll(() => panOf(page)).toBeCloseTo(-0.5, 2);
    await page.setViewportSize({ width: 390, height: 700 });
    await expect.poll(async () => Math.abs((await panOf(page)) + 0.5)).toBeLessThanOrEqual(0.02);
  });

  test('crossing 6:5 swaps the portrait strip and the wide still, and realigns', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 952, height: 800 }); // 1.19
    await gotoDesk(page, '/');
    const src = () =>
      page
        .locator('.desk-still__photo--day img')
        .evaluate((i) => (i as HTMLImageElement).currentSrc);
    await expect.poll(src).toContain('/stills/seat-p-day-');
    await expectHotspotsOnTheirObjects(page);
    await page.setViewportSize({ width: 968, height: 800 }); // 1.21
    await expect.poll(src).toContain('/stills/seat-b0-day-');
    await expectHotspotsOnTheirObjects(page);
  });

  test('the keyboard path: the first Tab shows the Sections list; every section, then Lamp', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    await page.keyboard.press('Tab');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    const first = nav.getByRole('button').first();
    await expect(first).toBeFocused();
    const r = (await first.boundingBox())!;
    expect(r.width).toBeGreaterThan(0);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(1280);
    expect(r.y + r.height).toBeLessThanOrEqual(800);
    const buttons = nav.getByRole('button');
    await expect(buttons).toHaveCount(DESK_OBJECTS.length + 1);
    await expect(buttons.last()).toHaveText('Lamp');
    await expect(buttons.last()).toHaveAttribute('aria-pressed', /true|false/);
  });
});

test('/classic keeps the header: name, résumé or its TODO, and the lamp toggle', async ({
  page,
}) => {
  await page.goto('/classic');
  const header = page.locator('header.site-header');
  await expect(header.getByRole('heading', { level: 1 })).toHaveText('Carlos Beltran');
  await expect(header.getByText(/résumé|TODO/i).first()).toBeVisible();
  await expect(header.locator('.lamp-toggle')).toBeVisible();
});

test('a phone sees the desk edge to edge, straight ahead', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone project only');
  await gotoDesk(page, '/');
  const { W, H } = await page.evaluate(() => ({ W: innerWidth, H: innerHeight }));
  const r = (await page.locator('.desk-still__photo--day img').boundingBox())!;
  expect(r.x).toBeLessThanOrEqual(0.5);
  expect(r.x + r.width).toBeGreaterThanOrEqual(W - 0.5);
  expect(r.y + r.height).toBeGreaterThanOrEqual(H - 0.5);
  expect(Math.abs(await panOf(page))).toBeLessThanOrEqual(0.01);
  await expectHotspotsOnTheirObjects(page);
});
