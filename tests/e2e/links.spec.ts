import { expect, test } from '@playwright/test';

/**
 * Every same-origin link on these pages resolves (no dead résumé button, no broken routes). The
 * desk itself navigates with buttons, so only /classic must have links.
 */
for (const route of ['/', '/contact', '/classic']) {
  test(`${route}: every same-origin link returns 200`, async ({ page, request, baseURL }) => {
    await page.goto(route);
    const hrefs = await page.$$eval('a[href]', (as) =>
      as.map((a) => (a as HTMLAnchorElement).href),
    );
    const local = [...new Set(hrefs.filter((h) => h.startsWith(baseURL!)))];
    if (route === '/classic') expect(local.length).toBeGreaterThan(0);
    for (const href of local) {
      expect((await request.get(href)).status(), href).toBe(200);
    }
  });
}

test('without a résumé PDF, previews show a visible TODO instead of a dead link', async ({
  page,
}) => {
  test.skip(process.env.NEXT_PUBLIC_VERCEL_ENV === 'production', 'production shows nothing');
  await page.goto('/classic');
  await expect(page.getByRole('banner')).toContainText('[TODO: Q15 résumé PDF]');
});

for (const route of ['/potaflow', '/power-walk', '/this-site']) {
  test(`${route}: project stats carry their definition and date`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('section.panel')).toContainText('Co-authored share:');
    await expect(page.locator('section.panel')).toContainText('Counts as of');
  });
}
