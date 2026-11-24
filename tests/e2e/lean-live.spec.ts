import { expect, test, type Page } from './fixtures';
import { drawerButton, gotoDesk, path } from './desk';

/**
 * Leaning in, in the live preview: the camera moves from the seat to stand square to the monitor's
 * half or the board, framed to the slot beside the panel; going back reverses it. Read through the
 * canvas's test hooks (MomentRig.ts). Headless WebGL is slow: the waits are generous.
 */
const LONG = 40_000;
const canvas = (page: Page) => page.locator('.desk-still__live canvas');
const hook = (page: Page) =>
  canvas(page).evaluate((c: HTMLCanvasElement) => ({
    open: c.dataset.open ?? '',
    travel: Number(c.dataset.travel ?? NaN),
    fit: Number(c.dataset.fit ?? NaN),
    settled: c.dataset.settled ?? '',
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

test.describe('leaning in live', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop preview');
  test.slow();
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const [id, label] of [
    ['monitor', 'How I build'],
    ['cv', 'CV'],
    ['board', 'Travel'],
  ] as const)
    test(`?tier=2: the camera leans in to ${id} and back`, async ({ page }) => {
      await gotoDesk(page, '/?tier=2');
      await waitLive(page);
      await drawerButton(page, label).press('Enter');
      await expect.poll(async () => (await hook(page)).open, { timeout: LONG }).toBe(id);
      await expect.poll(async () => (await hook(page)).travel, { timeout: LONG }).toBe(1);
      await expect(canvas(page)).toHaveAttribute('data-settled', id, { timeout: LONG });
      await page.keyboard.press('Escape');
      await expect.poll(() => path(page)).toBe('/');
      await expect.poll(async () => (await hook(page)).travel, { timeout: LONG }).toBe(0);
    });

  test('?tier=2: a direct load of /cv starts leaned in', async ({ page }) => {
    await gotoDesk(page, '/cv?tier=2');
    await waitLive(page);
    const first = await hook(page);
    expect(first.open).toBe('cv');
    expect(first.travel).toBe(1);
  });

  test('?tier=2: Esc mid-lean reverses without a jump', async ({ page }) => {
    await gotoDesk(page, '/?tier=2');
    await waitLive(page);
    await drawerButton(page, 'CV').press('Enter');
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
    const all = [before, ...samples];
    for (let i = 1; i < all.length; i++)
      expect(Math.abs(all[i]! - all[i - 1]!)).toBeLessThanOrEqual(100 / 900 + 0.01);
    const peak = all.indexOf(Math.max(...all));
    expect(peak).toBeLessThanOrEqual(3);
    const after = all.slice(peak);
    for (let i = 1; i < after.length; i++) expect(after[i]!).toBeLessThanOrEqual(after[i - 1]!);
    expect(after[after.length - 1]).toBe(0);
  });

  test('?tier=2: from the kit to the CV, the kit goes back while the camera leans in', async ({
    page,
  }) => {
    await gotoDesk(page, '/potaflow?tier=2');
    await waitLive(page);
    await expect.poll(async () => (await hook(page)).travel, { timeout: LONG }).toBe(1);
    await drawerButton(page, 'CV').press('Enter');
    const samples = await page.evaluate(async () => {
      const c = document.querySelector<HTMLCanvasElement>('.desk-still__live canvas')!;
      const out: { kit: number; cv: number; dim: number }[] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 15_000) {
        await new Promise(requestAnimationFrame);
        const s = {
          kit: Number(c.dataset.travelKit),
          cv: Number(c.dataset.travelCv),
          dim: Number(c.dataset.dim),
        };
        out.push(s);
        if (s.kit === 0 && s.cv === 1) break;
      }
      return out;
    });
    expect(samples.at(-1)).toMatchObject({ kit: 0, cv: 1 });
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.kit).toBeLessThanOrEqual(samples[i - 1]!.kit);
      expect(samples[i]!.cv).toBeGreaterThanOrEqual(samples[i - 1]!.cv);
    }
    for (const s of samples) expect(s.dim).toBeGreaterThanOrEqual(0.85);
  });

  test('?tier=2: from the board to the CV, the camera passes near the seat', async ({ page }) => {
    await gotoDesk(page, '/travel?tier=2');
    await waitLive(page);
    await drawerButton(page, 'CV').press('Enter');
    await expect.poll(async () => (await hook(page)).open, { timeout: LONG }).toBe('cv');
    await expect(canvas(page)).toHaveAttribute('data-settled', 'cv', { timeout: LONG });
    const board = await canvas(page).evaluate((c: HTMLCanvasElement) => c.dataset.travelBoard);
    expect(Number(board)).toBe(0);
  });

  test('?tier=2: resizing while leaned in refits the camera to the new slot', async ({ page }) => {
    await gotoDesk(page, '/cv?tier=2');
    await waitLive(page);
    for (const [width, height] of [
      [1280, 800],
      [1600, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      const art = (await page.locator('.opened__art').boundingBox())!;
      await expect
        .poll(async () => Math.abs((await hook(page)).fit - art.height), { timeout: LONG })
        .toBeLessThan(1);
    }
  });

  test("?tier=2: the CV's screen shows only once the lean-in has settled", async ({ page }) => {
    await gotoDesk(page, '/?tier=2');
    await waitLive(page);
    await drawerButton(page, 'CV').press('Enter');
    const face = page.locator('.opened__face[data-face="cv"]');
    const seen = await page.evaluate(async () => {
      const c = document.querySelector<HTMLCanvasElement>('.desk-still__live canvas')!;
      const bad: number[] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 15_000) {
        await new Promise(requestAnimationFrame);
        const f = document.querySelector('.opened__face[data-face="cv"]');
        const visible = !!f && getComputedStyle(f).visibility === 'visible';
        if (visible && c.dataset.settled !== 'cv') bad.push(Number(c.dataset.travel));
        if (c.dataset.settled === 'cv') break;
      }
      return bad;
    });
    expect(seen).toEqual([]);
    await expect(face).toBeVisible();
  });

  test('?tier=2: the glance is off while leaned in', async ({ page }) => {
    await gotoDesk(page, '/cv?tier=2');
    await waitLive(page);
    await page.mouse.move(1275, 400);
    await page.waitForTimeout(1500);
    expect(await gx(page)).toBeCloseTo(0, 1);
  });
});
