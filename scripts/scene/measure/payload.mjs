// Measures what each approach on /lab/monitor downloads (M3b Part A), gzipped, against the 3 MB
// 3D budget (spec §7). Needs the static export served (pnpm serve:out).
//
//   node scripts/scene/measure/payload.mjs [base url]
//
// The page shell (HTML, CSS, fonts, the still, the shared JS) is the same for both, so each
// approach is charged only for what it alone needs: live = the model, the lightmaps and the JS
// chunks the clips run never loads; clips = the videos.
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4173';

const kind = (u) =>
  /\.js(\?|$)/.test(u)
    ? 'js'
    : /\.glb/.test(u)
      ? 'model'
      : /\/scene\/bake\/.*\.webp/.test(u)
        ? 'texture'
        : /\.mp4/.test(u)
          ? 'video'
          : 'shell';

/** Every response (200, or 206 for video) from load through one overview → monitor → overview round trip. */
async function run(browser, context, mode) {
  const ctx = await browser.newContext(context);
  const page = await ctx.newPage();
  const seen = new Map();
  page.on('response', async (r) => {
    try {
      // Video arrives as range requests (206): charge the whole file once per URL.
      if (r.status() === 206 && kind(r.url()) === 'video' && !seen.has(r.url()))
        seen.set(r.url(), Buffer.from(await (await fetch(r.url())).arrayBuffer()));
      else if (r.status() === 200) seen.set(r.url(), await r.body());
    } catch {
      /* redirects and aborted requests have no body */
    }
  });
  await page.goto(`${BASE}/lab/monitor`);
  await page.getByRole('radio', { name: mode === 'live' ? 'Live 3D' : 'Clips' }).check();
  if (mode === 'live') await page.waitForTimeout(5000);
  for (const [button, state] of [
    ['Monitor', 'monitor'],
    ['Back', 'overview'],
  ]) {
    await page.getByRole('button', { name: button }).click();
    await page.getByTestId('lab-state').filter({ hasText: state }).waitFor({ timeout: 15000 });
  }
  await page.waitForLoadState('networkidle');
  await ctx.close();
  return seen;
}

const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
function report(name, files) {
  const rows = {};
  let total = 0;
  for (const [u, body] of files) {
    const gz = gzipSync(body, { level: 9 }).length;
    rows[kind(u)] = (rows[kind(u)] ?? 0) + gz;
    total += gz;
  }
  console.log(`${name}: ${kb(total)} (gzipped)`);
  for (const [k, v] of Object.entries(rows)) console.log(`  ${k.padEnd(8)} ${kb(v)}`);
}

const browser = await chromium.launch();
for (const [framing, context] of [
  ['desktop', { viewport: { width: 1280, height: 900 } }],
  ['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
]) {
  console.log(`\n== ${framing}`);
  const live = await run(browser, context, 'live');
  const clips = await run(browser, context, 'clips');
  const only = (a, b, kinds) =>
    new Map([...a].filter(([u]) => kinds.includes(kind(u)) && !(kind(u) === 'js' && b.has(u))));
  report('Live 3D (whole room, day + lamp)', only(live, clips, ['js', 'model', 'texture']));
  report('Clips (monitor in + out)', only(clips, live, ['video']));
  report('Shared shell', only(clips, new Map(), ['shell']));
}
await browser.close();
