import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { SECTION_SLUGS } from '../../content/objects';

const ROUTES = ['/', ...SECTION_SLUGS.map((s) => `/${s}`), '/classic', '/nope'];

for (const theme of ['day', 'lamp'] as const) {
  test.describe(`axe (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('desk-theme', t), theme);
    });

    for (const route of ROUTES) {
      test(`${route} has no WCAG 2.1 A/AA violations`, async ({ page }) => {
        await page.goto(route);
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`),
        ).toEqual([]);
      });
    }
  });
}
