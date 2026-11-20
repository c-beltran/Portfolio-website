import { test as base } from '@playwright/test';

export * from '@playwright/test';

/**
 * The specs' test: the turn-sideways hint (design 2026-11-19 §3.5) counts as already seen, so it
 * never covers what a test taps. hint.spec (and the labels test that needs the hint) use
 * @playwright/test's own test instead.
 */
export const test = base.extend<{ hintSeen: void }>({
  hintSeen: [
    async ({ context }, use) => {
      await context.addInitScript(() => {
        try {
          sessionStorage.setItem('desk-hint-seen', '1');
        } catch {}
      });
      await use();
    },
    { auto: true },
  ],
});
