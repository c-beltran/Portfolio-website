import { expect, request as pwRequest, test } from '@playwright/test';

/** Runs only in preview mode (PREVIEW_URL set), against the protected Vercel preview. */
const PREVIEW_URL = process.env.PREVIEW_URL;
test.skip(!PREVIEW_URL, 'PREVIEW_URL is not set');

const gotoDesk = async (page: import('@playwright/test').Page, url: string) => {
  const res = await page.goto(url);
  await page.waitForFunction(() => document.documentElement.dataset.deskReady === 'true');
  return res;
};

for (const url of ['/potaflow', '/potaflow/']) {
  test(`a direct load of ${url} opens Potaflow with its title`, async ({ page }) => {
    const res = await gotoDesk(page, url);
    expect(res?.ok()).toBe(true);
    expect(new URL(page.url()).pathname.replace(/\/$/, '')).toBe('/potaflow');
    await expect(page.locator('#panel-title')).toContainText('Potaflow');
    await expect(page).toHaveTitle('Potaflow · Carlos Beltran');
  });
}

test('OG images are served as image/png', async ({ request }) => {
  for (const url of ['/opengraph-image', '/potaflow/opengraph-image']) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
    expect(res.headers()['content-type'], url).toMatch(/^image\/png/);
  }
});

test('opening a section sends a Vercel Analytics page view for its route', async ({ page }) => {
  await gotoDesk(page, '/');
  const beacon = page.waitForRequest(
    (r) =>
      r.method() === 'POST' &&
      /\/_vercel\/insights\/view/.test(r.url()) &&
      (r.postData() ?? '').includes('/potaflow'),
    { timeout: 15_000 },
  );
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: 'Potaflow' })
    .click();
  await beacon;
});

test('the site sets no cookies of its own (only Vercel’s bypass cookie)', async ({ request }) => {
  const res = await request.get('/');
  const cookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split('=')[0]);
  expect(cookies.filter((name) => name !== '_vercel_jwt')).toEqual([]);
});

test('without the bypass header, the preview is protected', async () => {
  const anonymous = await pwRequest.newContext({ baseURL: PREVIEW_URL });
  const res = await anonymous.get('/', { maxRedirects: 0 });
  expect([401, 302, 303, 307, 308]).toContain(res.status());
  await anonymous.dispose();
});
