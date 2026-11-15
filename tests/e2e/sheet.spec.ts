import { expect, test, type Page } from '@playwright/test';
import { desk, gotoDesk, hotspot, panelTitle, path } from './desk';

const panel = (page: Page) => page.locator('section.panel');

/** True when the element's box is fully above the open sheet and inside the viewport. */
async function visibleAboveSheet(page: Page, item: string) {
  const el = await hotspot(page, item).boundingBox();
  const sheet = await panel(page).boundingBox();
  return !!el && !!sheet && el.y >= 0 && el.y + el.height <= sheet.y + 1;
}

test.describe('phone bottom sheet', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone layout only');

  test('opens fixed to the bottom, with the object visible above it', async ({ page }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'gauge').click();
    expect(path(page)).toBe('/potaflow');
    const vh = await page.evaluate(() => innerHeight);
    await expect
      .poll(async () => {
        const b = await panel(page).boundingBox();
        return b ? Math.round(b.y + b.height) : -1;
      })
      .toBeGreaterThanOrEqual(vh - 1);
    expect(await panel(page).evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
    await expect.poll(() => visibleAboveSheet(page, 'gauge')).toBe(true);
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

  test('an object visible above the sheet switches sections', async ({ page }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'gauge').click();
    await expect.poll(() => visibleAboveSheet(page, 'photo')).toBe(true);
    await hotspot(page, 'photo').click();
    expect(path(page)).toBe('/about');
    await expect(panelTitle(page)).toContainText("Hi, I'm Carlos.");
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
    const lift = await hotspot(page, 'gauge').evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--lift'),
    );
    expect(lift).toContain('scale(1.07)');
  });

  test('the first section opened slides the sheet up', async ({ page }) => {
    await gotoDesk(page, '/');
    await panel(page).evaluate((el) => {
      (window as unknown as { slid: string[] }).slid = [];
      (el as HTMLElement).addEventListener('transitionrun', (e) =>
        (window as unknown as { slid: string[] }).slid.push(e.propertyName),
      );
    });
    await hotspot(page, 'gauge').click();
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

  for (const [w, h] of [
    [568, 320],
    [667, 375],
    [844, 390],
    [800, 600],
  ] as const) {
    test(`at ${w}×${h} an opened object stays visible above the sheet`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await gotoDesk(page, '/');
      for (const b of await page.locator('button.hotspot').all()) {
        const box = (await b.boundingBox())!;
        expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
      }
      for (const item of ['gauge', 'laptop', 'card']) {
        await hotspot(page, item).click();
        expect(await panel(page).evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
        await expect.poll(() => visibleAboveSheet(page, item), { message: item }).toBe(true);
      }
    });
  }
});

test.describe('wide layout', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop layout only');

  test('the panel sits beside the desk', async ({ page }) => {
    await gotoDesk(page, '/potaflow');
    const d = (await desk(page).boundingBox())!;
    const p = (await panel(page).boundingBox())!;
    expect(p.x).toBeGreaterThan(d.x + d.width - 1);
    expect(p.y).toBeLessThan(d.y + d.height);
  });

  test('two columns from 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoDesk(page, '/potaflow');
    const d = (await desk(page).boundingBox())!;
    const p = (await panel(page).boundingBox())!;
    expect(p.x).toBeGreaterThan(d.x + d.width - 1);
  });

  test('below 1024px the panel is a sheet, not pushed under the desk', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await gotoDesk(page, '/');
    await hotspot(page, 'gauge').click();
    expect(await panel(page).evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
    await expect.poll(() => visibleAboveSheet(page, 'gauge')).toBe(true);
  });

  test('the empty panel invites a pick', async ({ page }) => {
    await gotoDesk(page, '/');
    await expect(panel(page)).toContainText('Pick something up on the desk, or open a drawer.');
  });

  test('resizing to a phone keeps the section open as a sheet, with focus intact', async ({
    page,
  }) => {
    await gotoDesk(page, '/');
    await hotspot(page, 'gauge').click();
    await expect(panelTitle(page)).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(path(page)).toBe('/potaflow');
    expect(await panel(page).evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  });
});
