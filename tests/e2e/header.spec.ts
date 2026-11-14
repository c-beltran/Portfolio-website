import { expect, test } from '@playwright/test';
import { CAREER_START, yearsSince } from '../../lib/dates';

/** e2e runs against out/; set the same NEXT_PUBLIC_VERCEL_ENV the build used. */
const production = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';

test.describe('header', () => {
  test('shows the name, the 10-second facts and the Classic link', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('heading', { level: 1 })).toHaveText('Carlos Beltran');
    const years = yearsSince(CAREER_START, new Date());
    await expect(header).toContainText(
      `Go · backend & performance · ${years}+ years · AI-native · New York`,
    );
    await expect(header.getByRole('link', { name: /Classic version/ })).toHaveAttribute(
      'href',
      '/classic',
    );
  });

  test('the header summary is marked as a draft', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toContainText('[DRAFT: Carlos to rewrite]');
  });

  test('the page contains no email address', async ({ page }) => {
    await page.goto('/');
    expect(await page.content()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  test(`the résumé link is ${production ? 'hidden in production' : 'shown outside production'}`, async ({
    page,
  }) => {
    await page.goto('/');
    const resume = page.getByRole('banner').getByRole('link', { name: 'Download résumé' });
    await expect(resume).toHaveCount(production ? 0 : 1);
  });
});
