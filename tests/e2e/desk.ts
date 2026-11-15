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
export const headerLamp = (page: Page) => page.locator('.site-header .lamp-toggle');

/** Load a desk route and wait until React has hydrated (listeners attached). */
export async function gotoDesk(page: Page, url: string) {
  const res = await page.goto(url);
  await page.waitForFunction(() => document.documentElement.dataset.deskReady === 'true');
  return res;
}

/**
 * Click bare felt: the desk's left edge (clear of every object in both layouts), halfway down
 * the part of the desk that isn't under the phone sheet. Uses the mouse so nothing scrolls first.
 */
export async function clickFelt(page: Page) {
  // Like a person would: bring the desk to the top of the screen, above any open sheet.
  await layer(page).evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  const box = await layer(page).boundingBox();
  if (!box) throw new Error('desk layer not rendered');
  const sheetTop = await page.evaluate(() => {
    const el = document.querySelector('section.panel');
    if (!el || getComputedStyle(el).position !== 'fixed') return innerHeight;
    return el.getBoundingClientRect().top;
  });
  const top = Math.max(box.y, 0);
  const bottom = Math.min(box.y + box.height, sheetTop);
  if (bottom - top < 4) throw new Error('no visible felt above the sheet');
  await page.mouse.click(box.x + box.width * 0.005, (top + bottom) / 2);
}
