import { expect, test, type Page } from './fixtures';
import { drawerButton, gotoDesk, hotspot } from './desk';

/**
 * The terminal on the resting monitor: three frames, round and round, under the same pause as
 * the steam (the corner button and "Pause motion").
 */
const loop = (page: Page) => page.locator('canvas.screen-loop');
const frame = (page: Page) => loop(page).getAttribute('data-frame');
const control = (page: Page) => page.locator('.motion-toggle');

test.describe('the terminal loop', () => {
  test('/ asks for no terminal frame before idle, then three frames arrive and the loop goes round', async ({
    page,
  }) => {
    const seen: { url: string; t: number }[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/screens/terminal-')) seen.push({ url: r.url(), t: Date.now() });
    });
    let loaded = 0;
    page.on('load', () => (loaded = Date.now()));
    await gotoDesk(page, '/');
    await expect.poll(() => seen.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
    expect(seen.every((s) => s.t >= loaded)).toBe(true);
    expect(new Set(seen.map((s) => s.url.match(/terminal-(\d)-/)![1])).size).toBe(3);
    await expect.poll(() => frame(page), { timeout: 6000 }).toBe('3');
    await expect.poll(() => frame(page), { timeout: 6000 }).toBe('1');
  });

  test('the motion button pauses and plays it', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(loop(page)).toHaveAttribute('data-frame', /[123]/, { timeout: 10_000 });
    const b = (await control(page).boundingBox())!;
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    await control(page).click();
    const held = await frame(page);
    await page.waitForTimeout(3000);
    expect(await frame(page)).toBe(held);
    await control(page).click();
    await expect.poll(() => frame(page), { timeout: 4000 }).not.toBe(held);
  });

  test('the Sections list can pause it too', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(loop(page)).toHaveAttribute('data-frame', /[123]/, { timeout: 10_000 });
    const entry = drawerButton(page, 'Pause motion');
    await entry.focus();
    await page.keyboard.press('Enter');
    await expect(entry).toHaveAttribute('aria-pressed', 'true');
    const held = await frame(page);
    await page.waitForTimeout(3000);
    expect(await frame(page)).toBe(held);
  });

  test('while the kit is out the loop does not advance', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect.poll(() => frame(page), { timeout: 10_000 }).toBe('1');
    await drawerButton(page, 'Potaflow').press('Enter');
    await page.waitForTimeout(3500);
    expect(await frame(page)).toBe('1');
    await page.keyboard.press('Escape');
    await expect.poll(() => frame(page), { timeout: 4000 }).toBe('2');
  });

  test("/'s largest paint is still the name", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { lcp: string[] }).lcp = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { element?: Element })[])
          (window as unknown as { lcp: string[] }).lcp.push(
            e.element ? `${e.element.tagName}.${e.element.className}` : '?',
          );
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    await gotoDesk(page, '/');
    await expect.poll(() => frame(page), { timeout: 10_000 }).toBe('2');
    const lcp = await page.evaluate(() => (window as unknown as { lcp: string[] }).lcp);
    expect(lcp[lcp.length - 1]).not.toMatch(/^CANVAS/);
  });
});

test.describe('the terminal loop, placed', () => {
  test.skip(({ isMobile }) => isMobile, 'viewports set here');
  for (const [width, height] of [
    [1280, 800],
    [390, 844],
  ] as const)
    test(`sits on the monitor's left half at ${width}×${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await gotoDesk(page, '/');
      await expect(loop(page)).toHaveAttribute('data-frame', /[123]/, { timeout: 10_000 });
      const [l, m] = [
        (await loop(page).boundingBox())!,
        (await hotspot(page, 'monitor').boundingBox())!,
      ];
      expect(l.x).toBeGreaterThanOrEqual(m.x - 1);
      expect(l.y).toBeGreaterThanOrEqual(m.y - 1);
      expect(l.x + l.width).toBeLessThanOrEqual(m.x + m.width + 1);
      expect(l.y + l.height).toBeLessThanOrEqual(m.y + m.height + 1);
    });
});

test.describe('the terminal loop, reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('there is no loop: no request, nothing drawn, no control', async ({ page }) => {
    const seen: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/screens/')) seen.push(r.url());
    });
    await gotoDesk(page, '/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    expect(seen).toEqual([]);
    await expect(loop(page)).toHaveCount(0);
    await expect(control(page)).toBeHidden();
  });
});
