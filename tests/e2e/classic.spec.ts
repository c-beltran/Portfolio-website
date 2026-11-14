import { expect, test } from '@playwright/test';
import { FACT_IDS } from '../../content/factIds';
import { SECTION_SLUGS } from '../../content/objects';

test.describe('/classic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/classic');
  });

  test('renders every live fact exactly once, and never F05', async ({ page }) => {
    for (const id of FACT_IDS) {
      await expect(page.locator(`[data-fact-id="${id}"]`), id).toHaveCount(1);
    }
    await expect(page.locator('[data-fact-id="F05"]')).toHaveCount(0);
  });

  test('links every section route on the desk', async ({ page }) => {
    for (const slug of SECTION_SLUGS) {
      await expect(page.locator(`main a[href="/${slug}"]`), slug).toHaveCount(1);
    }
  });

  test('has one h1 and no empty sections', async ({ page }) => {
    await expect(page.locator('h1')).toHaveCount(1);
    const sections = page.locator('main section');
    expect(await sections.count()).toBeGreaterThanOrEqual(5);
    for (const section of await sections.all()) {
      await expect(section.locator('h2')).toHaveCount(1);
      expect(
        (await section.innerText()).replace(await section.locator('h2').innerText(), '').trim()
          .length,
      ).toBeGreaterThan(0);
    }
  });

  test('has its own title and shows the stats footnote', async ({ page }) => {
    await expect(page).toHaveTitle('Carlos Beltran · Classic');
    await expect(page.locator('main')).toContainText('Co-authored share:');
  });
});
