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
        // The desk's own text is aria-hidden SVG that axe can't measure; its contrast is pinned
        // by lib/artPalette.test.ts (day and lamp-mode dim). Everything else must be verifiable.
        // On phones the open panel is a fixed sheet over the page, and axe can't resolve the
        // background of text that overlaps other content. The same panel, on the same tokens, is
        // verified by the desktop run and by lib/theme.test.ts.
        const sheet = await page.evaluate(() => {
          const el = document.querySelector('section.panel');
          return !!el && getComputedStyle(el).position === 'fixed';
        });
        let contrast = new AxeBuilder({ page })
          .withRules(['color-contrast'])
          .exclude('.desk-still__layer');
        if (sheet) contrast = contrast.exclude('section.panel');
        const { incomplete } = await contrast.analyze();
        expect(
          violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`),
        ).toEqual([]);
        // axe can't compute contrast over images or gradients and reports it as "incomplete":
        // treat that as a failure, so contrast on the desk still can't pass silently.
        const unverified = incomplete.filter((r) => r.id === 'color-contrast');
        expect(unverified.flatMap((r) => r.nodes.map((n) => n.target.join(' ')))).toEqual([]);
      });
    }
  });
}
