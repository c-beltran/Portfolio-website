import { DESK_OBJECTS } from '../../content/objects';
import { master } from '../../content/scene/framing';
import { expect, test, type Page } from '@playwright/test';
import { gotoDesk, hotspot, panelTitle, path } from './desk';

/** The live scene (spec §4): product code under /scene, the M3b lab gone. */

test('the M3b lab is gone', async ({ request }) => {
  expect((await request.get('/lab/monitor')).status()).toBe(404);
});

test('serves the live scene', async ({ request }) => {
  expect((await request.get('/scene/scene.glb')).status()).toBe(200);
});

/** The ?tier=2 preview (M3b): the live scene over the still, under the hotspots. */
const live = (page: Page) => page.locator('.desk-still__live');
const canvas = (page: Page) => page.locator('.desk-still__live canvas');

async function waitLive(page: Page) {
  await expect(canvas(page)).toHaveCount(1, { timeout: 20_000 });
  await expect(live(page)).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
  await expect.poll(() => live(page).evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
}

const canvasAspect = (page: Page) =>
  canvas(page).evaluate((c: HTMLCanvasElement) => c.width / c.height);

test('without the flag, no three.js loads', async ({ page }) => {
  const scene: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/scene/')) scene.push(r.url());
  });
  await gotoDesk(page, '/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // past browser idle
  await expect(page.locator('.desk-still canvas')).toHaveCount(0);
  expect(scene).toEqual([]);
  expect(await page.evaluate(() => '__THREE__' in window)).toBe(false);
});

test('?tier=2 mounts the live scene over the still', async ({ page }) => {
  await gotoDesk(page, '/?tier=2');
  await waitLive(page);
  expect(await page.evaluate(() => '__THREE__' in window)).toBe(true);
});

test('?tier=2 leaves the hotspots clickable', async ({ page }) => {
  await gotoDesk(page, '/?tier=2');
  await waitLive(page);
  expect(await live(page).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  await hotspot(page, 'kit').click();
  expect(path(page)).toBe('/potaflow');
  await expect(panelTitle(page)).toBeVisible();
});

// Until the live seat (M3c Task 7) frames the window with viewOffset, the canvas covers the seat
// master, so its shape is the master's at every window shape.
test('?tier=2 keeps the canvas on the seat master when the window turns into a phone and back', async ({
  page,
}) => {
  const masterAspect = master().w / master().h;
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoDesk(page, '/?tier=2');
  await waitLive(page);
  await expect.poll(() => canvasAspect(page)).toBeCloseTo(masterAspect, 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => canvasAspect(page)).toBeCloseTo(masterAspect, 2);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => canvasAspect(page)).toBeCloseTo(masterAspect, 2);
});

test.describe('?tier=2 without WebGL', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      delete w.WebGL2RenderingContext;
      delete w.WebGLRenderingContext;
      HTMLCanvasElement.prototype.getContext = () => null;
    });
  });

  test('keeps the still and no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await gotoDesk(page, '/?tier=2');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await expect(page.locator('.desk-still__photo--day img')).toBeVisible();
    await expect(page.locator('.desk-still canvas')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test('?tier=2 shows the lamp mode chosen before the scene was ready', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('desk-theme', 'lamp'));
  await gotoDesk(page, '/?tier=2');
  await waitLive(page);
  await expect(live(page)).toHaveAttribute('data-lamp', 'true');
});

test('/potaflow?tier=2 opens the panel and mounts the scene', async ({ page }) => {
  await gotoDesk(page, '/potaflow?tier=2');
  await expect(panelTitle(page)).toBeVisible();
  await waitLive(page);
});

test('?tier=2 falls back to the still when a scene asset fails to load', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/scene/bake/probe-day.webp', (r) => r.abort());
  await gotoDesk(page, '/?tier=2');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await expect(page.locator('.desk-still__photo--day img')).toBeVisible();
  await expect(page.locator('button.hotspot')).toHaveCount(DESK_OBJECTS.length + 1);
  await expect(page.locator('.desk-still canvas')).toHaveCount(0);
  await hotspot(page, 'kit').click();
  expect(path(page)).toBe('/potaflow');
});

test('?tier=2 leaves bare desk to the page: no pointer target, scroll and zoom intact', async ({
  page,
}) => {
  await gotoDesk(page, '/?tier=2');
  await waitLive(page);
  const hit = await page.locator('.desk-still__layer').evaluate((layer) => {
    // Bare wall at the window's left edge, halfway down.
    const el = document.elementFromPoint(8, innerHeight * 0.5)!;
    const touch = [...layer.querySelectorAll('.desk-still__live, .desk-still__live *')].map(
      (e) => getComputedStyle(e).touchAction,
    );
    return { inLive: !!el.closest('.desk-still__live'), touch };
  });
  expect(hit.inLive).toBe(false);
  expect(hit.touch).not.toContain('none');
});

test('?tier=2 with lamp chosen first: the scene is already lamp-lit when it appears', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('desk-theme', 'lamp');
    // The canvas's day↔lamp blend at the moment the layer turns visible.
    new MutationObserver((_, obs) => {
      const live = document.querySelector('.desk-still__live');
      if (live?.getAttribute('data-ready') !== 'true') return;
      (window as unknown as { fadeAtReady: string }).fadeAtReady =
        live.querySelector('canvas')?.dataset.fade ?? 'none';
      obs.disconnect();
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
  await gotoDesk(page, '/?tier=2');
  await waitLive(page);
  expect(
    await page.evaluate(() => (window as unknown as { fadeAtReady: string }).fadeAtReady),
  ).toBe('1.00');
});
