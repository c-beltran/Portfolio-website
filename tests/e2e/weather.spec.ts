import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { atNight, gotoDesk, hotspot, lampOff, NIGHT } from './desk';

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
    await page.waitForTimeout(2500); // the window's fade-in, and the room's tint after it
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

const room = (page: Page) => page.locator('.room-light');

/** The mean brightness of a square of the page around a point, from a screenshot. */
async function brightness(page: Page, x: number, y: number, size = 24) {
  const png = await page.screenshot({
    clip: { x: Math.round(x - size / 2), y: Math.round(y - size / 2), width: size, height: size },
  });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = new OffscreenCanvas(img.width, img.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4)
      sum += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
    return sum / (d.length / 4);
  }, png.toString('base64'));
}

/** A point on the bare desk, between the keyboard and the mug (no object, no screen). */
async function deskPoint(page: Page) {
  const mug = (await hotspot(page, 'mug').boundingBox())!;
  return [mug.x - mug.width * 0.6, mug.y + mug.height * 0.5] as const;
}

test.describe("the room's light", () => {
  test.skip(({ isMobile }) => isMobile, 'once is enough');

  test('the first paint has no weather tint; it fades in when the weather comes', async ({
    page,
  }) => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route(WEATHER, async (route) => {
      await held;
      await route.fulfill({ json: answer(65) });
    });
    await gotoDesk(page, '/');
    await expect(room(page)).toHaveAttribute('data-tint', '0.00');
    const [x, y] = await deskPoint(page);
    const before = await brightness(page, x, y);
    release();
    await expect(room(page)).not.toHaveAttribute('data-tint', '0.00');
    await page.waitForTimeout(300);
    const early = await brightness(page, x, y);
    await page.waitForTimeout(2200);
    const after = await brightness(page, x, y);
    expect(after).toBeLessThan(before - 2);
    // still on its way at first: a fade, not a jump
    expect(early).toBeGreaterThan(after + 0.5);
  });

  test('at night with the lamp off the room is moonlit, under the dark palette', async ({
    page,
  }) => {
    const [x, y] = await (async () => {
      await gotoDesk(page, '/?weather=clear');
      return deskPoint(page);
    })();
    await page.waitForTimeout(700);
    const day = await brightness(page, x, y);
    await atNight(page);
    await lampOff(page);
    await gotoDesk(page, '/?weather=clear');
    expect(await html(page, 'time')).toBe('night');
    await expect(room(page)).toHaveAttribute('data-moon', '1.00');
    await page.waitForTimeout(700);
    expect(await brightness(page, x, y)).toBeLessThan(day * 0.8);
  });

  test('by day the lamp lights its pool', async ({ page }) => {
    await gotoDesk(page, '/?weather=clear');
    const kb = (await page.locator('.desk-still__art').boundingBox())!;
    // POOL.at on the master, through the art box
    const [x, y] = [kb.x + kb.width * 0.47, kb.y + kb.height * 0.84];
    const off = await brightness(page, x, y);
    await hotspot(page, 'lightbar').click();
    await expect(room(page)).toHaveAttribute('data-pool', '1.00');
    await page.waitForTimeout(800);
    expect(await brightness(page, x, y)).toBeGreaterThan(off + 4);
  });

  test('the screens keep their own light whatever the weather', async ({ page }) => {
    const name = page.locator('.monitor-name');
    const at = async () => {
      const b = (await name.boundingBox())!;
      return brightness(page, b.x + b.width * 0.8, b.y + b.height * 0.8, 16);
    };
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDesk(page, '/?weather=clear&time=day');
    await page.waitForTimeout(2500);
    const clear = await at();
    await gotoDesk(page, '/?weather=storm&time=day');
    await page.waitForTimeout(2500);
    expect(Math.abs((await at()) - clear)).toBeLessThanOrEqual(6);
  });

  test('a sunset during the visit moves the window and the daylight, never the lamp or palette', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    await expect(canvas(page)).toHaveAttribute('data-dayness', '1.00');
    await page.context().clock.setFixedTime(NIGHT);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(canvas(page)).toHaveAttribute('data-dayness', '0.00');
    expect(await html(page, 'dayness')).toBe('0.00');
    expect(await html(page, 'time')).toBe('day');
    expect(await html(page, 'lamp')).toBe('off');
    await expect(room(page)).toHaveAttribute('data-moon', '1.00');
  });
});

test.describe('accessible in every light', () => {
  test.skip(({ isMobile }) => isMobile, 'once is enough');

  for (const night of [false, true])
    for (const off of [false, true])
      test(`axe passes ${night ? 'at night' : 'by day'} with the lamp ${off !== night ? 'on' : 'off'}`, async ({
        page,
      }) => {
        if (night) await atNight(page);
        // by day the lamp starts off and at night on: `off` flips it
        if (off)
          await page.addInitScript(
            (v) => sessionStorage.setItem('desk-lamp', v),
            night ? 'off' : 'on',
          );
        for (const route of ['/', '/cv']) {
          await gotoDesk(page, route);
          const { violations } = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
          expect(violations.map((v) => v.id)).toEqual([]);
        }
      });
});
