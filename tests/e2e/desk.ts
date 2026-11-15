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

/** Click bare felt (bottom-left corner, clear of every object in both layouts). */
export async function clickFelt(page: Page) {
  const box = await layer(page).boundingBox();
  if (!box) throw new Error('desk layer not rendered');
  await layer(page).click({ position: { x: box.width * 0.02, y: box.height * 0.97 } });
}
