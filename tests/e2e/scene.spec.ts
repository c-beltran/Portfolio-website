import { DESK_OBJECTS } from '../../content/objects';
import { expect, test, type Page } from './fixtures';
import { gotoDesk, hotspot, panelTitle, path } from './desk';

/** The live scene: product code under /scene. */

test('the lab page is gone', async ({ request }) => {
  expect((await request.get('/lab/monitor')).status()).toBe(404);
});

test('serves the live scene', async ({ request }) => {
  expect((await request.get('/scene/scene.glb')).status()).toBe(200);
});

/** The ?tier=2 preview: the live scene over the still, under the hotspots. */
const live = (page: Page) => page.locator('.desk-still__live');
const canvas = (page: Page) => page.locator('.desk-still__live canvas');

async function waitLive(page: Page) {
  await expect(canvas(page)).toHaveCount(1, { timeout: 20_000 });
  await expect(live(page)).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
  await expect.poll(() => live(page).evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
}

const canvasAspect = (page: Page) =>
  canvas(page).evaluate((c: HTMLCanvasElement) => c.width / c.height);

test('capture=master without tier=2 mounts nothing', async ({ page }) => {
  await gotoDesk(page, '/?capture=master');
  await page.waitForTimeout(500);
  await expect(page.locator('.desk-still__live canvas')).toHaveCount(0);
});

test('without the flag, no three.js loads', async ({ page }) => {
  const scene: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/scene/')) scene.push(r.url());
  });
  await gotoDesk(page, '/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // past browser idle
  await expect(page.locator('.desk-still__live canvas')).toHaveCount(0);
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

test('?tier=2: the canvas is the window, through a resize into a phone and back', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await gotoDesk(page, '/?tier=2');
  await waitLive(page);
  const box = async () => (await canvas(page).boundingBox())!;
  expect(await box()).toMatchObject({ x: 0, y: 0, width: 1920, height: 1080 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => canvasAspect(page)).toBeCloseTo(390 / 844, 2);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => canvasAspect(page)).toBeCloseTo(1280 / 800, 2);
});

/** The glance's overlay shift, written on .desk-still, read on the layer. */
const gx = (page: Page) =>
  page
    .locator('.desk-still__layer')
    .evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--gx') || '0'));

test.describe('?tier=2: your head follows the cursor', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse');
  // Its waits run to 20 s; under the full suite (with the live coming-forward tests),
  // headless WebGL is slow enough that the default 30 s test budget cut them short.
  test.slow();

  test('the cursor at the right edge turns the view right, and the hotspots go with it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoDesk(page, '/?tier=2');
    await waitLive(page);
    await page.mouse.move(960, 540);
    await expect.poll(() => gx(page)).toBeCloseTo(0, 0);
    const before = (await hotspot(page, 'kit').boundingBox())!.x;
    const g0 = await gx(page);
    await page.mouse.move(1915, 540);
    // Headless WebGL (software rendering, trace capture) runs a frame or two a second here, so the
    // damping that settles in about a second on a GPU takes longer: allow for it.
    await expect.poll(() => gx(page), { timeout: 15_000 }).toBeLessThan(-5);
    // The glance and the kit's place read together, from one frame, once it has settled.
    const read = () =>
      page.evaluate(() => ({
        g: parseFloat(
          getComputedStyle(document.querySelector('.desk-still__layer')!).getPropertyValue(
            '--gx',
          ) || '0',
        ),
        x: document.querySelector('.hotspot[data-item="kit"]')!.getBoundingClientRect().x,
      }));
    let last = await read();
    await expect
      .poll(
        async () => {
          const now = await read();
          const settled = Math.abs(now.g - last.g) < 0.05;
          last = now;
          return settled;
        },
        { timeout: 20_000 },
      )
      .toBe(true);
    expect(Math.abs(last.x - before - (last.g - g0))).toBeLessThanOrEqual(2);
  });

  test('with reduced motion there is no glance', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDesk(page, '/?tier=2');
    await waitLive(page);
    await page.mouse.move(5, 5);
    await page.mouse.move(1270, 790);
    await page.waitForTimeout(600);
    expect(await gx(page)).toBe(0);
  });
});

test('?tier=2: touch never turns the view', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch');
  await gotoDesk(page, '/?tier=2');
  await waitLive(page);
  await page.touchscreen.tap(20, 300);
  await page.locator('.desk-still').dispatchEvent('touchstart');
  await page.locator('.desk-still').dispatchEvent('touchmove');
  await page.waitForTimeout(600);
  expect(await gx(page)).toBe(0);
});

test('?tier=2 in a portrait window: the live view follows the swipe', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'one window size is enough');
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoDesk(page, '/?tier=2');
  await waitLive(page);
  const centred = await canvas(page).screenshot();
  await page
    .locator('.desk-still')
    .evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
  await expect.poll(async () => (await canvas(page).screenshot()).equals(centred)).toBe(false);
  // The canvas stays on the window while the desk scrolls under it.
  expect(await canvas(page).boundingBox()).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
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
    await expect(page.locator('.desk-still__live canvas')).toHaveCount(0);
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
  await expect(page.locator('.desk-still__live canvas')).toHaveCount(0);
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
