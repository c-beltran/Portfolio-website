import { expect, test } from './fixtures';

for (const route of ['/', '/potaflow', '/classic']) {
  test(`${route} loads with no failed requests`, async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
    page.on('requestfailed', (r) => failed.push(`failed ${r.url()}`));
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    expect(failed).toEqual([]);
  });
}

test('the page declares an icon', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
});
