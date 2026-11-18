// Desktop frame rate on /lab/monitor (M3b Part A): headed Chromium, 5 transitions per mode,
// read off the page's own readout. Needs the static export served (pnpm serve:out).
//
//   node scripts/lab/fps.mjs [base url]
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const RUNS = 5;

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/lab/monitor`);
for (const mode of ['live', 'clips']) {
  await page.getByRole('radio', { name: mode === 'live' ? 'Live 3D' : 'Clips' }).check();
  if (mode === 'live') await page.waitForTimeout(5000);
  console.log(`\n== ${mode}`);
  for (let i = 0; i < RUNS; i++) {
    const [button, state] = i % 2 === 0 ? ['Monitor', 'monitor'] : ['Back', 'overview'];
    await page.getByRole('button', { name: button }).click();
    await page.getByTestId('lab-state').filter({ hasText: state }).waitFor({ timeout: 15000 });
    console.log(`  ${button.padEnd(7)} ${await page.getByTestId('lab-fps').textContent()}`);
    await page.waitForTimeout(400);
  }
}
await browser.close();
