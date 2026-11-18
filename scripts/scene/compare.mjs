// Builds the M3a look-review sheet (never committed): the reference photo beside each render at
// 400 px wide, the phone views at 360 px, and each render at 1280 px. Also saves a PNG of the sheet.
//
//   node scripts/scene/compare.mjs <reference.jpg> [renders dir] [out dir]
//
// Defaults: renders in ~/Portfolio-assets/renders (final-<mode>-<camera>.png), output in
// ~/Portfolio-assets/compare.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const [refArg, rendersArg, outArg] = process.argv.slice(2);
if (!refArg) throw new Error('usage: compare.mjs <reference.jpg> [renders dir] [out dir]');
const renders = resolve(rendersArg ?? join(homedir(), 'Portfolio-assets/renders'));
const out = resolve(outArg ?? join(homedir(), 'Portfolio-assets/compare'));
mkdirSync(out, { recursive: true });

const files = {
  ref: resolve(refArg),
  day: join(renders, 'final-day-overview.png'),
  lamp: join(renders, 'final-lamp-overview.png'),
  dayPhone: join(renders, 'final-day-phone.png'),
  lampPhone: join(renders, 'final-lamp-phone.png'),
};
for (const [k, f] of Object.entries(files)) {
  if (!existsSync(f)) throw new Error(`missing ${k}: ${f}`);
  copyFileSync(f, join(out, basename(f)));
}
const img = (k, w) => `<img src="${basename(files[k])}" style="width:${w}px">`;
const pair = (a, b, label) =>
  `<section><h2>${label}</h2><div class="row"><figure>${img(a, 400)}<figcaption>Reference</figcaption></figure><figure>${img(b, 400)}<figcaption>Render</figcaption></figure></div></section>`;

const html = `<!doctype html><meta charset="utf-8"><title>M3a look review</title>
<style>
  body { margin: 24px; background: #111; color: #ddd; font: 14px/1.4 system-ui, sans-serif; }
  h1 { font-size: 20px; } h2 { font-size: 15px; margin: 28px 0 8px; color: #aaa; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-start; }
  figure { margin: 0; } figcaption { color: #888; font-size: 12px; margin-top: 4px; }
  img { display: block; border-radius: 4px; }
</style>
<h1>M3a look review: the workspace, day and lamp</h1>
<p>The bar: at 400 px, beside the reference, the render reads as a photograph of the same kind of desk.</p>
${pair('ref', 'day', 'Day (dusk), 400 px')}
${pair('ref', 'lamp', 'Lamp mode (night), 400 px')}
<section><h2>Phone, 360 px</h2><div class="row">
  <figure>${img('dayPhone', 360)}<figcaption>Day</figcaption></figure>
  <figure>${img('lampPhone', 360)}<figcaption>Lamp</figcaption></figure></div></section>
<section><h2>Day, 1280 px</h2>${img('day', 1280)}</section>
<section><h2>Lamp, 1280 px</h2>${img('lamp', 1280)}</section>`;
writeFileSync(join(out, 'index.html'), html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1340, height: 1000 } });
await page.goto(`file://${join(out, 'index.html')}`);
await page.waitForLoadState('load');
await page.screenshot({ path: join(out, 'sheet.png'), fullPage: true });
await browser.close();
console.log(`wrote ${join(out, 'index.html')} and sheet.png`);
