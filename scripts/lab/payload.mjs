// Measures what each approach on /lab/monitor downloads after first paint (M3b Part A), gzipped,
// against the 3 MB 3D budget (spec §7). Needs the static export served (pnpm serve:out).
//
//   node scripts/lab/payload.mjs [base url]
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4173';

async function collect(page, run) {
  const seen = new Map();
  const onResponse = async (r) => {
    try {
      if (r.status() === 200) seen.set(r.url(), await r.body());
    } catch {
      /* redirects and aborted requests have no body */
    }
  };
  page.on('response', onResponse);
  await run();
  await page.waitForLoadState('networkidle');
  page.off('response', onResponse);
  return seen;
}

const kind = (u) =>
  /\.js(\?|$)/.test(u)
    ? 'js'
    : /\.glb/.test(u)
      ? 'model'
      : /\.webp/.test(u)
        ? 'texture'
        : /\.mp4/.test(u)
          ? 'video'
          : 'other';

function report(name, files, firstPaint) {
  const rows = {};
  let total = 0;
  for (const [u, body] of files) {
    if (firstPaint.has(u)) continue;
    const gz = gzipSync(body, { level: 9 }).length;
    rows[kind(u)] = (rows[kind(u)] ?? 0) + gz;
    total += gz;
  }
  const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
  console.log(`${name}: ${kb(total)} after first paint (gzipped)`);
  for (const [k, v] of Object.entries(rows)) console.log(`  ${k.padEnd(8)} ${kb(v)}`);
  return total;
}

const browser = await chromium.launch();
for (const [framing, viewport] of [
  ['desktop', { width: 1280, height: 900 }],
  ['phone', { width: 390, height: 844, isMobile: true }],
]) {
  console.log(`\n== ${framing}`);
  for (const mode of ['live', 'clips']) {
    const page = await browser.newPage({ viewport });
    const first = await collect(page, () => page.goto(`${BASE}/lab/monitor`));
    const after = await collect(page, async () => {
      await page.getByRole('radio', { name: mode === 'live' ? 'Live 3D' : 'Clips' }).check();
      if (mode === 'live') await page.waitForTimeout(5000);
      await page.getByRole('button', { name: 'Monitor' }).click();
      await page
        .getByTestId('lab-state')
        .filter({ hasText: 'monitor' })
        .waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: 'Back' }).click();
      await page
        .getByTestId('lab-state')
        .filter({ hasText: 'overview' })
        .waitFor({ timeout: 15000 });
    });
    report(
      mode === 'live' ? 'Live 3D (whole room, both modes)' : 'Clips (monitor in + out)',
      after,
      first,
    );
    await page.close();
  }
}
await browser.close();
