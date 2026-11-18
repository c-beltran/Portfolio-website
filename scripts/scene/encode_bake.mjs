// Encodes the baked lightmaps (~/Portfolio-assets/bake/<group>-<mode>.png) to WebP for the live
// scene, and prints each file's size. Run by optimize_glb.sh.
//
//   node scripts/scene/encode_bake.mjs <bake dir> <out dir> [quality]
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [src, out, q = '82'] = process.argv.slice(2);
if (!src || !out) throw new Error('usage: encode_bake.mjs <bake dir> <out dir> [quality]');
mkdirSync(out, { recursive: true });
let total = 0;
for (const f of readdirSync(src)
  .filter((f) => f.endsWith('.png'))
  .sort()) {
  const dest = join(out, f.replace(/\.png$/, '.webp'));
  await sharp(join(src, f))
    .webp({ quality: Number(q), effort: 6 })
    .toFile(dest);
  const kb = statSync(dest).size / 1024;
  total += kb;
  console.log(`${dest}  ${kb.toFixed(0)} kB`);
}
console.log(`total ${total.toFixed(0)} kB`);
