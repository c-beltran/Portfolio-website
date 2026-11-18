import { expect, test } from '@playwright/test';

// /lab/monitor is a throwaway test page (M3b Part A): never indexed, never linked, deleted when
// Part C starts.
test.describe('/lab/monitor', () => {
  test('is not indexed', async ({ page }) => {
    const r = await page.goto('/lab/monitor');
    expect(r?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('is not in the sitemap or linked from the site', async ({ page, request }) => {
    expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/lab');
    for (const route of ['/', '/classic']) {
      await page.goto(route);
      await expect(page.locator('a[href*="/lab"]')).toHaveCount(0);
    }
  });

  test('loads with no failed requests', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
    page.on('requestfailed', (r) => failed.push(`failed ${r.url()}`));
    await page.goto('/lab/monitor');
    await page.waitForLoadState('networkidle');
    expect(failed).toEqual([]);
  });

  test('plays the clip to the monitor and reports its frame rate', async ({ page }) => {
    await page.goto('/lab/monitor');
    await page.getByRole('radio', { name: 'Clips' }).check();
    await page.getByRole('button', { name: 'Monitor' }).click();
    await expect(page.getByTestId('lab-state')).toHaveText('monitor', { timeout: 10_000 });
    await expect(page.getByTestId('lab-fps')).toContainText('fps');
  });
});
