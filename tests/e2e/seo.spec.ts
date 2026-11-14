import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { SECTION_SLUGS } from '../../content/objects';

const OUT = join(process.cwd(), 'out');
const ogImage = async (page: import('@playwright/test').Page) =>
  page.locator('meta[property="og:image"]').getAttribute('content');

test.describe('seo', () => {
  for (const url of ['/', '/potaflow', '/classic']) {
    test(`${url} has an absolute og:image on cbeltran.com`, async ({ page }) => {
      await page.goto(url);
      expect(await ogImage(page)).toMatch(/^https:\/\/cbeltran\.com\//);
    });
  }

  for (const url of ['/', ...SECTION_SLUGS.map((s) => `/${s}`)]) {
    test(`${url} og:image exists in the static export`, async ({ page }) => {
      await page.goto(url);
      const path = new URL((await ogImage(page))!).pathname;
      expect(existsSync(join(OUT, path)), path).toBe(true);
    });
  }

  test('sitemap lists the overview, the seven sections and /classic', () => {
    const xml = readFileSync(join(OUT, 'sitemap.xml'), 'utf8');
    expect(xml.match(/<loc>/g)).toHaveLength(9);
    expect(xml).toContain('<loc>https://cbeltran.com/classic</loc>');
  });

  test('robots.txt allows all and points at the sitemap', () => {
    const robots = readFileSync(join(OUT, 'robots.txt'), 'utf8');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://cbeltran.com/sitemap.xml');
  });

  for (const url of ['/opengraph-image', '/potaflow/opengraph-image']) {
    test(`${url} is served as image/png`, async ({ request }) => {
      const res = await request.get(url);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toMatch(/^image\/png/);
    });
  }
});
