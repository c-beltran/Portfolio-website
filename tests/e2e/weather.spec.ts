import { expect, test, type Page } from './fixtures';
import { gotoDesk, hotspot } from './desk';

const WEATHER = 'https://api.open-meteo.com/**';
const canvas = (page: Page) => page.locator('.weather-window canvas');
const html = (page: Page, key: string) =>
  page.evaluate((k) => document.documentElement.dataset[k], key);

const answer = (code: number) => ({
  current: { weather_code: code, cloud_cover: 90, wind_speed_10m: 4, wind_direction_10m: 250 },
});

test.describe('the weather window', () => {
  test.skip(({ isMobile }) => isMobile, 'once is enough');

  test('asks for the weather only after the desk has painted and settled', async ({ page }) => {
    const asked: boolean[] = [];
    await page.route(WEATHER, async (route) => {
      asked.push(await page.evaluate(() => !!document.querySelector('.desk-glow')));
      await route.fulfill({ json: answer(0) });
    });
    await gotoDesk(page, '/');
    await expect(page.locator('.weather-window')).toHaveAttribute('data-drawn', 'true');
    expect(asked).toEqual([true]);
  });

  for (const [code, condition] of [
    [61, 'rain'],
    [73, 'snow'],
    [0, 'clear'],
  ] as const) {
    test(`a weather code of ${code} shows ${condition}`, async ({ page }) => {
      await page.route(WEATHER, (route) => route.fulfill({ json: answer(code) }));
      await gotoDesk(page, '/');
      await expect(canvas(page)).toHaveAttribute('data-condition', condition);
      expect(await html(page, 'skySource')).toBe('live');
      expect(await html(page, 'dayness')).toBe('1.00');
    });
  }

  test('a failed or refused answer settles quietly for a clear sky', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(WEATHER, (route) => route.fulfill({ status: 500, body: 'down' }));
    await gotoDesk(page, '/');
    await expect(canvas(page)).toHaveAttribute('data-condition', 'clear');
    expect(await html(page, 'skySource')).toBe('fallback');
    await page.unroute(WEATHER);
    await page.route(WEATHER, (route) => route.abort());
    await page.evaluate(() => sessionStorage.clear());
    await gotoDesk(page, '/');
    await expect(canvas(page)).toHaveAttribute('data-condition', 'clear');
    expect(await html(page, 'skySource')).toBe('fallback');
    expect(errors).toEqual([]);
  });

  test('a forced weather and time never ask the service', async ({ page }) => {
    let asked = 0;
    await page.route(WEATHER, (route) => {
      asked++;
      return route.fulfill({ json: answer(0) });
    });
    await gotoDesk(page, '/?weather=storm&time=night');
    await expect(canvas(page)).toHaveAttribute('data-condition', 'storm');
    expect(await html(page, 'skySource')).toBe('override');
    expect(await html(page, 'dayness')).toBe('0.00');
    expect(asked).toBe(0);
  });

  test('under reduced motion it holds one frame', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDesk(page, '/?weather=rain&time=day');
    await expect(canvas(page)).toHaveAttribute('data-still', 'true');
    await page.waitForTimeout(700); // the fade-in
    const box = (await page.locator('.weather-window').boundingBox())!;
    const a = await page.screenshot({ clip: box });
    await page.waitForTimeout(1000);
    expect((await page.screenshot({ clip: box })).equals(a)).toBe(true);
  });

  test('the motion pause holds it too', async ({ page }) => {
    await gotoDesk(page, '/?weather=snow&time=day');
    await expect(canvas(page)).toHaveAttribute('data-condition', 'snow');
    await expect(canvas(page)).not.toHaveAttribute('data-still', 'true');
    await page.locator('.motion-toggle').click();
    await expect(canvas(page)).toHaveAttribute('data-still', 'true');
  });

  test('without JavaScript the still keeps its own sky', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('.weather-window')).toHaveCount(0);
    await ctx.close();
  });
});

/** A small square of the page's pixels around a point. */
const patch = (page: Page, x: number, y: number) =>
  page.screenshot({ clip: { x: Math.round(x) - 3, y: Math.round(y) - 3, width: 6, height: 6 } });

/**
 * The same squares with the weather shown and hidden: the monitor and the light bar never change,
 * open sky does. The night sky is dark against the still's dusk, so the difference is plain.
 */
async function behindTheGlass(page: Page) {
  const cv = (await hotspot(page, 'cv').boundingBox())!;
  const bar = (await hotspot(page, 'lightbar').boundingBox())!;
  const { width: W, height: H } = page.viewportSize()!;
  const right = cv.x + cv.width;
  const points: Record<string, [number, number]> = {
    // near their right ends, the side the window is on
    monitor: [right - 30, cv.y + cv.height / 2],
    lightbar: [bar.x + bar.width - 30, bar.y + bar.height / 2],
    // open glass between the monitor and the window's right edge
    sky: [right + (W - right) * 0.55, cv.y + cv.height * 0.6],
  };
  const seen = Object.entries(points).filter(
    ([, [x, y]]) => x > 4 && y > 4 && x < W - 4 && y < H - 4,
  );
  const shown: Record<string, Buffer> = {};
  for (const [k, [x, y]] of seen) shown[k] = await patch(page, x, y);
  await page
    .locator('.weather-window')
    .evaluate((el) => ((el as HTMLElement).style.visibility = 'hidden'));
  const same: Record<string, boolean> = {};
  for (const [k, [x, y]] of seen) same[k] = (await patch(page, x, y)).equals(shown[k]!);
  return same;
}

test.describe('the weather stays behind the glass', () => {
  test.skip(({ isMobile }) => isMobile, 'the desktop project sets the windows itself');

  for (const [w, h] of [
    [1920, 1080],
    [2560, 720],
  ] as const) {
    test(`at ${w}×${h}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: w, height: h });
      await gotoDesk(page, '/?weather=overcast&time=night');
      await expect(page.locator('.weather-window')).toHaveAttribute('data-drawn', 'true');
      await page.waitForTimeout(700); // the fade-in
      expect(await behindTheGlass(page)).toEqual({ monitor: true, lightbar: true, sky: false });
    });
  }

  test('on a phone held upright, swiped to the window', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoDesk(page, '/?weather=overcast&time=night');
    // Swiped until the monitor's right edge sits a third of the way in: the window fills the rest.
    const cv = (await hotspot(page, 'cv').boundingBox())!;
    await page
      .locator('.desk-still')
      .evaluate((el, by) => (el.scrollLeft += by), cv.x + cv.width - 390 * 0.33);
    await expect(page.locator('.weather-window')).toHaveAttribute('data-drawn', 'true');
    await page.waitForTimeout(700);
    const same = await behindTheGlass(page);
    const solid = Object.entries(same).filter(([k]) => k !== 'sky');
    expect(solid.length).toBeGreaterThan(0);
    for (const [k, v] of solid) expect(v, k).toBe(true);
  });
});
