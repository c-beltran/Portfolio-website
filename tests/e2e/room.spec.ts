import { expect, test } from './fixtures';
import seat from '../../content/scene/bounds-seat.json' with { type: 'json' };
import { PLACES } from '../../content/places';
import { DRAFT_MARK } from '../../content/panels';
import { drawerButton, gotoDesk, hotspot, panelTitle, path } from './desk';

/**
 * The room: the model car, the soccer ball and the
 * magnet board open Cars, Soccer and Travel. The ball lies by the left wall, seen only in ultrawide
 * windows; whatever part shows is clickable, and the Sections list opens Soccer everywhere.
 */
const section = (page: import('@playwright/test').Page) => page.locator('section.panel');

test.describe('the room', () => {
  test.skip(({ isMobile }) => isMobile, 'sizes set per test');

  test('in an ultrawide window the ball opens Soccer', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 720 });
    await gotoDesk(page, '/');
    await expect(hotspot(page, 'ball')).toBeVisible();
    await hotspot(page, 'ball').click();
    await expect.poll(() => path(page)).toBe('/soccer');
    await expect(panelTitle(page)).toContainText('Soccer');
  });

  // Out of view (a pixel at most on a 2.16:1 phone): nothing to click, light or name.
  for (const [width, height] of [
    [1920, 1080],
    [390, 844],
    [844, 390],
  ] as const) {
    test(`at ${width}×${height} the ball is out of view and unlit, and the Sections list opens Soccer`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await gotoDesk(page, '/');
      const box = (await hotspot(page, 'ball').boundingBox())!;
      expect(box.x + box.width, 'no target reaches into the window').toBeLessThanOrEqual(2);
      await expect(page.locator(".desk-glow[data-item='ball']")).toBeHidden();
      await expect(hotspot(page, 'ball').locator('.sticker')).toBeHidden();
      await drawerButton(page, 'Soccer').press('Enter');
      await expect.poll(() => path(page)).toBe('/soccer');
      await expect(section(page)).toContainText('Soccer is my favorite sport');
      if (width > height)
        expect(await page.locator('.desk-still').evaluate((el) => el.scrollLeft)).toBe(0);
    });
  }

  // Wherever some of the ball shows, the
  // part that shows opens Soccer: 22% of it at 9:4, about half on a 21:9 screen.
  for (const [width, height] of [
    [915, 412],
    [852, 345],
    [1440, 640],
    [2560, 1080],
    [3440, 1440],
    [3440, 1350],
  ] as const) {
    test(`at ${width}×${height} the part of the ball in view opens Soccer, its label whole`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await gotoDesk(page, '/');
      const layer = (await page.locator('.desk-still__layer').boundingBox())!;
      const b = seat.objects.obj_ball;
      const [x0, x1] = [Math.max(0, layer.x + b.x0 * layer.width), layer.x + b.x1 * layer.width];
      await page.mouse.click((x0 + x1) / 2, layer.y + ((b.y0 + b.y1) / 2) * layer.height);
      await expect.poll(() => path(page)).toBe('/soccer');
      const label = (await hotspot(page, 'ball').locator('.sticker').boundingBox())!;
      expect(label.x, 'the label starts inside the window').toBeGreaterThanOrEqual(0);
    });
  }

  test("at 1920×1080 a pointer near the top-left never wakes the ball's label", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoDesk(page, '/');
    await page.mouse.move(60, 60);
    await page.mouse.move(40, 40);
    await page.waitForTimeout(300);
    await expect(hotspot(page, 'ball')).not.toHaveAttribute('data-near', 'true');
  });

  for (const [width, height] of [
    [1920, 1080],
    [390, 844],
  ] as const) {
    test(`at ${width}×${height} the mug opens Coffee`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await gotoDesk(page, '/');
      await hotspot(page, 'mug').click();
      await expect.poll(() => path(page)).toBe('/coffee');
      await expect(section(page)).toContainText('coffee addict');
    });
  }

  test('resizing out of ultrawide with Soccer open keeps the panel and the pressed button', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 2560, height: 720 });
    await gotoDesk(page, '/soccer');
    await expect(section(page)).toBeVisible();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(section(page)).toBeVisible();
    await expect(drawerButton(page, 'Soccer')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Travel lists his eight places, and Cars shows its draft mark and its TODO', async ({
    page,
  }) => {
    await gotoDesk(page, '/travel');
    await expect(section(page).locator('.panel__list li')).toHaveText([...PLACES]);
    await gotoDesk(page, '/cars');
    await expect(section(page)).toContainText(DRAFT_MARK);
    await expect(section(page)).toContainText(
      '[TODO: Carlos: your role and dates at Start Toyota of Bayside]',
    );
  });
});

test.describe('without JavaScript', () => {
  test.skip(({ isMobile }) => isMobile, 'one run');
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });

  test('/soccer opens its panel on a phone', async ({ page }) => {
    await page.goto('/soccer');
    await expect(section(page)).toContainText('Soccer is my favorite sport');
  });
});
