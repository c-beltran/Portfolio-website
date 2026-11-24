import { expect, test, type Page } from './fixtures';
import { atNight, drawerButton, drawerLamp, gotoDesk, path } from './desk';

/**
 * Picking up the car, the ball or the mug in the still view: the first grab loads the object in
 * 3D (and three.js with it), which takes the picture's place without a shift; drags, flicks and the
 * arrow keys turn it; it eases home on close. Read through the spin target's hooks (SpinTarget.tsx):
 * data-spin (moving or rest) and data-spin-turn (radians), and the 3D canvas's data-spin-ready and
 * data-spin-mode (SpinView.tsx).
 */
const target = (page: Page, id = 'car') => page.locator(`.spin-target[data-spin-for="${id}"]`);
const view = (page: Page, id = 'car') => target(page, id).locator('.spin-view');
const turn = async (page: Page, id = 'car') =>
  Number((await target(page, id).getAttribute('data-spin-turn')) ?? 0);

/**
 * The picture's outline against the 3D frame's, at the picture canvas's own resolution: the
 * difference of their bounding boxes (px, the worst side) and their overlap (intersection over union).
 */
const outlines = (page: Page, id = 'car') =>
  page.evaluate((id) => {
    const pic = document.querySelector<HTMLCanvasElement>(
      `.opened[data-id="${id}"] .opened__canvas`,
    )!;
    const gl = document.querySelector<HTMLCanvasElement>(
      `.spin-target[data-spin-for="${id}"] .spin-view`,
    )!;
    const [W, H] = [pic.width, pic.height];
    const mask = (c: HTMLCanvasElement) => {
      const o = document.createElement('canvas');
      o.width = W;
      o.height = H;
      const x = o.getContext('2d')!;
      x.drawImage(c, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data;
      const m = new Uint8Array(W * H);
      const box = [W, H, -1, -1];
      for (let i = 0; i < W * H; i++)
        if (d[i * 4 + 3]! > 128) {
          m[i] = 1;
          const [px, py] = [i % W, Math.floor(i / W)];
          box[0] = Math.min(box[0]!, px);
          box[1] = Math.min(box[1]!, py);
          box[2] = Math.max(box[2]!, px);
          box[3] = Math.max(box[3]!, py);
        }
      return { m, box };
    };
    const a = mask(pic);
    const b = mask(gl);
    let inter = 0;
    let union = 0;
    for (let i = 0; i < W * H; i++) {
      inter += a.m[i]! & b.m[i]!;
      union += a.m[i]! | b.m[i]!;
    }
    return {
      shift: Math.max(...a.box.map((v, i) => Math.abs(v - b.box[i]!))),
      iou: union ? inter / union : 0,
      width: W,
    };
  }, id);

/** Grab the object at its centre and hold it until the 3D object has taken over. */
async function grab(page: Page, id = 'car') {
  const box = (await target(page, id).boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await expect(view(page, id)).toHaveAttribute('data-spin-ready', 'true', { timeout: 15_000 });
  return at;
}

test.describe('spinning in the still view', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop');
  test.use({ viewport: { width: 1280, height: 800 } });

  test('no three.js or 3D model loads before the first grab', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (r) => asked.push(r.url()));
    await gotoDesk(page, '/cars');
    await page.waitForTimeout(2000);
    expect(asked.filter((u) => /spin-\w+\.glb|-open-(day|lamp)\.webp/.test(u))).toEqual([]);
    const scripts = asked.filter((u) => u.endsWith('.js')).length;
    await grab(page);
    expect(asked.some((u) => u.endsWith('/scene/spin-car.glb'))).toBe(true);
    expect(asked.filter((u) => u.endsWith('.js')).length).toBeGreaterThan(scripts);
  });

  test('a grab swaps in the car without a shift, and a drag turns it', async ({ page }) => {
    await gotoDesk(page, '/cars');
    const at = await grab(page);
    const o = await outlines(page);
    expect(o.shift).toBeLessThanOrEqual(Math.max(2, (2 * o.width) / 1600));
    expect(o.iou).toBeGreaterThan(0.97);
    await page.mouse.move(at.x + 100, at.y, { steps: 5 });
    await page.mouse.move(at.x + 200, at.y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => turn(page)).toBeGreaterThan(0.5);
    expect((await outlines(page)).iou).toBeLessThan(0.97);
  });

  test('arrow keys turn it, and Home brings it back', async ({ page }) => {
    await gotoDesk(page, '/cars');
    await target(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(view(page)).toHaveAttribute('data-spin-ready', 'true', { timeout: 15_000 });
    expect(await turn(page)).toBeCloseTo((15 * Math.PI) / 180, 1);
    await page.keyboard.press('Home');
    await expect.poll(() => turn(page)).toBe(0);
    await expect(target(page)).toHaveAttribute('data-spin', 'rest');
    const o = await outlines(page);
    expect(o.iou).toBeGreaterThan(0.97);
  });

  test('closes mid-spin and reopens at rest', async ({ page }) => {
    await gotoDesk(page, '/cars');
    const at = await grab(page);
    await page.mouse.move(at.x + 300, at.y, { steps: 3 });
    await page.mouse.up();
    await page.keyboard.press('Escape');
    await expect.poll(() => path(page)).toBe('/');
    await expect(target(page)).toHaveCount(0);
    await drawerButton(page, 'Cars').press('Enter');
    await expect(target(page)).toBeVisible();
    expect(await turn(page)).toBe(0);
    await expect(page.locator('.opened[data-id="car"]')).not.toHaveAttribute('data-spun', /.*/);
  });

  test('the lamp switch while spun swaps its light', async ({ page }) => {
    await atNight(page);
    await gotoDesk(page, '/cars');
    await grab(page);
    await page.mouse.up();
    await expect(view(page)).toHaveAttribute('data-spin-mode', 'lamp');
    await drawerLamp(page).focus();
    await page.keyboard.press('Enter');
    await expect(view(page)).toHaveAttribute('data-spin-mode', 'day');
  });

  test('a resize keeps the outline', async ({ page }) => {
    await gotoDesk(page, '/cars');
    await grab(page);
    await page.mouse.up();
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForTimeout(500);
    const o = await outlines(page);
    expect(o.shift).toBeLessThanOrEqual(Math.max(2, (2 * o.width) / 1600));
    expect(o.iou).toBeGreaterThan(0.97);
  });

  test('the hint shows once a visit', async ({ page }) => {
    await gotoDesk(page, '/cars');
    await expect(page.locator('.spin-hint')).toBeVisible();
    await page.keyboard.press('Escape');
    await drawerButton(page, 'Coffee').press('Enter');
    await expect(target(page, 'mug')).toBeVisible();
    await expect(page.locator('.spin-hint')).toHaveCount(0);
  });
});

test.describe('spinning with reduced motion', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop');
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

  test('a flick stops where it is let go', async ({ page }) => {
    await gotoDesk(page, '/cars');
    const at = await grab(page);
    await page.mouse.move(at.x + 300, at.y, { steps: 3 });
    await page.mouse.up();
    const a = await turn(page);
    await page.waitForTimeout(300);
    expect(await turn(page)).toBe(a);
    await expect(target(page)).toHaveAttribute('data-spin', 'rest');
  });
});

test.describe('spinning by touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone');

  test('a touch drag turns the ball without scrolling the page or the panel', async ({ page }) => {
    await gotoDesk(page, '/coffee');
    const box = (await target(page, 'mug').boundingBox())!;
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    const scroll = () =>
      page.evaluate(() => [
        window.scrollY,
        document.querySelector('section.panel')?.scrollTop ?? 0,
        document.querySelector('.panel__body')?.scrollTop ?? 0,
      ]);
    const before = await scroll();
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', px: number, py: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }],
      });
    await touch('touchStart', x, y);
    for (let i = 1; i <= 8; i++) await touch('touchMove', x, y + i * 15);
    await touch('touchEnd', x, y + 120);
    await expect.poll(() => turn(page, 'mug')).toBeGreaterThan(0.3);
    expect(await scroll()).toEqual(before);
  });
});
