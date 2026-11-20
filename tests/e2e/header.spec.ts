import { expect, test } from './fixtures';
import { CAREER_START, yearsSince } from '../../lib/dates';

/** e2e runs against out/; set the same NEXT_PUBLIC_VERCEL_ENV the build used. */
const production = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';

// The header lives on /classic (and 404) since the desk fills the window (design 2026-11-19 §3.1).
test.describe('header', () => {
  test('the desk has no header: it fills the window', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toHaveCount(0);
  });

  test('on /classic: the name, the 10-second facts and the Classic link', async ({ page }) => {
    await page.goto('/classic');
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
    await page.goto('/classic');
    await expect(page.getByRole('banner')).toContainText('[DRAFT: Carlos to rewrite]');
  });

  for (const url of ['/', '/classic', '/contact', '/about', '/potaflow', '/nope']) {
    test(`${url} contains no email address`, async ({ page }) => {
      await page.goto(url);
      expect(await page.content()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    });
  }

  test(`the résumé link is ${production ? 'hidden in production' : 'shown outside production'}`, async ({
    page,
  }) => {
    await page.goto('/classic');
    // No PDF exists yet, so no build links to it; previews show a TODO instead (links.spec).
    const resume = page.getByRole('banner').getByRole('link', { name: 'Download résumé' });
    await expect(resume).toHaveCount(0);
    await expect(page.getByRole('banner')).toContainText(
      production ? 'Carlos Beltran' : '[TODO: Q15 résumé PDF]',
    );
    if (production) await expect(page.getByRole('banner')).not.toContainText('[TODO: Q15');
  });
});
