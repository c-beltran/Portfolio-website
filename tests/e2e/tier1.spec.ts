import { expect, test } from './fixtures';
import { DESK_OBJECTS } from '../../content/objects';
import {
  clickFelt,
  desk,
  drawerButton,
  gotoDesk,
  hotspot,
  panelTitle,
  path,
  onScreen,
} from './desk';

/** The still desk is a complete site by itself. */

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('uses Tier 1 with no transitions or idle animation, and still opens sections', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    await expect(desk(page)).toHaveAttribute('data-tier', '1');
    const motion = await page.evaluate(() => ({
      hotspots: [...document.querySelectorAll('button.hotspot')].map(
        (el) => getComputedStyle(el).transitionDuration,
      ),
      lamp: getComputedStyle(document.querySelector('.desk-still__photo--lamp img')!)
        .transitionDuration,
    }));
    expect(new Set(motion.hotspots)).toEqual(new Set(['0s']));
    expect(motion.lamp).toBe('0s');
    await hotspot(page, 'kit').click();
    expect(path(page)).toBe('/potaflow');
    await expect(panelTitle(page)).toBeFocused();
  });
});

test.describe('WebGL off', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      delete w.WebGL2RenderingContext;
      delete w.WebGLRenderingContext;
      HTMLCanvasElement.prototype.getContext = () => null;
    });
  });

  test('the desk, every object, the drawer and the panel still work', async ({ page }) => {
    await gotoDesk(page, '/');
    expect(await page.evaluate(() => 'WebGLRenderingContext' in window)).toBe(false);
    await expect(page.locator('button.hotspot')).toHaveCount(DESK_OBJECTS.length + 1);
    const v = page.viewportSize()!;
    for (const o of DESK_OBJECTS) {
      // an object off screen at this size (the ball until 13:5) opens from its Sections button
      if (onScreen(o.id, v.width, v.height)) await hotspot(page, o.id).click();
      else await drawerButton(page, o.label).press('Enter');
      await expect.poll(() => path(page)).toBe(`/${o.slug}`);
      await expect(panelTitle(page)).toBeVisible();
      // The panel card covers the right of a wide window (an object that comes forward
      // sits beside it); close it on bare desk before reaching for the next object.
      await clickFelt(page);
      await expect.poll(() => path(page)).toBe('/');
      // closing hands focus back to the object's Sections button; a key pressed before that is lost
      await expect(drawerButton(page, o.label)).toBeFocused();
    }
    await drawerButton(page, 'Contact').press('Enter');
    await expect(drawerButton(page, 'Contact')).toHaveAttribute('aria-pressed', 'true');
  });

  for (const o of DESK_OBJECTS) {
    test(`/${o.slug} loads directly with its panel open`, async ({ page }) => {
      await gotoDesk(page, `/${o.slug}`);
      await expect(panelTitle(page)).toBeVisible();
      await expect(hotspot(page, o.id)).toHaveAttribute('aria-pressed', 'true');
    });
  }
});

test.describe('keyboard only', () => {
  test('a drawer button opens its section; Esc returns focus to it', async ({ page }) => {
    await gotoDesk(page, '/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(drawerButton(page, DESK_OBJECTS[1]!.label)).toBeFocused();
    await page.keyboard.press('Enter');
    expect(path(page)).toBe(`/${DESK_OBJECTS[1]!.slug}`);
    await expect(panelTitle(page)).toBeFocused();
    await page.keyboard.press('Escape');
    expect(path(page)).toBe('/');
    await expect(drawerButton(page, DESK_OBJECTS[1]!.label)).toBeFocused();
  });
});

test.describe('no JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('a section route renders the desk with its object lifted and the panel filled', async ({
    page,
  }) => {
    await page.goto('/potaflow');
    await expect(desk(page)).toBeVisible();
    await expect(hotspot(page, 'kit')).toHaveAttribute('aria-pressed', 'true');
    await expect(panelTitle(page)).toContainText('Potaflow');
  });
});
