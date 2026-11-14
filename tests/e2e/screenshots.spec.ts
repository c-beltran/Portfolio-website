import { test } from '@playwright/test';

/** Review screenshots for the milestone report. Run only in CI's screenshot step (@screens). */
for (const theme of ['day', 'lamp'] as const) {
  for (const route of ['/', '/potaflow', '/classic']) {
    test(`@screens ${theme} ${route}`, async ({ page }, info) => {
      await page.addInitScript((t) => localStorage.setItem('desk-theme', t), theme);
      await page.goto(route);
      const name = `${info.project.name}-${theme}-${route === '/' ? 'home' : route.slice(1)}.png`;
      await page.screenshot({ path: `test-results/screens/${name}`, fullPage: true });
    });
  }
}
