// Encodes the baked lightmaps (~/Portfolio-assets/bake/<group>-<mode>.png) to WebP for the live
// scene, and prints each file's size. Run by optimize_glb.sh.
//
//   node scripts/scene/encode_bake.mjs <bake dir> <out dir> [quality] [--only p1,p2] [--skip p1,p2]
//
// --only / --skip keep or drop files by name prefix (the movers' opened bakes go to their own,
// on-demand folder).
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const [v] = argv.splice(i, 2).slice(1);
  return v.split(',');
};
const only = flag('--only');
const skip = flag('--skip');
const [src, out, q = '82'] = argv;
if (!src || !out)
  throw new Error(
    'usage: encode_bake.mjs <bake dir> <out dir> [quality] [--only p1,p2] [--skip p1,p2]',
  );
const keep = (f) =>
  (!only || only.some((p) => f.startsWith(p))) && !(skip ?? []).some((p) => f.startsWith(p));
mkdirSync(out, { recursive: true });
let total = 0;
for (const f of readdirSync(src)
  .filter((f) => f.endsWith('.png') && keep(f))
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
