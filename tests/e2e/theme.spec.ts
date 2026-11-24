import { expect, test, type Page } from './fixtures';
import { atNight, gotoDesk, lampOff, NIGHT } from './desk';

const light = (page: Page) =>
  page.evaluate(() => {
    const d = document.documentElement.dataset;
    return { time: d.time, lamp: d.lamp, theme: d.theme };
  });

test.describe('the light', () => {
  test('the light script runs in <head>, before the body paints', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const head = html.slice(0, html.indexOf('<body'));
    expect(head).toContain("sessionStorage.getItem('desk-lamp')");
  });

  test('by day the lamp starts off, whatever the system setting', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await light(page)).toEqual({ time: 'day', lamp: 'off', theme: 'day' });
  });

  test('at night the lamp starts on, and the lamp render is the first paint', async ({ page }) => {
    await atNight(page);
    await page.addInitScript(() => {
      (window as unknown as { lcp: string[] }).lcp = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries())
          (window as unknown as { lcp: string[] }).lcp.push(
            ((e as unknown as { element?: Element }).element?.closest('picture')?.className ??
              (e as unknown as { element?: Element }).element?.className) ||
              '',
          );
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    await gotoDesk(page, '/');
    expect(await light(page)).toEqual({ time: 'night', lamp: 'on', theme: 'lamp' });
    const img = page.locator('.desk-still__photo--lamp img');
    expect(await img.evaluate((el: HTMLImageElement) => [el.loading, el.fetchPriority])).toEqual([
      'eager',
      'high',
    ]);
    expect(
      await page
        .locator('.desk-still__photo--day img')
        .evaluate((el: HTMLImageElement) => el.fetchPriority),
    ).toBe('low');
    const lcp = await page.evaluate(() => (window as unknown as { lcp: string[] }).lcp.at(-1));
    expect(lcp).toMatch(/desk-still__photo--lamp|monitor-name/);
  });

  test('the switch works the lamp only: at noon the room stays in daylight', async ({ page }) => {
    await gotoDesk(page, '/');
    const lamp = page.getByRole('button', { name: 'Lamp' });
    await expect(lamp).toHaveAttribute('aria-pressed', 'false');
    await lamp.press('Enter'); // the Sections list's Lamp: the keyboard path on the desk
    await expect(lamp).toHaveAttribute('aria-pressed', 'true');
    expect(await light(page)).toEqual({ time: 'day', lamp: 'on', theme: 'day' });
  });

  test('a switch lasts for the visit: kept on reload, forgotten in a new one', async ({
    page,
    browser,
  }) => {
    await atNight(page);
    await gotoDesk(page, '/');
    await page.getByRole('button', { name: 'Lamp' }).press('Enter');
    expect(await light(page)).toEqual({ time: 'night', lamp: 'off', theme: 'day' });
    await page.reload();
    expect(await light(page)).toMatchObject({ lamp: 'off', theme: 'day' });
    const ctx = await browser.newContext({ timezoneId: 'America/New_York' });
    await ctx.clock.setFixedTime(NIGHT);
    const fresh = await ctx.newPage();
    await fresh.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await light(fresh)).toMatchObject({ lamp: 'on', theme: 'lamp' });
    await ctx.close();
  });

  test('an old forever-saved lamp choice is dropped', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('desk-theme', 'lamp');
        sessionStorage.setItem('seeded', '1');
      }
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await light(page)).toEqual({ time: 'day', lamp: 'off', theme: 'day' });
    expect(await page.evaluate(() => localStorage.getItem('desk-theme'))).toBeNull();
  });

  test('a switched-off lamp at night shows the day render under the dark palette', async ({
    page,
  }) => {
    await atNight(page);
    await lampOff(page);
    await gotoDesk(page, '/');
    expect(await light(page)).toEqual({ time: 'night', lamp: 'off', theme: 'day' });
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    );
    expect(bg.toUpperCase()).toBe('#14110D');
  });

  test('blocked storage: no errors, and the switch still works', async ({ browser }) => {
    const ctx = await browser.newContext({ timezoneId: 'America/New_York' });
    await ctx.clock.setFixedTime(NIGHT);
    await ctx.addInitScript(() => {
      for (const k of ['localStorage', 'sessionStorage'])
        Object.defineProperty(window, k, {
          get() {
            throw new Error('storage blocked');
          },
        });
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    expect(await light(page)).toMatchObject({ lamp: 'on', theme: 'lamp' });
    await page.getByRole('button', { name: 'Lamp' }).press('Enter');
    expect(await light(page)).toMatchObject({ lamp: 'off', theme: 'day' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('the lamp toggle is at least 44px in both dimensions', async ({ page }) => {
    await page.goto('/');
    const lamp = page.getByRole('button', { name: 'Lamp' });
    await lamp.focus(); // the Sections list shows when something in it has focus
    const box = await lamp.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
