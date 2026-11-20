// How closely the live seat (?tier=2) matches the Tier 1 still at the moment it takes over (M3b
// Part C; M3c phase 1 frames). Prints mean absolute difference and the share of clearly-off
// channels per frame, and writes a sheet per frame (live | still | difference ×4) plus match.json.
// Never committed. Target: meanAbs ≤ 6 and over40 ≤ 3% on every frame.
// Serves the built export itself on a spare port (and stops it), unless given a base URL.
//
//   node scripts/scene/measure/match.mjs <out dir> [base url]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { diff } from './diff.mjs';

const [OUT, GIVEN] = process.argv.slice(2);
if (!OUT) throw new Error('usage: match.mjs <out dir> [base url]');
mkdirSync(OUT, { recursive: true });
const PORT = 4176;
const BASE = GIVEN ?? `http://localhost:${PORT}`;

// The design's review windows (16:9 first); portrait ones at both ends of the swipe and centred.
const FRAMES = [
  { name: '1920x1080', viewport: { width: 1920, height: 1080 }, dpr: 1 },
  { name: '1280x800', viewport: { width: 1280, height: 800 }, dpr: 1 },
  { name: '2560x720', viewport: { width: 2560, height: 720 }, dpr: 1 },
  { name: '768x1024', viewport: { width: 768, height: 1024 }, dpr: 2 },
  ...[-1, 0, 1].map((pan) => ({
    name: `390x844-pan${pan}`,
    viewport: { width: 390, height: 844 },
    dpr: 2,
    pan,
  })),
  { name: '844x390', viewport: { width: 844, height: 390 }, dpr: 2 },
];
// The window as a visitor sees it, without the labels and the name: the live canvas alone, or the
// still the browser draws there (the same crop and scaling as at the swap).
const BOTH = '.hotspot, .desk-still__overlay, .turn-hint { visibility: hidden !important; }';
const LIVE = `${BOTH} .desk-still__photo { visibility: hidden !important; }`;
const STILL = `${BOTH} .desk-still__live { visibility: hidden !important; }`;

async function serve() {
  const server = spawn('node_modules/.bin/serve', ['out', '-l', String(PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return server;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  server.kill();
  throw new Error(`no server on ${BASE}`);
}

const server = GIVEN ? null : await serve();
const browser = await chromium.launch();
const results = {};
try {
  for (const f of FRAMES) {
    for (const mode of ['day', 'lamp']) {
      const name = `${f.name}-${mode}`;
      const ctx = await browser.newContext({ viewport: f.viewport, deviceScaleFactor: f.dpr });
      await ctx.addInitScript((m) => {
        localStorage.setItem('desk-theme', m);
        sessionStorage.setItem('desk-hint-seen', '1');
      }, mode);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/?tier=2`);
      await page.locator('.desk-still__live[data-ready="true"]').waitFor({ timeout: 60_000 });
      if (f.pan !== undefined)
        await page.locator('.desk-still').evaluate((el, pan) => {
          el.scrollLeft = ((pan + 1) / 2) * (el.scrollWidth - el.clientWidth);
        }, f.pan);
      const live1 = await page.addStyleTag({ content: LIVE });
      await page.waitForTimeout(1500); // past the fade-in, the lamp cross-fade and the re-frame
      const shot = await page.screenshot();
      await live1.evaluate((el) => el.remove());
      await page.addStyleTag({ content: STILL });
      await page.waitForFunction(() =>
        [...document.querySelectorAll('.desk-still__photo img')].every(
          (i) => getComputedStyle(i).display === 'none' || (i.complete && i.naturalWidth > 0),
        ),
      );
      await page.waitForTimeout(700); // past the lamp photo's cross-fade
      const stillShot = await page.screenshot();
      await ctx.close();

      const { width, height } = await sharp(shot).metadata();
      const raw = (img) => img.removeAlpha().raw().toBuffer();
      const live = await raw(sharp(shot));
      const still = await raw(sharp(stillShot));
      const r = diff(live, still);
      results[name] = { meanAbs: +r.meanAbs.toFixed(2), over40: +(r.over40 * 100).toFixed(1) };
      console.log(
        `${name.padEnd(22)} meanAbs ${r.meanAbs.toFixed(2).padStart(6)}   over40 ${(r.over40 * 100).toFixed(1).padStart(5)}%`,
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
} finally {
  await browser.close();
  server?.kill();
}
writeFileSync(join(OUT, 'match.json'), `${JSON.stringify(results, null, 2)}\n`);
