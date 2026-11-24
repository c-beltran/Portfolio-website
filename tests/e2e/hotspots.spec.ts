import { expect, test } from './fixtures';
import { INTERACTIVE, LAYOUT } from '../../content/deskLayout';
import { master, viewOffset } from '../../content/scene/framing';
import { DESK_OBJECTS } from '../../content/objects';
import { titleFor } from '../../lib/deskRoutes';
import {
  atNight,
  clickFelt,
  desk,
  drawerButton,
  drawerLamp,
  gotoDesk,
  historyLength,
  hotspot,
  lampOff,
  onScreen,
  panOf,
  panelTitle,
  path,
} from './desk';

test.describe('still desk hotspots', () => {
  for (const obj of DESK_OBJECTS) {
    test(`clicking the ${obj.id} opens ${obj.label}`, async ({ page }) => {
      const v = page.viewportSize()!;
      test.skip(!onScreen(obj.id, v.width, v.height), 'off screen until 13:5 (room.spec.ts)');
      await gotoDesk(page, '/');
      await hotspot(page, obj.id).click();
      expect(path(page)).toBe(`/${obj.slug}`);
      await expect(page).toHaveTitle(titleFor(obj.slug));
      await expect(panelTitle(page)).toBeFocused();
      await expect(hotspot(page, obj.id)).toHaveAttribute('aria-pressed', 'true');
      await expect(drawerButton(page, obj.label)).toHaveAttribute('aria-pressed', 'true');
    });
  }

  test('clicking bare felt closes the section and refocuses its drawer button', async ({
    page,
  }) => {
    await gotoDesk(page, '/potaflow');
    await clickFelt(page);
    expect(path(page)).toBe('/');
    await expect(panelTitle(page)).toHaveCount(0);
    await expect(drawerButton(page, 'Potaflow')).toBeFocused();
  });

  test('clicking the open object again adds no history', async ({ page }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'kit').click();
    const after = await historyLength(page);
    // On a phone the sheet now covers the kit: click the element itself.
    await hotspot(page, 'kit').evaluate((el) => (el as HTMLElement).click());
    expect(await historyLength(page)).toBe(after);
    expect(path(page)).toBe('/potaflow');
  });

  test('rapid object clicks, then Back, walk back in order', async ({ page }) => {
    await gotoDesk(page, '/');
    // Click the elements themselves: on a phone the second section's sheet covers the kit, and a
    // pointer click only got there while the sheet was still sliding up (lost under load).
    for (const id of ['badge', 'monitor', 'kit'])
      await hotspot(page, id).evaluate((el) => (el as HTMLElement).click());
    await expect.poll(() => path(page)).toBe('/potaflow');
    for (const expected of ['/how-i-build', '/experience', '/']) {
      await page.goBack();
      await expect.poll(() => path(page)).toBe(expected);
    }
  });

  // On the desk: while an object is out, the dimmed desk (the light bar included) is one close
  // target and the lamp is in the Sections list.
  test('the desk lamp switches lamp mode without navigating', async ({ page }) => {
    await gotoDesk(page, '/');
    const start = await historyLength(page);
    const before = await page.evaluate(() => document.documentElement.dataset.lamp);
    await hotspot(page, 'lightbar').click();
    const after = await page.evaluate(() => document.documentElement.dataset.lamp);
    expect(after).not.toBe(before);
    const pressed = String(after === 'on');
    await expect(hotspot(page, 'lightbar')).toHaveAttribute('aria-pressed', pressed);
    await expect(drawerLamp(page)).toHaveAttribute('aria-pressed', pressed);
    expect(path(page)).toBe('/');
    expect(await historyLength(page)).toBe(start);
    await drawerLamp(page).focus();
    await page.keyboard.press('Enter');
    await expect(hotspot(page, 'lightbar')).toHaveAttribute('aria-pressed', String(after !== 'on'));
  });

  test('clicking the desk lamp never focuses the hidden desk', async ({ page }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'lightbar').click();
    expect(await page.evaluate(() => !!document.activeElement?.closest('.desk-still__layer'))).toBe(
      false,
    );
  });

  test("while the badge is out, the Sections list's Lamp toggles the lamp and the badge stays out", async ({
    page,
  }) => {
    await gotoDesk(page, '/experience');
    const before = await page.evaluate(() => document.documentElement.dataset.lamp);
    await drawerLamp(page).focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.lamp))
      .not.toBe(before);
    expect(path(page)).toBe('/experience');
    await expect(page.locator('main.desk')).toHaveAttribute('data-open', 'badge');
    await expect(panelTitle(page)).toContainText('Same desk since July 2019');
  });

  test('a same-tick burst of clicks keeps only the latest navigation pending', async ({ page }) => {
    await gotoDesk(page, '/');
    await page.evaluate(() => {
      for (const id of ['badge', 'monitor', 'kit', 'kit'])
        document.querySelector<HTMLElement>(`.hotspot[data-item="${id}"]`)!.click();
    });
    await expect.poll(() => path(page)).toBe('/potaflow');
    await page.goBack();
    await expect.poll(() => path(page)).toBe('/experience');
    await page.goBack();
    await expect.poll(() => path(page)).toBe('/');
  });

  test('the desk layer is the seat master, at its aspect', async ({ page }) => {
    await gotoDesk(page, '/');
    const ratio = await page
      .locator('.desk-still__layer')
      .evaluate((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
    expect(ratio).toBeCloseTo(master().w / master().h, 2);
  });

  test('tapping any label hits its own object', async ({ page }) => {
    await gotoDesk(page, '/');
    const misses = await page.evaluate(() =>
      // an ultrawide-only object's label is display: none until it shows
      [...document.querySelectorAll<HTMLElement>('button.hotspot .sticker')]
        .filter((label) => label.getClientRects().length > 0)
        .flatMap((label) => {
          const own = label.closest<HTMLElement>('button.hotspot')!.dataset.item;
          label.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
          const r = label.getBoundingClientRect();
          return [0.2, 0.5, 0.8].flatMap((fx) => {
            const hit = document
              .elementFromPoint(r.left + r.width * fx, r.top + r.height / 2)
              ?.closest<HTMLElement>('button.hotspot')?.dataset.item;
            return hit === own ? [] : [`${own} label at ${fx}: hit ${hit ?? 'felt'}`];
          });
        }),
    );
    expect(misses).toEqual([]);
  });

  test('hotspots stay out of the Tab order: the first Tab reaches the drawer', async ({ page }) => {
    await gotoDesk(page, '/');
    await page.keyboard.press('Tab');
    await expect(drawerButton(page, DESK_OBJECTS[0]!.label)).toBeFocused();
    for (const b of await page.locator('button.hotspot').all()) {
      await expect(b).toHaveAttribute('tabindex', '-1');
    }
    await expect(page.locator('.desk-still__layer')).toHaveAttribute('aria-hidden', 'true');
  });

  test('hotspots are placed by transform only', async ({ page }) => {
    await gotoDesk(page, '/');
    const placements = await page.locator('button.hotspot').evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        const [ox, oy] = s.transformOrigin.split(' ').map(parseFloat);
        const centred =
          Math.abs(ox! - (el as HTMLElement).offsetWidth / 2) < 1 &&
          Math.abs(oy! - (el as HTMLElement).offsetHeight / 2) < 1;
        const shown = el.getClientRects().length > 0; // the ball is display: none until 13:5
        return { left: s.left, top: s.top, moved: s.transform !== 'none', centred, shown };
      }),
    );
    expect(placements.length).toBe(DESK_OBJECTS.length + 1); // the sections and the lamp
    for (const { shown, ...p } of placements)
      if (shown) expect(p).toEqual({ left: '0px', top: '0px', moved: true, centred: true });
  });

  test('the desk shows no digits except the badge year', async ({ page }) => {
    await gotoDesk(page, '/');
    const text = (await desk(page).textContent()) ?? '';
    const stripped = text.replace(/since July 2019/g, '').replace(/\[TODO: Q\d+[^\]]*\]/g, '');
    expect(stripped).not.toMatch(/\d/);
  });

  test('the lamp render is downloaded once the page is idle, so the switch is instant', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    await expect
      .poll(() =>
        page
          .locator('.desk-still__photo--lamp img')
          .evaluate(
            (el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0,
          ),
      )
      .toBe(true);
  });

  test('lamp mode shows the lamp render', async ({ page }) => {
    const lampOpacity = () =>
      page
        .locator('.desk-still__photo--lamp img')
        .evaluate((el) => Number(getComputedStyle(el).opacity));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // At night with the lamp off, the lamp's switch brings up the lamp render.
    await atNight(page);
    await lampOff(page);
    await gotoDesk(page, '/');
    expect(await lampOpacity()).toBe(0);
    await hotspot(page, 'lightbar').click();
    expect(await lampOpacity()).toBe(1);
  });

  test('the desk is Tier 1 and described for assistive tech', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(desk(page)).toHaveAttribute('data-tier', '1');
    await expect(desk(page).locator('.visually-hidden')).toContainText(DESK_OBJECTS[0]!.ariaLabel);
  });
});

// Every object is clickable at its own place in the render, in the smallest
// windows: a 568×320 landscape phone and a 320×480 portrait one. An object off to
// the side of a portrait window is scrolled to first, as a visitor would swipe to it.
for (const viewport of [
  { width: 568, height: 320 },
  { width: 320, height: 480 },
]) {
  test.describe(`clicking the centre of each object's projected box (${viewport.width}×${viewport.height})`, () => {
    test.use({ viewport });
    for (const id of INTERACTIVE) {
      test(`opens ${id}`, async ({ page }) => {
        test.skip(!onScreen(id, viewport.width, viewport.height), 'off screen until 13:5');
        await gotoDesk(page, '/');
        await hotspot(page, id).evaluate((el) =>
          el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' }),
        );
        const { width: W, height: H } = viewport;
        const o = viewOffset(W / H, W, H, await panOf(page));
        const b = LAYOUT[id];
        await page.mouse.click(
          ((b.x + b.w / 2) / 100) * o.fullW - o.x,
          ((b.y + b.h / 2) / 100) * o.fullH - o.y,
        );
        if (id === 'lightbar') {
          await expect(hotspot(page, id)).toHaveAttribute('aria-pressed', 'true');
          return;
        }
        const obj = DESK_OBJECTS.find((o) => o.id === id)!;
        await expect.poll(() => path(page)).toBe(`/${obj.slug}`);
        await expect(hotspot(page, id)).toHaveAttribute('aria-pressed', 'true');
      });
    }
  });
}
