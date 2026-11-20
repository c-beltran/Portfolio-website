// Tier 1 stills from the seat (M3c phase 1): crops each approved master render (never committed)
// through framing.ts into the committed public/stills set: one crop per wide band (b0…) and the
// portrait strip (p), at a 900 px and a 1600 px safe height (the master's own, so nothing is
// upscaled). Names: seat-<crop>-<mode>-<width>.<avif|webp>. Budgets: content/scene/stills.test.ts.
//
//   pnpm exec tsx scripts/scene/encode_stills.mjs [renders dir]
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { band, bandCount, master, portraitStrip } from '../../content/scene/framing.ts';

const RENDERS = process.argv[2] ?? join(homedir(), 'Portfolio-assets/renders');
const OUT = 'public/stills';
const SAFE_PX = [900, 1600];
// Tuned against the budgets (quality, not size): AVIF effort 9 is slow but small.
export const QUALITY = { avif: 50, webp: 72 };

const CROPS = [...Array.from({ length: bandCount() }, (_, i) => [`b${i}`, band(i)]), ['p', portraitStrip()]];
const m = master();

mkdirSync(OUT, { recursive: true });
for (const mode of ['day', 'lamp']) {
  const input = join(RENDERS, `seat-${mode}.png`);
  const { width: W, height: H } = await sharp(input).metadata();
  for (const [crop, r] of CROPS) {
    const region = {
      left: Math.round(r.x0 * W),
      top: Math.round(r.y0 * H),
      width: Math.round((r.x1 - r.x0) * W),
      height: Math.round((r.y1 - r.y0) * H),
    };
    for (const safe of SAFE_PX) {
      const width = Math.round((r.x1 - r.x0) * m.w * safe);
      const height = Math.round((r.y1 - r.y0) * m.h * safe);
      const base = sharp(input).extract(region).resize({ width, height, fit: 'fill' });
      const name = `seat-${crop}-${mode}-${width}`;
      const avif = await base
        .clone()
        .avif({ quality: QUALITY.avif, effort: 9 })
        .toFile(join(OUT, `${name}.avif`));
      const webp = await base
        .clone()
        .webp({ quality: QUALITY.webp })
        .toFile(join(OUT, `${name}.webp`));
      console.log(
        `${name} (${width}×${height}): avif ${(avif.size / 1024).toFixed(0)} kB, webp ${(webp.size / 1024).toFixed(0)} kB`,
      );
    }
  }
}
