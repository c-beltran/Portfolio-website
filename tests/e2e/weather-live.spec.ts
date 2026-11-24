import { expect, test, type Page } from './fixtures';
import { atNight, gotoDesk, hotspot, lampOff } from './desk';

const canvas = (page: Page) => page.locator('.desk-still__live canvas');

async function waitLive(page: Page) {
  await expect(page.locator('.desk-still__live')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000,
  });
}

test.describe("the live desk's window and light", () => {
  test.skip(({ isMobile }) => isMobile, 'desktop preview');

  test("the visitor's weather comes into the live window", async ({ page }) => {
    await page.route('https://api.open-meteo.com/**', (route) =>
      route.fulfill({
        json: { current: { weather_code: 61, wind_speed_10m: 3, wind_direction_10m: 240 } },
      }),
    );
    await gotoDesk(page, '/?tier=2');
    await waitLive(page);
    await expect(canvas(page)).toHaveAttribute('data-weather-mix', '1.00', { timeout: 10_000 });
    expect(await page.evaluate(() => document.documentElement.dataset.sky)).toBe('rain');
    // the rain's tint, in full by day
    await expect(canvas(page)).toHaveAttribute('data-tint', '0.85', { timeout: 5000 });
  });

  test("once the live desk is up, the still's own window stops drawing", async ({ page }) => {
    await gotoDesk(page, '/?tier=2&weather=rain&time=day');
    await waitLive(page);
    await expect(canvas(page)).toHaveAttribute('data-weather-mix', '1.00', { timeout: 10_000 });
    await expect(page.locator('.weather-window canvas')).toHaveAttribute('data-still', 'true');
  });

  test('the weather stays in the window through a lean-in', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await gotoDesk(page, '/?tier=2&weather=snow&time=day');
    await waitLive(page);
    await expect(canvas(page)).toHaveAttribute('data-weather-mix', '1.00', { timeout: 10_000 });
    await hotspot(page, 'board').click();
    await expect(canvas(page)).toHaveAttribute('data-settled', 'board', { timeout: 10_000 });
    expect(await canvas(page).getAttribute('data-weather-mix')).toBe('1.00');
    expect(errors).toEqual([]);
  });

  test('at night with the lamp off the live room is moonlit', async ({ page }) => {
    await atNight(page);
    await lampOff(page);
    await gotoDesk(page, '/?tier=2&weather=clear');
    await waitLive(page);
    await expect(canvas(page)).toHaveAttribute('data-moon', '1.00', { timeout: 5000 });
    await expect(canvas(page)).toHaveAttribute('data-pool', '0.00');
  });

  test('by day the lamp lights its pool in the live room', async ({ page }) => {
    await gotoDesk(page, '/?tier=2&weather=clear&time=day');
    await waitLive(page);
    await expect(canvas(page)).toHaveAttribute('data-pool', '0.00');
    await hotspot(page, 'lightbar').click();
    await expect(canvas(page)).toHaveAttribute('data-pool', '1.00', { timeout: 5000 });
    await expect(canvas(page)).toHaveAttribute('data-moon', '0.00');
  });
});
