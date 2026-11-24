import { test } from './fixtures';
import { atNight } from './desk';

/** Review screenshots. Run only in CI's screenshot step (@screens). */
for (const theme of ['day', 'lamp'] as const) {
  for (const route of ['/', '/potaflow', '/classic']) {
    test(`@screens ${theme} ${route}`, async ({ page }, info) => {
      if (theme === 'lamp') await atNight(page);
      await page.goto(route);
      // The stills are part of the review: wait until the shown render has decoded.
      await page.waitForFunction(() =>
        [...document.querySelectorAll<HTMLImageElement>('.desk-still__photo img')]
          .filter((img) => getComputedStyle(img).display !== 'none')
          .every((img) => img.complete && img.naturalWidth > 0),
      );
      const name = `${info.project.name}-${theme}-${route === '/' ? 'home' : route.slice(1)}.png`;
      await page.screenshot({ path: `test-results/screens/${name}`, fullPage: true });
    });
  }
}
