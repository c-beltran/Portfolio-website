// What the live scene adds to a visit, gzipped, against the 3 MB 3D budget (spec §7): every
// response loading /?tier=2 (until the scene is ready) minus every response loading /, by URL.
// Needs the static export served (pnpm serve:out).
//
//   node scripts/scene/measure/payload.mjs [base url]
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const BUDGET = 3 * 1024 * 1024;

const kind = (u) =>
  /\.js(\?|$)/.test(u)
    ? 'js'
    : /\.glb/.test(u)
      ? 'model'
      : /\/scene\/bake\//.test(u)
        ? 'texture'
        : 'other';

async function load(path, ready) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const got = new Map();
  page.on('response', async (r) => {
    if (r.status() !== 200) return;
    try {
      got.set(r.url(), gzipSync(await r.body(), { level: 9 }).length);
    } catch {
      // redirects and aborted bodies carry nothing
    }
  });
  await page.goto(BASE + path);
  if (ready) await page.locator(ready).waitFor({ timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await browser.close();
  return got;
}

const base = await load('/');
const live = await load('/?tier=2', '.desk-still__live[data-ready="true"]');
const added = [...live].filter(([u]) => !base.has(u.replace('?tier=2', '')) && !base.has(u));
const by = {};
for (const [u, n] of added) by[kind(u)] = (by[kind(u)] ?? 0) + n;
const total = added.reduce((s, [, n]) => s + n, 0);
const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
for (const [k, n] of Object.entries(by)) console.log(`${k.padEnd(8)} ${kb(n)}`);
console.log(`live adds ${kb(total)} of ${kb(BUDGET)} (${((100 * total) / BUDGET).toFixed(0)}%)`);
