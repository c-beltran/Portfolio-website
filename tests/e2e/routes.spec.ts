import { expect, test, type Page } from '@playwright/test';
import { DESK_OBJECTS } from '../../content/objects';
import { titleFor } from '../../lib/deskRoutes';

const drawer = (page: Page) => page.getByRole('navigation', { name: 'Sections' });
const drawerButton = (page: Page, label: string) =>
  drawer(page).getByRole('button', { name: label, exact: true });
const panelTitle = (page: Page) => page.locator('#panel-title');
const path = (page: Page) => new URL(page.url()).pathname;
const historyLength = (page: Page) => page.evaluate(() => history.length);

test.describe('section routes', () => {
  for (const obj of DESK_OBJECTS) {
    test(`opening ${obj.label} sets the route, title, panel and focus`, async ({ page }) => {
      await page.goto('/');
      await drawerButton(page, obj.label).click();
      expect(path(page)).toBe(`/${obj.slug}`);
      await expect(page).toHaveTitle(titleFor(obj.slug));
      await expect(panelTitle(page)).toBeVisible();
      await expect(panelTitle(page)).toBeFocused();
      await expect(drawerButton(page, obj.label)).toHaveAttribute('aria-pressed', 'true');
    });
  }

  test('Back walks through opened sections in order, then to the overview', async ({ page }) => {
    await page.goto('/');
    for (const label of ['Experience', 'Potaflow', 'Contact']) {
      await drawerButton(page, label).click();
    }
    expect(path(page)).toBe('/contact');
    for (const [expected, title] of [
      ['/potaflow', 'Potaflow'],
      ['/experience', 'Same desk since July 2019'],
      ['/', null],
    ] as const) {
      await page.goBack();
      expect(path(page)).toBe(expected);
      if (title) await expect(panelTitle(page)).toContainText(title);
      else await expect(panelTitle(page)).toHaveCount(0);
    }
    await expect(page).toHaveTitle(titleFor(null));
    await expect(panelTitle(page)).toHaveCount(0);
    await page.goForward();
    expect(path(page)).toBe('/experience');
    await expect(panelTitle(page)).toContainText('Same desk since July 2019');
  });

  test('re-opening the open section and Esc with nothing open add no history', async ({ page }) => {
    await page.goto('/');
    const start = await historyLength(page);
    await page.keyboard.press('Escape');
    expect(await historyLength(page)).toBe(start);
    await drawerButton(page, 'Potaflow').click();
    await drawerButton(page, 'Potaflow').click();
    expect(await historyLength(page)).toBe(start + 1);
  });

  test('Esc closes the panel, returns to / and puts focus back on the trigger', async ({
    page,
  }) => {
    await page.goto('/');
    await drawerButton(page, 'Power Walk').click();
    await page.keyboard.press('Escape');
    expect(path(page)).toBe('/');
    await expect(panelTitle(page)).toHaveCount(0);
    await expect(drawerButton(page, 'Power Walk')).toBeFocused();
  });

  test('"Back to desk" closes the panel', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('button', { name: 'Back to desk' }).click();
    expect(path(page)).toBe('/');
    await expect(panelTitle(page)).toHaveCount(0);
  });

  for (const url of ['/potaflow', '/potaflow/']) {
    test(`a direct load of ${url} opens Potaflow without stealing focus`, async ({ page }) => {
      await page.goto(url);
      await expect(page).toHaveTitle(titleFor('potaflow'));
      await expect(panelTitle(page)).toHaveText(/Potaflow/);
      await expect(drawerButton(page, 'Potaflow')).toHaveAttribute('aria-pressed', 'true');
      await expect(panelTitle(page)).not.toBeFocused();
    });
  }

  test('an unknown route is a 404 with a link home', async ({ page }) => {
    const res = await page.goto('/nope');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('main').getByRole('link', { name: /desk|home/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  test('keyboard order: header, then the drawer, then the panel', async ({ page }) => {
    await page.goto('/');
    const names: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      names.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return `${el?.closest('header') ? 'header' : el?.closest('nav') ? 'drawer' : 'other'}:${el?.textContent?.trim()}`;
        }),
      );
    }
    const firstDrawer = names.findIndex((n) => n.startsWith('drawer:'));
    expect(firstDrawer).toBeGreaterThan(0);
    expect(names.slice(0, firstDrawer).every((n) => n.startsWith('header:'))).toBe(true);
    expect(names.slice(firstDrawer, firstDrawer + DESK_OBJECTS.length)).toEqual(
      DESK_OBJECTS.map((o) => `drawer:${o.label}`),
    );
    await drawerButton(page, 'Contact').focus();
    await page.keyboard.press('Enter');
    await expect(panelTitle(page)).toBeFocused();
  });

  test('leaving the desk and pressing Back restores the panel for that URL', async ({ page }) => {
    await page.goto('/');
    await drawerButton(page, 'Potaflow').click();
    await page
      .getByRole('banner')
      .getByRole('link', { name: /Classic version/ })
      .click();
    await expect(page).toHaveURL(/\/classic$/);
    await page.goBack();
    expect(path(page)).toBe('/potaflow');
    await expect(panelTitle(page)).toContainText('Potaflow');
    await expect(page).toHaveTitle(titleFor('potaflow'));
    await expect(drawerButton(page, 'Potaflow')).toHaveAttribute('aria-pressed', 'true');
  });

  test('closing after a direct load, then leaving and pressing Back, shows the overview', async ({
    page,
  }) => {
    await page.goto('/potaflow');
    await page.getByRole('button', { name: 'Back to desk' }).click();
    await page
      .getByRole('banner')
      .getByRole('link', { name: /Classic version/ })
      .click();
    await expect(page).toHaveURL(/\/classic$/);
    await page.goBack();
    expect(path(page)).toBe('/');
    await expect(panelTitle(page)).toHaveCount(0);
    await expect(page).toHaveTitle(titleFor(null));
  });

  test("closing after a direct load puts focus on that section's drawer button", async ({
    page,
  }) => {
    await page.goto('/potaflow');
    await page.keyboard.press('Escape');
    await expect(drawerButton(page, 'Potaflow')).toBeFocused();
  });

  test("Back that closes the panel moves focus to the closed section's button", async ({
    page,
  }) => {
    await page.goto('/');
    await drawerButton(page, 'About').click();
    await expect(panelTitle(page)).toBeFocused();
    await page.goBack();
    await expect(drawerButton(page, 'About')).toBeFocused();
  });

  test('Esc after Back focuses the section that was open, not the last one clicked', async ({
    page,
  }) => {
    await page.goto('/');
    await drawerButton(page, 'Experience').click();
    await drawerButton(page, 'Contact').click();
    await page.goBack();
    await expect(panelTitle(page)).toContainText('Same desk');
    await page.keyboard.press('Escape');
    await expect(drawerButton(page, 'Experience')).toBeFocused();
  });

  test('two clicks in the same task still add one history entry', async ({ page }) => {
    await page.goto('/');
    const start = await historyLength(page);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('nav button')].find(
        (el) => el.textContent === 'Potaflow',
      ) as HTMLButtonElement;
      b.click();
      b.click();
    });
    expect(await historyLength(page)).toBe(start + 1);
  });

  test('Tab moves from the drawer into the open panel', async ({ page }) => {
    await page.goto('/');
    await drawerButton(page, 'Contact').click();
    await expect(panelTitle(page)).toBeFocused();
    await drawerButton(page, 'Contact').focus();
    await page.keyboard.press('Tab');
    const inPanel = await page.evaluate(() => !!document.activeElement?.closest('section.panel'));
    expect(inPanel).toBe(true);
  });

  test('the 404 page has a title', async ({ page }) => {
    await page.goto('/nope');
    await expect(page).toHaveTitle(/Carlos Beltran/);
  });
});
