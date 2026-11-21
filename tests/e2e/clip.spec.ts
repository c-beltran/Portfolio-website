import { expect, test, type Page } from './fixtures';
import { drawerButton, gotoDesk } from './desk';

/**
 * The phone's clip (design 2026-11-19 §4.2: "turns to landscape and plays a short muted, looped
 * clip of Power Walk on its screen"; plan M3c-forward Task 5). A placeholder until Carlos's
 * recording. It loops past 5 s, so the panel carries a Pause/Play button (WCAG 2.2.2).
 */
const video = (page: Page) => page.locator('video#power-walk-clip');
const state = (page: Page) =>
  video(page).evaluate((v: HTMLVideoElement) => ({
    paused: v.paused,
    muted: v.muted,
    loop: v.loop,
    time: v.currentTime,
  }));
const control = (page: Page, name: string) =>
  page.locator('section.panel').getByRole('button', { name, exact: true });

test.describe('the phone clip', () => {
  test.skip(({ isMobile }) => isMobile, 'one layout is enough for playback');
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the phone plays its clip muted, and the panel's button pauses and plays it", async ({
    page,
  }) => {
    await gotoDesk(page, '/power-walk');
    await expect.poll(async () => (await state(page)).time, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(await state(page)).toMatchObject({ paused: false, muted: true, loop: true });
    await control(page, 'Pause the clip').click();
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await control(page, 'Play the clip').click();
    await expect.poll(async () => (await state(page)).paused).toBe(false);
    await expect(control(page, 'Pause the clip')).toBeVisible();
  });

  test("with reduced motion the clip doesn't start by itself", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDesk(page, '/power-walk');
    await expect(video(page)).toHaveAttribute('poster', /power-walk-poster\.webp$/);
    await page.waitForTimeout(1000);
    expect(await state(page)).toMatchObject({ paused: true, time: 0 });
    await control(page, 'Play the clip').click();
    await expect.poll(async () => (await state(page)).time, { timeout: 10_000 }).toBeGreaterThan(0);
  });

  test('the clip stops and drops its source when the phone goes back', async ({ page }) => {
    await gotoDesk(page, '/');
    await drawerButton(page, 'Power Walk').press('Enter');
    await expect.poll(async () => (await state(page)).time, { timeout: 10_000 }).toBeGreaterThan(0);
    const after: string[] = [];
    let closed = false;
    page.on('request', (r) => {
      if (closed && r.url().includes('/clips/')) after.push(r.url());
    });
    closed = true;
    await page.keyboard.press('Escape');
    await expect(video(page)).toHaveCount(0);
    await page.waitForTimeout(1000);
    expect(after).toEqual([]);
  });

  test("the clip sits on the phone's screen", async ({ page }) => {
    await gotoDesk(page, '/power-walk');
    await expect(page.locator('.opened__art canvas')).toHaveAttribute('data-drawn', 'true');
    const v = (await video(page).boundingBox())!;
    const a = (await page.locator('.opened__art').boundingBox())!;
    expect(v.width).toBeGreaterThan(a.width * 0.8);
    expect(v.x).toBeGreaterThanOrEqual(a.x);
    expect(v.y).toBeGreaterThanOrEqual(a.y);
    expect(v.x + v.width).toBeLessThanOrEqual(a.x + a.width);
    expect(v.y + v.height).toBeLessThanOrEqual(a.y + a.height);
  });
});
