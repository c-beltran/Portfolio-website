import { expect, test, type Page } from '@playwright/test';

/** Page views the Vercel Analytics component queued (the local server has no beacon endpoint). */
const pageviews = (page: Page) =>
  page.evaluate(() =>
    ((window as unknown as { vaq?: unknown[][] }).vaq ?? [])
      .filter((e) => e[0] === 'pageview')
      .map((e) => (e[1] as { path?: string } | undefined)?.path),
  );

test('opening a section, going Back and visiting /classic each send a page view', async ({
  page,
}) => {
  await page.goto('/');
  await expect.poll(() => pageviews(page)).toContain('/');
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: 'Potaflow' })
    .click();
  await expect.poll(async () => (await pageviews(page)).at(-1)).toBe('/potaflow');
  await page.goBack();
  await expect.poll(async () => (await pageviews(page)).at(-1)).toBe('/');
  await page.goto('/classic');
  await expect.poll(async () => (await pageviews(page)).at(-1)).toBe('/classic');
});
