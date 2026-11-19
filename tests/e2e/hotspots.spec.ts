import { expect, test } from '@playwright/test';
import { DESK_ASPECT } from '../../content/deskLayout';
import { DESK_OBJECTS } from '../../content/objects';
import { titleFor } from '../../lib/deskRoutes';
import {
  clickFelt,
  desk,
  drawerButton,
  gotoDesk,
  headerLamp,
  historyLength,
  hotspot,
  panelTitle,
  path,
} from './desk';

test.describe('still desk hotspots', () => {
  for (const obj of DESK_OBJECTS) {
    test(`clicking the ${obj.id} opens ${obj.label}`, async ({ page }) => {
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
    await hotspot(page, 'kit').click();
    expect(await historyLength(page)).toBe(after);
    expect(path(page)).toBe('/potaflow');
  });

  test('rapid object clicks, then Back, walk back in order', async ({ page }) => {
    await gotoDesk(page, '/');
    for (const id of ['badge', 'monitor', 'kit']) await hotspot(page, id).click();
    await expect.poll(() => path(page)).toBe('/potaflow');
    for (const expected of ['/how-i-build', '/experience', '/']) {
      await page.goBack();
      await expect.poll(() => path(page)).toBe(expected);
    }
  });

  test('the desk lamp switches lamp mode without navigating', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    const start = await historyLength(page);
    const before = await page.evaluate(() => document.documentElement.dataset.theme);
    await hotspot(page, 'lightbar').click();
    const after = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(after).not.toBe(before);
    const pressed = String(after === 'lamp');
    await expect(hotspot(page, 'lightbar')).toHaveAttribute('aria-pressed', pressed);
    await expect(headerLamp(page)).toHaveAttribute('aria-pressed', pressed);
    expect(path(page)).toBe('/potaflow');
    await expect(panelTitle(page)).toContainText('Potaflow');
    expect(await historyLength(page)).toBe(start);
    await headerLamp(page).click();
    await expect(hotspot(page, 'lightbar')).toHaveAttribute(
      'aria-pressed',
      String(after !== 'lamp'),
    );
  });

  test('clicking the desk lamp never focuses the hidden desk; Esc still refocuses the drawer', async ({
    page,
  }) => {
    await gotoDesk(page, '/potaflow');
    await hotspot(page, 'lightbar').click();
    expect(await page.evaluate(() => !!document.activeElement?.closest('.desk-still__layer'))).toBe(
      false,
    );
    await page.keyboard.press('Escape');
    await expect.poll(() => path(page)).toBe('/');
    await expect(drawerButton(page, 'Potaflow')).toBeFocused();
  });

  test('a same-tick burst of clicks keeps only the latest navigation pending (M1 queue)', async ({
    page,
  }) => {
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

  test('the desk box keeps the layout data aspect ratio', async ({ page }) => {
    await gotoDesk(page, '/');
    const ratio = await page
      .locator('.desk-still__layer')
      .evaluate((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
    const portrait = await page.evaluate(
      () => matchMedia('(max-width: 719px) and (orientation: portrait)').matches,
    );
    expect(ratio).toBeCloseTo(DESK_ASPECT[portrait ? 'phone' : 'wide'], 2);
  });

  test('tapping any label hits its own object', async ({ page }) => {
    await gotoDesk(page, '/');
    const misses = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('button.hotspot .sticker')].flatMap((label) => {
        const own = label.closest<HTMLElement>('button.hotspot')!.dataset.item;
        label.scrollIntoView({ block: 'center', behavior: 'instant' });
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

  test('hotspots stay out of the Tab order: header → drawer', async ({ page }) => {
    await gotoDesk(page, '/');
    await headerLamp(page).focus();
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
        return { left: s.left, top: s.top, moved: s.transform !== 'none', centred };
      }),
    );
    expect(placements.length).toBe(8);
    for (const p of placements)
      expect(p).toEqual({ left: '0px', top: '0px', moved: true, centred: true });
  });

  test('the desk shows no digits except the badge year', async ({ page }) => {
    await gotoDesk(page, '/');
    const text = (await desk(page).textContent()) ?? '';
    const stripped = text.replace(/since July 2019/g, '').replace(/\[TODO: Q\d+[^\]]*\]/g, '');
    expect(stripped).not.toMatch(/\d/);
  });

  test('the gauge needle is up when Potaflow is open', async ({ page }) => {
    const needle = () =>
      page
        .locator('.hotspot[data-item="kit"] .needle')
        .evaluate((el) => getComputedStyle(el).transform);
    await gotoDesk(page, '/');
    const resting = await needle();
    await gotoDesk(page, '/potaflow');
    expect(await needle()).not.toBe(resting);
  });

  test('the desk is Tier 1 and described for assistive tech', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(desk(page)).toHaveAttribute('data-tier', '1');
    await expect(desk(page).locator('.visually-hidden')).toContainText(DESK_OBJECTS[0]!.ariaLabel);
  });
});
