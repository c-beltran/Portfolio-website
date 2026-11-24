// The residual: the Tier 1 still minus the live seat, both seen through the
// seat at rest, in the master's image space. LiveScene projects it from the seat onto the scene and
// adds it in sRGB (components/scene/materials.ts), which closes the gap at the moment the live
// scene takes over.
//
// Captures ?tier=2&capture=master (the whole master, no residual) from the built export, which it
// serves itself on a spare port and stops again, against the Cycles masters downscaled to the same
// size. Writes public/scene/bake/residual-seat-<mode>.webp: each channel (still − live)/2 + 127.5.
//
//   pnpm build && node scripts/local-serve/prepare.mjs
//   node scripts/scene/measure/residual.mjs [renders dir]
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const RENDERS = process.argv[2] ?? join(homedir(), 'Portfolio-assets/renders');
const OUT = 'public/scene/bake';
const PORT = 4175;
const BASE = `http://localhost:${PORT}`;
// The master's shape (32/9 by 4/3 safe heights: 8:3), at 2048 wide.
const [W, H] = [2048, 768];
const QUALITY = 90;

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

async function capture(browser, mode) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript((m) => localStorage.setItem('desk-theme', m), mode);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?tier=2&capture=master`);
  await page.locator('.desk-still__live[data-ready="true"]').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500); // past the fade-in and the lamp cross-fade
  const url = await page
    .locator('.desk-still__live canvas')
    .evaluate((c) => c.toDataURL('image/png'));
  await ctx.close();
  const png = Buffer.from(url.split(',')[1], 'base64');
  const meta = await sharp(png).metadata();
  if (meta.width !== W || meta.height !== H)
    throw new Error(`capture is ${meta.width}×${meta.height}`);
  return sharp(png).removeAlpha().raw().toBuffer();
}

const server = await serve();
try {
  const browser = await chromium.launch();
  try {
    for (const mode of ['day', 'lamp']) {
      const live = await capture(browser, mode);
      const still = await sharp(join(RENDERS, `seat-${mode}.png`))
        .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
        .removeAlpha()
        .raw()
        .toBuffer();
      const res = Buffer.alloc(W * H * 3);
      let sum = 0;
      for (let i = 0; i < res.length; i++) {
        const d = still[i] - live[i];
        sum += Math.abs(d);
        res[i] = Math.max(0, Math.min(255, Math.round(d / 2 + 127.5)));
      }
      const file = join(OUT, `residual-seat-${mode}.webp`);
      await sharp(res, { raw: { width: W, height: H, channels: 3 } })
        .webp({ quality: QUALITY, effort: 6 })
        .toFile(file);
      console.log(
        `${file}: ${(statSync(file).size / 1024).toFixed(0)} kB; live vs still before: meanAbs ${(sum / res.length).toFixed(2)}`,
      );
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
