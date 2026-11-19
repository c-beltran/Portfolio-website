// How closely the live scene (?tier=2) matches the Tier 1 still at the same camera (M3b Part C).
// Prints mean absolute difference and the share of clearly-off channels per frame, and writes a
// sheet per frame (live | still | difference ×4) plus match.json. Never committed.
// Target: meanAbs ≤ 6 and over40 ≤ 3% on every frame. Needs the export served (pnpm serve:out).
//
//   node scripts/scene/measure/match.mjs <out dir> [base url]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { diff } from './diff.mjs';

const [OUT, BASE = 'http://localhost:4173'] = process.argv.slice(2);
if (!OUT) throw new Error('usage: match.mjs <out dir> [base url]');
mkdirSync(OUT, { recursive: true });

const FRAMES = [
  { view: 'desk', viewport: { width: 1280, height: 720 }, dpr: 1 },
  // Portrait phone: the site's phone framing (the square camera).
  { view: 'phone', viewport: { width: 390, height: 844 }, dpr: 2 },
];
// Live: only the canvas (no labels, no photo underneath). Still: the photo the browser draws in
// the same box, so both go through the same sizing as at the swap a visitor will see.
const LIVE = '.hotspot, .desk-still__photo { visibility: hidden !important; }';
const STILL = '.hotspot, .desk-still__live { visibility: hidden !important; }';

const browser = await chromium.launch();
const results = {};
for (const f of FRAMES) {
  for (const mode of ['day', 'lamp']) {
    const name = `${f.view}-${mode}`;
    const ctx = await browser.newContext({ viewport: f.viewport, deviceScaleFactor: f.dpr });
    await ctx.addInitScript((m) => localStorage.setItem('desk-theme', m), mode);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?tier=2`);
    await page.locator('.desk-still__live[data-ready="true"]').waitFor({ timeout: 30_000 });
    const live1 = await page.addStyleTag({ content: LIVE });
    await page.waitForTimeout(1000); // past the fade-in and the lamp cross-fade
    const layer = page.locator('.desk-still__layer');
    const shot = await layer.screenshot();
    await live1.evaluate((el) => el.remove());
    await page.addStyleTag({ content: STILL });
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.desk-still__photo img')].every(
        (i) => getComputedStyle(i).display === 'none' || (i.complete && i.naturalWidth > 0),
      ),
    );
    await page.waitForTimeout(700); // past the lamp photo's cross-fade
    const stillShot = await layer.screenshot();
    await ctx.close();

    const { width, height } = await sharp(shot).metadata();
    const raw = (img) => img.removeAlpha().raw().toBuffer();
    const live = await raw(sharp(shot));
    const still = await raw(sharp(stillShot));
    const r = diff(live, still);
    results[name] = { meanAbs: +r.meanAbs.toFixed(2), over40: +(r.over40 * 100).toFixed(1) };
    console.log(
      `${name.padEnd(11)} meanAbs ${r.meanAbs.toFixed(2).padStart(6)}   over40 ${(r.over40 * 100).toFixed(1).padStart(5)}%`,
    );

    // Difference heat map: per-pixel mean channel difference, ×4, in red.
    const heat = Buffer.alloc(width * height * 3);
    for (let p = 0; p < width * height; p++) {
      const d =
        (Math.abs(live[3 * p] - still[3 * p]) +
          Math.abs(live[3 * p + 1] - still[3 * p + 1]) +
          Math.abs(live[3 * p + 2] - still[3 * p + 2])) /
        3;
      heat[3 * p] = Math.min(255, d * 4);
    }
    const opts = { raw: { width, height, channels: 3 } };
    const gap = 8;
    await sharp({
      create: { width: 3 * width + 2 * gap, height, channels: 3, background: '#fff' },
    })
      .composite([
        { input: live, ...opts, left: 0, top: 0 },
        { input: still, ...opts, left: width + gap, top: 0 },
        { input: heat, ...opts, left: 2 * (width + gap), top: 0 },
      ])
      .png()
      .toFile(join(OUT, `${name}.png`));
  }
}
await browser.close();
writeFileSync(join(OUT, 'match.json'), `${JSON.stringify(results, null, 2)}\n`);
