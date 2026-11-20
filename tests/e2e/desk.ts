import type { Page } from '@playwright/test';

/** Shared helpers for the still-desk specs. */
export const path = (page: Page) => new URL(page.url()).pathname;
export const historyLength = (page: Page) => page.evaluate(() => history.length);
export const panelTitle = (page: Page) => page.locator('#panel-title');
export const desk = (page: Page) => page.locator('.desk-still');
export const layer = (page: Page) => page.locator('.desk-still__layer');
export const hotspot = (page: Page, item: string) => page.locator(`.hotspot[data-item="${item}"]`);
export const drawerButton = (page: Page, label: string) =>
  page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: label, exact: true });
/** The lamp's keyboard path: the Sections list's last button (shown when focused). */
export const drawerLamp = (page: Page) => drawerButton(page, 'Lamp');

/** The desk's pan (−1…1) from its horizontal scroll; 0 when it can't scroll (wide windows). */
export const panOf = (page: Page) =>
  desk(page).evaluate((el) => {
    const max = el.scrollWidth - el.clientWidth;
    return max > 0 ? (el.scrollLeft / max) * 2 - 1 : 0;
  });

/** Load a desk route and wait until React has hydrated (listeners attached). */
export async function gotoDesk(page: Page, url: string) {
  const res = await page.goto(url);
  await page.waitForFunction(() => document.documentElement.dataset.deskReady === 'true');
  return res;
}

/**
 * Click bare desk: a point in the window on the still but on no object and outside the panel
 * (the top corners first, where the wall is). Uses the mouse so nothing scrolls first.
 */
export async function clickFelt(page: Page) {
  const pt = await page.evaluate(() => {
    const [W, H] = [innerWidth, innerHeight];
    for (const [x, y] of [
      [8, 10],
      [W - 8, 10],
      [W / 2, 10],
      [8, H * 0.4],
    ] as const) {
      const el = document.elementFromPoint(x, y);
      if (el?.closest('.desk-still__layer') && !el.closest('button.hotspot')) return [x, y];
    }
    return null;
  });
  if (!pt) throw new Error('no bare desk in view');
  await page.mouse.click(pt[0]!, pt[1]!);
}
