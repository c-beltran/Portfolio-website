import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from './fixtures';
import { atNight, drawerButton, drawerLamp, gotoDesk, lampOff } from './desk';
import { SECTION_SLUGS as SECTIONS } from '../../content/objects';

/** The words on opened objects: the badge's and the card's backs, and the leaned-in screens. */
const face = (page: Page, id: string) => page.locator(`.opened__face[data-face="${id}"]`);
const box = async (l: Locator) => (await l.boundingBox())!;
type Box = { x: number; y: number; width: number; height: number };
const inside = (a: Box, b: Box, slack = 1) =>
  a.x >= b.x - slack &&
  a.y >= b.y - slack &&
  a.x + a.width <= b.x + b.width + slack &&
  a.y + a.height <= b.y + b.height + slack;
const drawn = (page: Page) =>
  expect(page.locator('.opened__canvas')).toHaveAttribute('data-drawn', 'true', {
    timeout: 5000,
  });

/** Every face link is a real 44 px target inside its face. */
async function linksFit(page: Page, id: string) {
  const f = await box(face(page, id));
  for (const a of await face(page, id).locator('a').all()) {
    const b = await box(a);
    expect(b.width, id).toBeGreaterThanOrEqual(44 - 0.5);
    expect(b.height, id).toBeGreaterThanOrEqual(44 - 0.5);
    expect(inside(b, f), id).toBe(true);
  }
}

test.describe('faces', () => {
  test.skip(({ isMobile }) => isMobile, 'sizes are tested below');
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the badge's back carries its timeline", async ({ page }) => {
    await gotoDesk(page, '/experience');
    await drawn(page);
    const f = face(page, 'badge');
    await expect(f).toBeVisible();
    expect(inside(await box(f), await box(page.locator('.opened__art')))).toBe(true);
    // F02, the role (content/facts.ts)
    await expect(f).toContainText('Performance Engineering on the Ad Platform');
    await expect(f).toContainText('[TODO: Carlos:');
  });

  test("the card's links are on the card: real links, out of the tab order, 44 px", async ({
    page,
  }) => {
    await gotoDesk(page, '/contact');
    await drawn(page);
    const links = face(page, 'card').locator('a');
    await expect(links.first()).toBeVisible();
    for (const a of await links.all()) {
      await expect(a).toHaveAttribute('tabindex', '-1');
      expect(await a.getAttribute('href')).toBeTruthy();
    }
    await linksFit(page, 'card');
    await page.route('https://github.com/**', (r) =>
      r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }),
    );
    const req = page.waitForRequest((r) => r.url().startsWith('https://github.com/'));
    await face(page, 'card').locator('a', { hasText: 'GitHub' }).click();
    await req;
  });

  test('the CV screen shows the name, the facts, the résumé or its TODO, and the Classic version', async ({
    page,
  }) => {
    await gotoDesk(page, '/cv');
    await drawn(page);
    const f = face(page, 'cv');
    await expect(f).toContainText('Carlos Beltran');
    await expect(f).toContainText('backend & performance');
    await expect(f).toContainText(/Résumé|\[TODO: résumé PDF\]/);
    await expect(f.locator('a', { hasText: 'Classic version' })).toHaveAttribute(
      'href',
      '/classic',
    );
  });

  const greens = (page: Page) =>
    face(page, 'monitor')
      .locator('.face__check')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el, '::before').backgroundColor));
  const GREEN = 'rgb(63, 185, 80)';

  test("How I build's checks turn green after an open", async ({ page }) => {
    await gotoDesk(page, '/');
    await drawerButton(page, 'How I build').press('Enter');
    await drawn(page);
    await expect(face(page, 'monitor').locator('.face--build')).toHaveAttribute(
      'data-state',
      'running',
    );
    await expect.poll(() => greens(page), { timeout: 6000 }).toEqual(Array(4).fill(GREEN));
  });

  test('a direct load of How I build shows its checks green', async ({ page }) => {
    await gotoDesk(page, '/how-i-build');
    expect(await greens(page)).toEqual(Array(4).fill(GREEN));
  });

  test('Tab from the panel title never reaches a face link', async ({ page }) => {
    await gotoDesk(page, '/contact');
    await page.locator('#panel-title').focus();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('.opened'))).toBe(false);
    }
  });

  test('a direct load of /cv shows its screen at first paint', async ({ page, request }) => {
    const html = await (await request.get('/cv')).text();
    expect(html).toContain('data-face="cv"');
    await page.route('**/opened/cv-*', () => {}); // the art never arrives
    await page.goto('/cv');
    await expect(face(page, 'cv')).toBeVisible();
    await expect(page.locator('.opened__canvas')).not.toHaveAttribute('data-drawn');
  });

  for (const url of ['/cv', '/contact'])
    test(`${url}'s largest paint is never the art`, async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { lcp: string[] }).lcp = [];
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { element?: Element })[])
            (window as unknown as { lcp: string[] }).lcp.push(
              e.element ? `${e.element.tagName}.${e.element.className}` : '?',
            );
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      });
      await gotoDesk(page, url);
      await drawn(page);
      await page.waitForTimeout(500);
      const lcp = await page.evaluate(() => (window as unknown as { lcp: string[] }).lcp);
      expect(lcp.length).toBeGreaterThan(0);
      expect(lcp[lcp.length - 1]).not.toMatch(/^CANVAS/);
    });

  test("switching to lamp while the CV is out redraws the art in lamp, and the screen's paper follows", async ({
    page,
  }) => {
    const seen: string[] = [];
    page.on('request', (r) => seen.push(r.url()));
    // At night with the lamp off, so the switch brings up the lamp render.
    await atNight(page);
    await lampOff(page);
    await gotoDesk(page, '/cv');
    await drawn(page);
    const paper = () =>
      face(page, 'cv')
        .locator('.face')
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    const before = await paper();
    await drawerLamp(page).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => seen.some((u) => /\/opened\/cv-lamp-/.test(u))).toBe(true);
    await expect.poll(paper).not.toBe(before);
  });
});

test.describe('faces with reduced motion', () => {
  test.skip(({ isMobile }) => isMobile, 'once is enough');
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

  test("How I build's checks are green at once", async ({ page }) => {
    await gotoDesk(page, '/');
    await drawerButton(page, 'How I build').press('Enter');
    await drawn(page);
    await expect(face(page, 'monitor').locator('.face--build')).toHaveAttribute(
      'data-state',
      'done',
    );
  });
});

test.describe('faces fit', () => {
  test.skip(({ isMobile }) => isMobile, 'viewports set here');
  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [1280, 800],
    [2560, 720],
  ] as const)
    test(`at ${width}×${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const [url, id] of [
        ['/experience', 'badge'],
        ['/contact', 'card'],
        ['/how-i-build', 'monitor'],
        ['/cv', 'cv'],
      ] as const) {
        await gotoDesk(page, url);
        await drawn(page);
        const fits = await face(page, id)
          .locator('.face')
          .evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
        expect(fits, `${id} at ${width}×${height}`).toBe(true);
        await linksFit(page, id);
      }
    });
});

test.describe('faces, accessibility', () => {
  test.skip(({ isMobile }) => isMobile, 'once is enough');
  for (const theme of ['day', 'lamp'] as const)
    test(`axe passes on every section route in ${theme}`, async ({ page }) => {
      if (theme === 'lamp') await atNight(page);
      for (const s of SECTIONS) {
        await gotoDesk(page, `/${s}`);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .exclude('.desk-still__layer')
          .analyze();
        expect(results.violations, s).toEqual([]);
      }
    });
});

test.describe('faces, no JavaScript', () => {
  test.skip(({ isMobile }) => isMobile, 'once is enough');

  test("with JavaScript off, /contact shows the card's links on the dimmed desk, and they work", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await page.goto('/contact');
    const gh = face(page, 'card').locator('a', { hasText: 'GitHub' });
    await expect(gh).toBeVisible();
    await page.route('https://github.com/**', (r) =>
      r.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }),
    );
    await gh.click();
    await expect.poll(() => page.url()).toMatch(/^https:\/\/github\.com\//);
    await ctx.close();
  });
});

test.describe('the diploma face', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const theme of ['day', 'lamp'] as const)
    test(`shows the degree on its paper, in ${theme}`, async ({ page }) => {
      if (theme === 'lamp') await atNight(page);
      await gotoDesk(page, '/');
      await page.locator('.hotspot[data-item="diploma"]').click();
      const f = face(page, 'diploma');
      await expect(f).toBeVisible();
      await expect(f.locator('.face')).toHaveText(
        /Queens College\s*The City University of New York\s*Bachelor of Science\s*Computer Science\s*May 2019/,
      );
      const fits = await f
        .locator('.face')
        .evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
      expect(fits).toBe(true);
    });
});
