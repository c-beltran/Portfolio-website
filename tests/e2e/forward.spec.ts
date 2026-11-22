import { expect, test, type Locator, type Page } from './fixtures';
import { clickFelt, drawerButton, gotoDesk, hotspot, panelTitle, path } from './desk';

/**
 * Coming forward in Tier 1: the kit and the
 * phone come out beside the panel while the desk dims behind them.
 */
const main = (page: Page) => page.locator('main.desk');
const art = (page: Page) => page.locator('.opened__art');
const canvas = (page: Page) => page.locator('.opened__canvas');
const panel = (page: Page) => page.locator('.desk > .panel');
const box = async (l: Locator) => (await l.boundingBox())!;
type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const filterOf = (page: Page) =>
  page.locator('.desk-still__art').evaluate((el) => getComputedStyle(el).filter);

async function drawn(page: Page) {
  await expect(canvas(page)).toHaveAttribute('data-drawn', 'true', { timeout: 5000 });
}

/** The art is inside the window and never under the panel. */
async function inSlot(page: Page) {
  const [W, H] = await page.evaluate(() => [innerWidth, innerHeight]);
  const a = await box(art(page));
  expect(a.x).toBeGreaterThanOrEqual(-0.5);
  expect(a.y).toBeGreaterThanOrEqual(-0.5);
  expect(a.x + a.width).toBeLessThanOrEqual(W! + 0.5);
  expect(a.y + a.height).toBeLessThanOrEqual(H! + 0.5);
  expect(overlaps(a, await box(panel(page)))).toBe(false);
  return a;
}

/** The art box on every frame from Esc until the art has gone (it fades for 300 ms). */
const boxesThroughClose = (page: Page) =>
  page.evaluate(async () => {
    const out: { x: number; y: number; w: number; h: number }[] = [];
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const t0 = performance.now();
    while (performance.now() - t0 < 1500) {
      await new Promise(requestAnimationFrame);
      const a = document.querySelector('.opened__art');
      if (!a) break;
      const r = a.getBoundingClientRect();
      out.push({ x: r.x, y: r.y, w: r.width, h: r.height });
    }
    return out;
  });
const steady = (before: Box, boxes: { x: number; y: number; w: number; h: number }[]) => {
  expect(boxes.length).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(Math.abs(b.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.y - before.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.w - before.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.h - before.height)).toBeLessThanOrEqual(1);
  }
};

test.describe('coming forward, wide windows', () => {
  test.skip(({ isMobile }) => isMobile, 'the portrait layout is tested below');
  test.use({ viewport: { width: 1280, height: 800 } });

  test('opening the kit dims the desk and brings it out on the left, the panel on the right', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'kit').click();
    await expect(main(page)).toHaveAttribute('data-open', 'kit');
    await expect.poll(() => filterOf(page)).toContain('brightness(0.45)');
    expect(await filterOf(page)).toContain('blur');
    // the name on the monitor is HTML over the still: it dims with the desk
    await expect
      .poll(() =>
        page.locator('.desk-still__overlay').evaluate((el) => getComputedStyle(el).filter),
      )
      .toContain('brightness(0.45)');
    await drawn(page);
    const a = await inSlot(page);
    expect(a.x + a.width).toBeLessThanOrEqual((await box(panel(page))).x);
  });

  test('the phone comes out on the right, the panel on the left', async ({ page }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'phone').click();
    await expect(main(page)).toHaveAttribute('data-open', 'phone');
    await drawn(page);
    const a = await inSlot(page);
    const p = await box(panel(page));
    expect(a.x).toBeGreaterThanOrEqual(p.x + p.width);
  });

  test('clicking the dimmed desk puts it back', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    await clickFelt(page);
    expect(path(page)).toBe('/');
    await expect(main(page)).not.toHaveAttribute('data-open');
    await expect(drawerButton(page, 'Potaflow')).toBeFocused();
  });

  test('a click on the object keeps it out', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    await drawn(page);
    const a = await box(art(page));
    await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
    await page.waitForTimeout(300);
    expect(path(page)).toBe('/potaflow');
    await expect(main(page)).toHaveAttribute('data-open', 'kit');
  });

  test('while it is out, a click on another object closes instead of opening it', async ({
    page,
  }) => {
    await gotoDesk(page, '/potaflow');
    const b = await box(hotspot(page, 'phone'));
    const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
    // the phone's spot must be bare dimmed desk here, not under the art or the panel
    const onDesk = await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('.desk-still__layer'),
      [x, y],
    );
    expect(onDesk).toBe(true);
    await page.mouse.click(x, y);
    await expect.poll(() => path(page)).toBe('/');
  });

  test('Esc and Back put it back', async ({ page }) => {
    await gotoDesk(page, '/');
    await drawerButton(page, 'Potaflow').press('Enter');
    await expect(main(page)).toHaveAttribute('data-open', 'kit');
    await page.keyboard.press('Escape');
    await expect.poll(() => path(page)).toBe('/');
    await expect(main(page)).not.toHaveAttribute('data-open');
    await drawerButton(page, 'Potaflow').press('Enter');
    await expect(main(page)).toHaveAttribute('data-open', 'kit');
    await page.goBack();
    await expect.poll(() => path(page)).toBe('/');
    await expect(main(page)).not.toHaveAttribute('data-open');
  });

  test('a direct load paints it already out', async ({ page }) => {
    const res = await gotoDesk(page, '/potaflow');
    expect(await res!.text()).toContain('data-open="kit"');
    await drawn(page);
    // nothing animates on a direct load: Desk.tsx sets data-animate only once the visitor acts
    await expect(main(page)).not.toHaveAttribute('data-animate');
  });

  test('the patch covers the kit on the desk', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(page.locator('img.desk-still__patch')).toHaveCount(0);
    await gotoDesk(page, '/potaflow');
    const patch = page.locator('img.desk-still__patch[data-item="kit"]');
    await expect
      .poll(() =>
        patch.evaluate(
          (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  });

  test('/ loads no opened art until intent', async ({ page }) => {
    const seen: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/opened/')) seen.push(r.url());
    });
    await gotoDesk(page, '/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    expect(seen).toEqual([]);
    await hotspot(page, 'kit').hover();
    await expect.poll(() => seen.some((u) => /\/opened\/kit-/.test(u))).toBe(true);
  });

  test('switching from the kit to the phone in the Sections list swaps the art and the panel side', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    await drawerButton(page, 'Potaflow').press('Enter');
    await drawn(page);
    await drawerButton(page, 'Power Walk').focus();
    const sampling = page.evaluate(async () => {
      const bad: string[] = [];
      const t0 = performance.now();
      while (performance.now() - t0 < 700) {
        await new Promise(requestAnimationFrame);
        const p = document.querySelector('.desk > .panel')!.getBoundingClientRect();
        for (const a of document.querySelectorAll('.opened__art')) {
          const r = a.getBoundingClientRect();
          if (
            r.width &&
            r.left < p.right &&
            p.left < r.right &&
            r.top < p.bottom &&
            p.top < r.bottom
          )
            bad.push(`${Math.round(performance.now() - t0)} ms`);
        }
      }
      return bad;
    });
    await page.keyboard.press('Enter');
    expect(await sampling).toEqual([]);
    await expect(main(page)).toHaveAttribute('data-open', 'phone');
    await expect(art(page)).toHaveCount(1);
    await drawn(page);
    await inSlot(page);
  });

  test('closing keeps the art where it is while it fades', async ({ page }) => {
    // the phone: its slot is on the right, the side the default slot is not
    await gotoDesk(page, '/power-walk');
    await drawn(page);
    steady(await box(art(page)), await boxesThroughClose(page));
  });

  test("/power-walk's largest paint is never the art or the clip", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { lcp: string[] }).lcp = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { element?: Element })[])
          (window as unknown as { lcp: string[] }).lcp.push(
            e.element ? `${e.element.tagName}.${e.element.className}` : '?',
          );
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    await gotoDesk(page, '/power-walk');
    await drawn(page);
    await expect
      .poll(() => page.evaluate(() => document.querySelector('video')?.currentTime ?? 0))
      .toBeGreaterThan(1);
    await page.waitForTimeout(500);
    const lcp = await page.evaluate(() => (window as unknown as { lcp: string[] }).lcp);
    expect(lcp.length).toBeGreaterThan(0);
    expect(lcp[lcp.length - 1]).not.toMatch(/^(VIDEO|CANVAS)/);
  });

  test('resizing while out keeps the art in its slot', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    await drawn(page);
    for (const [width, height] of [
      [1280, 800],
      [600, 900],
      [1600, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      await inSlot(page);
    }
  });
});

test.describe('coming forward, no JavaScript', () => {
  test.skip(({ isMobile }) => isMobile, 'once is enough');

  test('with JavaScript off, /potaflow is dimmed with its panel', async ({ browser }) => {
    const ctx = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await page.goto('/potaflow');
    expect(await filterOf(page)).toContain('brightness(0.45)');
    await expect(panelTitle(page)).toBeVisible();
    await ctx.close();
  });
});

test.describe('coming forward, portrait', () => {
  test.skip(({ isMobile }) => !isMobile, 'a portrait phone');

  test('closing keeps the art where it is while it fades', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    await drawn(page);
    steady(await box(art(page)), await boxesThroughClose(page));
  });

  test('in a portrait window the object is above the panel', async ({ page }) => {
    await gotoDesk(page, '/power-walk');
    await drawn(page);
    const [W, H] = await page.evaluate(() => [innerWidth, innerHeight]);
    const a = await box(art(page));
    const p = await box(panel(page));
    expect(a.y + a.height).toBeLessThanOrEqual(p.y + 0.5);
    expect(p.width).toBeGreaterThanOrEqual(W! - 1);
    expect(p.y + p.height).toBeGreaterThanOrEqual(H! - 1);
  });
});
