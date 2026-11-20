import { expect, test, type Page } from '@playwright/test';
import { desk, gotoDesk, hotspot, panelTitle, path } from './desk';

const panel = (page: Page) => page.locator('section.panel');

/**
 * Where the open panel sits (design 2026-11-19 §3.2): a card at the right of wide windows, a
 * bottom sheet in portrait ones. In phase 1 it may cover the opened object; phase 2 brings the
 * object forward beside it.
 */
async function panelPlace(page: Page): Promise<'card' | 'sheet' | 'other'> {
  const { W, H } = await page.evaluate(() => ({ W: innerWidth, H: innerHeight }));
  const b = (await panel(page).boundingBox())!;
  const fixed = (await panel(page).evaluate((el) => getComputedStyle(el).position)) === 'fixed';
  if (!fixed) return 'other';
  if (Math.abs(b.y + b.height - H) <= 1 && Math.abs(b.width - W) <= 1) return 'sheet';
  if (Math.abs(b.x + b.width - (W - 16)) <= 1 && b.y >= 15 && b.width >= 320 && b.width <= 460)
    return 'card';
  return 'other';
}

test.describe('phone bottom sheet', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone layout only');

  test('opens fixed to the bottom', async ({ page }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'kit').click();
    expect(path(page)).toBe('/potaflow');
    const vh = await page.evaluate(() => innerHeight);
    await expect
      .poll(async () => {
        const b = await panel(page).boundingBox();
        return b ? Math.round(b.y + b.height) : -1;
      })
      .toBeGreaterThanOrEqual(vh - 1);
    expect(await panel(page).evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
    await expect.poll(() => panelPlace(page)).toBe('sheet');
  });

  test('keyboard focus is never hidden under the open sheet', async ({ page }) => {
    await gotoDesk(page, '/');
    await page
      .getByRole('navigation', { name: 'Sections' })
      .getByRole('button', { name: 'Potaflow' })
      .focus();
    await page.keyboard.press('Enter');
    await expect(panelTitle(page)).toBeFocused();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Shift+Tab');
      const { inSheet, bottom, sheetTop } = await page.evaluate(() => {
        const a = document.activeElement!;
        const sheet = document.querySelector('section.panel')!.getBoundingClientRect();
        return {
          inSheet: !!a.closest('section.panel'),
          bottom: a.getBoundingClientRect().bottom,
          sheetTop: sheet.top,
        };
      });
      if (!inSheet) expect(bottom, `shift+tab ×${i + 1}`).toBeLessThanOrEqual(sheetTop + 1);
    }
  });

  test('closing the sheet is instant: the empty hint never slides', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    await panel(page).evaluate((el) => {
      (window as unknown as { slid: string[] }).slid = [];
      (el as HTMLElement).addEventListener('transitionrun', (e) =>
        (window as unknown as { slid: string[] }).slid.push(e.propertyName),
      );
    });
    await page.getByRole('button', { name: 'Back to desk' }).click();
    await expect.poll(() => path(page)).toBe('/');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as unknown as { slid: string[] }).slid)).toEqual([]);
  });

  test('scrolls to its last line, with Back to desk always reachable', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    const back = page.getByRole('button', { name: 'Back to desk' });
    await panel(page).evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const atEnd = await panel(page).evaluate(
      (el) => Math.abs(el.scrollTop + el.clientHeight - el.scrollHeight) <= 1,
    );
    expect(atEnd).toBe(true);
    await expect(panel(page).locator(':scope > :last-child')).toBeInViewport();
    await expect(back).toBeInViewport();
  });

  test('an object above the open sheet switches sections', async ({ page }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'kit').click();
    await expect.poll(() => panelPlace(page)).toBe('sheet');
    // The monitor stands above the sheet's top edge in the straight-ahead view.
    const [m, sheet] = [
      await hotspot(page, 'monitor').boundingBox(),
      await panel(page).boundingBox(),
    ];
    expect(m!.y + m!.height / 2).toBeLessThan(sheet!.y);
    await hotspot(page, 'monitor').click();
    expect(path(page)).toBe('/how-i-build');
  });

  test('a direct load paints the sheet already open, with no slide-in', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { transitions: string[] }).transitions = [];
      document.addEventListener(
        'transitionrun',
        (e) => {
          const t = e.target as Element;
          if (t.matches?.('section.panel'))
            (window as unknown as { transitions: string[] }).transitions.push(e.propertyName);
        },
        true,
      );
    });
    await gotoDesk(page, '/potaflow');
    await page.waitForTimeout(400);
    expect(
      await page.evaluate(() => (window as unknown as { transitions: string[] }).transitions),
    ).toEqual([]);
    expect(await panel(page).evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    // The open object paints already ringed.
    const ring = await hotspot(page, 'kit').evaluate((el) => getComputedStyle(el).boxShadow);
    expect(ring).not.toBe('none');
  });

  test('the first section opened slides the sheet up', async ({ page }) => {
    await gotoDesk(page, '/');
    await panel(page).evaluate((el) => {
      (window as unknown as { slid: string[] }).slid = [];
      (el as HTMLElement).addEventListener('transitionrun', (e) =>
        (window as unknown as { slid: string[] }).slid.push(e.propertyName),
      );
    });
    await hotspot(page, 'kit').click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { slid: string[] }).slid))
      .toContain('transform');
  });

  test('the empty sheet stays in the accessibility tree as a live region', async ({ page }) => {
    await gotoDesk(page, '/');
    const state = await panel(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return { display: s.display, visibility: s.visibility, live: el.getAttribute('aria-live') };
    });
    expect(state).toEqual({ display: 'block', visibility: 'visible', live: 'polite' });
    await expect(panel(page)).not.toBeInViewport();
  });

  test('no horizontal scroll at phone widths, and every object is at least 44px', async ({
    page,
  }) => {
    for (const [w, h] of [
      [320, 640],
      [375, 812],
      [430, 932],
      [844, 390],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await gotoDesk(page, '/potaflow');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `${w}×${h}`).toBeLessThanOrEqual(0);
    }
    await page.setViewportSize({ width: 320, height: 640 });
    await gotoDesk(page, '/');
    for (const b of await page.locator('button.hotspot').all()) {
      const box = (await b.boundingBox())!;
      expect(
        Math.min(box.width, box.height),
        (await b.getAttribute('data-item')) ?? '',
      ).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('landscape phones and small tablets', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch devices');

  test('the smallest landscape phone with toolbars keeps 44px targets', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 270 });
    await gotoDesk(page, '/');
    for (const b of await page.locator('button.hotspot').all()) {
      const box = (await b.boundingBox())!;
      expect(
        Math.min(box.width, box.height),
        (await b.getAttribute('data-item')) ?? '',
      ).toBeGreaterThanOrEqual(44);
    }
  });

  for (const [w, h] of [
    [568, 320],
    [667, 375],
    [844, 390],
    [800, 600],
  ] as const) {
    test(`at ${w}×${h} the panel opens as a card at the right`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await gotoDesk(page, '/');
      for (const b of await page.locator('button.hotspot').all()) {
        const box = (await b.boundingBox())!;
        expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
      }
      await hotspot(page, 'kit').click();
      expect(path(page)).toBe('/potaflow');
      await expect.poll(() => panelPlace(page)).toBe('card');
    });
  }
});

test.describe('wide layout', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop layout only');

  test('the panel is a card at the right of the window', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    await expect.poll(() => panelPlace(page)).toBe('card');
    const d = (await desk(page).boundingBox())!;
    expect([d.x, d.y, d.width, d.height]).toEqual([0, 0, 1280, 800]);
  });

  test('a card at 1024×768 too', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoDesk(page, '/potaflow');
    await expect.poll(() => panelPlace(page)).toBe('card');
  });

  test('portrait windows get the bottom sheet, wide ones the card', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await gotoDesk(page, '/');
    await hotspot(page, 'kit').click();
    await expect.poll(() => panelPlace(page)).toBe('sheet');
    await page.setViewportSize({ width: 900, height: 700 });
    await expect.poll(() => panelPlace(page)).toBe('card');
  });

  test('the empty panel invites a pick', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(panel(page)).toContainText('Pick something up on the desk, or open a drawer.');
  });

  test('resizing to a phone keeps the section open as a sheet, with focus intact', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'kit').click();
    await expect(panelTitle(page)).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(path(page)).toBe('/potaflow');
    expect(await panel(page).evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  });
});
