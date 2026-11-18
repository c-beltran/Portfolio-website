// Quality sheet for the M3b live-vs-clips test: live (baked R3F) frames beside the Cycles
// references, at the same pixel size. Needs the static export served (pnpm serve:out).
//
//   node scripts/lab/quality-sheet.mjs <out dir> [base url]
//
// References come from ~/Portfolio-assets (renders and clip frames), which are never committed;
// so is the sheet (it goes to docs/private).
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const [OUT, BASE = 'http://localhost:4173'] = process.argv.slice(2);
if (!OUT) throw new Error('usage: quality-sheet.mjs <out dir> [base url]');
mkdirSync(OUT, { recursive: true });
const ASSETS = join(homedir(), 'Portfolio-assets');
const REF = {
  day: join(ASSETS, 'renders/final-day-overview.png'),
  lamp: join(ASSETS, 'renders/final-lamp-overview.png'),
  close: join(ASSETS, 'clips/overview-monitor/frame_053.png'),
};

async function liveShots(browser, width) {
  // Landscape, so the page uses the desktop (16:9) framing even at 400 px.
  const page = await browser.newPage({ viewport: { width, height: Math.round(width * 0.75) } });
  await page.goto(`${BASE}/lab/monitor`);
  await page.getByRole('radio', { name: 'Live 3D' }).check();
  await page.waitForTimeout(5000);
  const stage = page.locator('.lab__stage');
  const shots = { day: await stage.screenshot() };
  await page.getByRole('button', { name: 'Lamp (live only)' }).click();
  await page.waitForTimeout(1200);
  shots.lamp = await stage.screenshot();
  await page.getByRole('button', { name: 'Lamp (live only)' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Monitor' }).click();
  await page.getByTestId('lab-state').filter({ hasText: 'monitor' }).waitFor();
  await page.waitForTimeout(300);
  shots.close = await stage.screenshot();
  await page.close();
  return shots;
}

const label = (text, w) =>
  Buffer.from(
    `<svg width="${w}" height="28"><rect width="100%" height="100%" fill="#111"/>` +
      `<text x="8" y="19" font-family="Helvetica" font-size="15" fill="#eee">${text}</text></svg>`,
  );

/** Live on the left, Cycles on the right, labelled, at the live shot's size. */
async function pair(name, live, ref, caption) {
  const { width, height } = await sharp(live).metadata();
  const right = await sharp(ref).resize(width, height, { fit: 'cover' }).png().toBuffer();
  const gap = 8;
  const img = await sharp({
    create: { width: 2 * width + gap, height: height + 28, channels: 3, background: '#111' },
  })
    .composite([
      { input: label(`Live 3D — ${caption}`, width), left: 0, top: 0 },
      { input: label(`Cycles — ${caption}`, width), left: width + gap, top: 0 },
      { input: live, left: 0, top: 28 },
      { input: right, left: width + gap, top: 28 },
    ])
    .png()
    .toFile(join(OUT, `${name}.png`));
  console.log(`${name}.png ${img.width}×${img.height}`);
}

const browser = await chromium.launch();
const small = await liveShots(browser, 400);
const big = await liveShots(browser, 1280);
await browser.close();
await pair('overview-400', small.day, REF.day, 'overview, day, 400 px');
await pair('overview-1280', big.day, REF.day, 'overview, day, 1280 px');
await pair('closeup-1280', big.close, REF.close, 'monitor close-up (clip last frame)');
await pair('lamp-1280', big.lamp, REF.lamp, 'overview, lamp');
