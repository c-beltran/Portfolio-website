import { expect, test, type Page } from './fixtures';
import { drawerButton, gotoDesk, path } from './desk';

/**
 * Coming forward in the live preview (design 2026-11-19 §4.1; plan M3c-forward Task 7): the 3D
 * object travels from its place on the desk to the panel's slot, then its clip plays; going back
 * reverses both from wherever they are. Read through the canvas's test hooks (Movers.tsx):
 * data-open, data-travel and data-clip (2 decimals), data-fit (the art box height it fitted to).
 * Headless WebGL runs few frames a second, so the waits are generous and the reads settled.
 */
/** Each wait: headless WebGL renders on the CPU, and under the full suite a frame can take seconds. */
const LONG = 40_000;
const canvas = (page: Page) => page.locator('.desk-still__live canvas');
const hook = (page: Page) =>
  canvas(page).evaluate((c: HTMLCanvasElement) => ({
    open: c.dataset.open ?? '',
    travel: Number(c.dataset.travel ?? NaN),
    clip: Number(c.dataset.clip ?? NaN),
    fit: Number(c.dataset.fit ?? NaN),
  }));
const gx = (page: Page) =>
  page
    .locator('.desk-still__layer')
    .evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--gx') || '0'));

async function waitLive(page: Page) {
  await expect(page.locator('.desk-still__live')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000,
  });
}

test.describe('coming forward live', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop preview');
  // Under the full suite's parallel load, headless WebGL can drop to about a frame a second.
  test.slow();
  test.use({ viewport: { width: 1280, height: 800 } });

  test('?tier=2: the kit comes out and opens, then goes back', async ({ page }) => {
    await gotoDesk(page, '/?tier=2');
    await waitLive(page);
    await drawerButton(page, 'Potaflow').press('Enter');
    await expect.poll(async () => (await hook(page)).open, { timeout: LONG }).toBe('kit');
    await expect.poll(async () => (await hook(page)).travel, { timeout: LONG }).toBe(1);
    await expect.poll(async () => (await hook(page)).clip, { timeout: LONG }).toBe(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => path(page)).toBe('/');
    await expect
      .poll(
        async () => {
          const h = await hook(page);
          return [h.travel, h.clip];
        },
        { timeout: LONG },
      )
      .toEqual([0, 0]);
  });

  test('?tier=2: a direct load of /potaflow starts with the kit already out', async ({ page }) => {
    await gotoDesk(page, '/potaflow?tier=2');
    await waitLive(page);
    const first = await hook(page);
    expect(first.open).toBe('kit');
    expect(first.travel).toBe(1);
    expect(first.clip).toBe(1);
  });

  test('?tier=2: Esc mid-move reverses without a jump', async ({ page }) => {
    await gotoDesk(page, '/?tier=2');
    await waitLive(page);
    await drawerButton(page, 'Potaflow').press('Enter');
    // In the page, frame by frame: Esc the moment the kit is a fifth of the way out, then watch.
    const { before, samples } = await page.evaluate(async () => {
      const c = document.querySelector<HTMLCanvasElement>('.desk-still__live canvas')!;
      let before = -1;
      const samples: number[] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 12_000) {
        await new Promise(requestAnimationFrame);
        const t = Number(c.dataset.travel);
        if (before < 0) {
          if (t > 0.2 && t < 1) {
            before = t;
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          }
          continue;
        }
        samples.push(t);
        if (t === 0) break;
      }
      return { before, samples };
    });
    expect(before).toBeGreaterThan(0.2);
    expect(before).toBeLessThan(1);
    // It turns within a few frames (the route change takes a frame or two to reach the scene) and
    // never jumps: no frame moves it more than one step (a frame counts at most 100 ms of 900).
    const all = [before, ...samples];
    for (let i = 1; i < all.length; i++)
      expect(Math.abs(all[i]! - all[i - 1]!)).toBeLessThanOrEqual(100 / 900 + 0.01);
    const peak = all.indexOf(Math.max(...all));
    expect(peak).toBeLessThanOrEqual(3);
    const after = all.slice(peak);
    for (let i = 1; i < after.length; i++) expect(after[i]!).toBeLessThanOrEqual(after[i - 1]!);
    expect(after[after.length - 1]).toBe(0);
    await expect.poll(() => path(page)).toBe('/');
  });

  test('?tier=2: from the kit to the phone, one goes back as the other comes out', async ({
    page,
  }) => {
    await gotoDesk(page, '/potaflow?tier=2');
    await waitLive(page);
    await drawerButton(page, 'Power Walk').press('Enter');
    await expect.poll(async () => (await hook(page)).open, { timeout: LONG }).toBe('phone');
    await expect.poll(async () => (await hook(page)).travel, { timeout: LONG }).toBe(1);
    const kit = await canvas(page).evaluate((c: HTMLCanvasElement) => c.dataset.travelKit);
    expect(Number(kit)).toBe(0);
  });

  test('?tier=2: the glance is off while something is out', async ({ page }) => {
    await gotoDesk(page, '/potaflow?tier=2');
    await waitLive(page);
    await page.mouse.move(1275, 400);
    await page.waitForTimeout(1500);
    expect(await gx(page)).toBeCloseTo(0, 1);
  });

  test('?tier=2: the Tier 1 art hides once the live scene is ready', async ({ page }) => {
    await gotoDesk(page, '/potaflow?tier=2');
    await waitLive(page);
    await expect
      .poll(() => page.locator('.opened__canvas').evaluate((el) => getComputedStyle(el).visibility))
      .toBe('hidden');
  });

  test('?tier=2: a direct load mixes in the opened bake only once it has arrived', async ({
    page,
  }) => {
    await page.route('**/opened/bake/**', async (r) => {
      await new Promise((res) => setTimeout(res, 4000));
      await r.continue();
    });
    await gotoDesk(page, '/potaflow?tier=2');
    await waitLive(page);
    const mix = () => canvas(page).evaluate((c: HTMLCanvasElement) => c.dataset.openMix);
    expect(await mix()).toBe('0.00');
    await expect.poll(mix, { timeout: LONG }).toBe('1.00');
  });

  test('?tier=2: the name on the monitor steps aside while an object is out', async ({ page }) => {
    const opacity = () =>
      page.locator('.desk-still__overlay').evaluate((el) => getComputedStyle(el).opacity);
    await gotoDesk(page, '/potaflow?tier=2');
    await waitLive(page);
    await expect.poll(opacity, { timeout: LONG }).toBe('0');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await hook(page)).travel, { timeout: LONG }).toBe(0);
    await expect.poll(opacity, { timeout: LONG }).toBe('1');
  });

  test('?tier=2: the Tier 1 art stays until the live scene has faded in', async ({ page }) => {
    // read the art's visibility in the same task that the live layer turns ready
    await page.addInitScript(() => {
      const w = window as unknown as { atReady?: string };
      new MutationObserver((_, obs) => {
        const live = document.querySelector('.desk-still__live[data-ready="true"]');
        const c = document.querySelector('.opened__canvas');
        if (live && c) {
          w.atReady = getComputedStyle(c).visibility;
          obs.disconnect();
        }
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-ready'] });
    });
    await gotoDesk(page, '/potaflow?tier=2');
    await waitLive(page);
    expect(await page.evaluate(() => (window as unknown as { atReady?: string }).atReady)).toBe(
      'visible',
    );
  });

  test('?tier=2: closing the phone frees its video texture', async ({ page }) => {
    await gotoDesk(page, '/?tier=2');
    await waitLive(page);
    const textures = () =>
      canvas(page).evaluate((c: HTMLCanvasElement) => Number(c.dataset.textures));
    // counted each time the phone is out again: a texture leaked per close adds one each cycle
    const cycle = async () => {
      await drawerButton(page, 'Power Walk').press('Enter');
      await expect.poll(async () => (await hook(page)).clip, { timeout: LONG }).toBe(1);
      await page.waitForTimeout(500);
      const out = await textures();
      await page.keyboard.press('Escape');
      await expect
        .poll(
          async () => {
            const h = await hook(page);
            return [h.travel, h.clip];
          },
          { timeout: LONG },
        )
        .toEqual([0, 0]);
      return out;
    };
    // one cycle to warm up (the screen's 1×1 stand-in is uploaded on the first close), then steady
    await cycle();
    const second = await cycle();
    const third = await cycle();
    const fourth = await cycle();
    expect(Number.isFinite(second)).toBe(true);
    expect([third, fourth]).toEqual([second, second]);
  });

  test('?tier=2: resizing while out refits the object', async ({ page }) => {
    await gotoDesk(page, '/potaflow?tier=2');
    await waitLive(page);
    const box = () =>
      page.locator('.opened__art').evaluate((el) => el.getBoundingClientRect().height);
    await expect
      .poll(async () => (await hook(page)).fit, { timeout: LONG })
      .toBeCloseTo(await box(), 0);
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect
      .poll(async () => Math.abs((await hook(page)).fit - (await box())), { timeout: LONG })
      .toBeLessThan(1.5);
    expect((await hook(page)).travel).toBe(1);
  });
});
