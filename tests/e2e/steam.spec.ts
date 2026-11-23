import { expect, test, type Page } from './fixtures';
import seat from '../../content/scene/bounds-seat.json' with { type: 'json' };
import { drawerButton, gotoDesk, hotspot, path } from './desk';

/**
 * Steam over the mug. It moves for as long as the desk is up, so it carries a pause (WCAG 2.2.2): a corner
 * button for the pointer and a Sections entry for the keyboard and screen readers, one state.
 */
const steam = (page: Page) => page.locator('.desk-still__overlay .steam');
const control = (page: Page) => page.locator('.motion-toggle');
const states = (page: Page) =>
  steam(page).evaluate((el) => [
    ...new Set(el.getAnimations({ subtree: true }).map((a) => a.playState)),
  ]);

test.describe('steam over the mug', () => {
  test('rises from the cup, for ever', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect.poll(() => states(page)).toEqual(['running']);
    const endless = await steam(page).evaluate((el) =>
      el
        .getAnimations({ subtree: true })
        .every((a) => a.effect!.getComputedTiming().iterations === Infinity),
    );
    expect(endless).toBe(true);
    const layer = (await page.locator('.desk-still__layer').boundingBox())!;
    const s = (await steam(page).boundingBox())!;
    const mug = seat.objects.obj_mug;
    const x = (s.x + s.width / 2 - layer.x) / layer.width;
    const foot = (s.y + s.height - layer.y) / layer.height;
    expect(x).toBeGreaterThan(mug.x0);
    expect(x).toBeLessThan(mug.x1);
    expect(foot).toBeGreaterThan(mug.y0);
    expect(foot).toBeLessThan((mug.y0 + mug.y1) / 2);
  });

  test('the corner button pauses and plays it, and the choice lasts the visit', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    const box = (await control(page).boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    await control(page).click();
    await expect.poll(() => states(page)).toEqual(['paused']);
    expect(path(page)).toBe('/');
    await page.reload();
    await expect.poll(() => states(page)).toEqual(['paused']);
    await control(page).click();
    await expect.poll(() => states(page)).toEqual(['running']);
  });

  test('the Sections list pauses it too', async ({ page }) => {
    await gotoDesk(page, '/');
    const entry = drawerButton(page, 'Pause motion');
    await entry.press('Enter');
    await expect(entry).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => states(page)).toEqual(['paused']);
  });

  test('it waits while an object is out', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect.poll(() => states(page)).toEqual(['running']);
    await drawerButton(page, 'Potaflow').press('Enter');
    await expect.poll(() => states(page)).toEqual(['paused']);
    await expect(control(page)).toBeHidden();
    await page.keyboard.press('Escape');
    await expect.poll(() => states(page)).toEqual(['running']);
  });

  test('it waits while the tab is hidden', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect.poll(() => states(page)).toEqual(['running']);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => states(page)).toEqual(['paused']);
  });

  test('it follows the glance', async ({ page }) => {
    await gotoDesk(page, '/');
    const x = () => steam(page).evaluate((el) => el.getBoundingClientRect().x);
    const before = await x();
    await page
      .locator('.desk-still')
      .evaluate((el) => (el as HTMLElement).style.setProperty('--gx', '20px'));
    await expect.poll(async () => Math.round((await x()) - before)).toBe(20);
  });

  test('it never takes the click meant for the mug', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(steam(page)).toBeAttached();
    await hotspot(page, 'mug').click();
    await expect.poll(() => path(page)).toBe('/coffee');
  });

  test('under reduced motion there is no steam and nothing to pause', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoDesk(page, '/');
    await expect(steam(page)).toBeHidden();
    await expect(control(page)).toBeHidden();
    await expect(drawerButton(page, 'Pause motion')).toHaveCount(0);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('there is no motion and no dead control', async ({ page }) => {
    await page.goto('/');
    await expect(steam(page)).toHaveCount(0);
    await expect(control(page)).toHaveCount(0);
  });
});
