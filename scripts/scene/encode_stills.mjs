// Tier 1 stills: encodes the approved M3a renders (never committed) into the committed
// public/stills set. Budgets are checked by content/scene/stills.test.ts.
//
//   node scripts/scene/encode_stills.mjs [renders dir]
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const RENDERS = process.argv[2] ?? join(homedir(), 'Portfolio-assets/renders');
const OUT = 'public/stills';
// Tuned against the budgets (quality, not size): AVIF effort 9 is slow but small.
export const QUALITY = { avif: 50, webp: 72 };

const JOBS = [
  { view: 'desk', src: 'overview', widths: [1280, 2560] },
  { view: 'phone', src: 'phone', widths: [540, 1080] },
];

mkdirSync(OUT, { recursive: true });
for (const { view, src, widths } of JOBS) {
  for (const mode of ['day', 'lamp']) {
    const input = join(RENDERS, `final-${mode}-${src}.png`);
    for (const w of widths) {
      const base = sharp(input).resize({ width: w });
      const name = `${view}-${mode}-${w}`;
      const avif = await base
        .clone()
        .avif({ quality: QUALITY.avif, effort: 9 })
        .toFile(join(OUT, `${name}.avif`));
      const webp = await base
        .clone()
        .webp({ quality: QUALITY.webp })
        .toFile(join(OUT, `${name}.webp`));
      console.log(
        `${name}: avif ${(avif.size / 1024).toFixed(0)} kB, webp ${(webp.size / 1024).toFixed(0)} kB`,
      );
    }
  }
}
