import { expect, test } from '@playwright/test';

const theme = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.dataset.theme);

test.describe('theme', () => {
  test('the theme script runs in <head>, before the body paints', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const head = html.slice(0, html.indexOf('<body'));
    expect(head).toContain("localStorage.getItem('desk-theme')");
  });

  test('dark OS gives lamp on load', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await theme(page)).toBe('lamp');
    await ctx.close();
  });

  test('light OS gives day on load', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await theme(page)).toBe('day');
    await ctx.close();
  });

  test('the lamp toggle switches theme and the choice survives a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const lamp = page.getByRole('button', { name: 'Lamp' });
    await expect(lamp).toHaveAttribute('aria-pressed', 'false');
    await lamp.click();
    await expect(lamp).toHaveAttribute('aria-pressed', 'true');
    expect(await theme(page)).toBe('lamp');
    await page.reload();
    expect(await theme(page)).toBe('lamp');
    await expect(page.getByRole('button', { name: 'Lamp' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('blocked storage: no errors, follows the OS, toggle still works', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    await ctx.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('storage blocked');
        },
      });
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    expect(await theme(page)).toBe('lamp');
    await page.getByRole('button', { name: 'Lamp' }).click();
    expect(await theme(page)).toBe('day');
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('the lamp toggle is at least 44px in both dimensions', async ({ page }) => {
    await page.goto('/');
    const box = await page.getByRole('button', { name: 'Lamp' }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
