// The window's glass, for the weather drawn over the still: from render_masks.py's mask-sky.png
// (everything black, so only the window is see-through, at a quarter of the master), kept inside
// the window's patch (quads.sky), specks dropped, cropped to the sky, and traced to a vector clip
// (content/scene/sky-clip.json; a clip is never an image, so it can never be the page's largest
// paint). Writes the crop's place on the master (fractions) to content/scene/sky-mask.json.
//
//   node scripts/scene/encode_sky.mjs [masks dir]   (default ~/Portfolio-assets/renders/masks)
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { simplify, trace } from './trace.mjs';

const SRC = process.argv[2] ?? join(homedir(), 'Portfolio-assets/renders/masks');
const CLIP = 'content/scene/sky-clip.json';
const RECT = 'content/scene/sky-mask.json';

const { data, info } = await sharp(join(SRC, 'mask-sky.png'))
  .ensureAlpha()
  .extractChannel(3)
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
// Only inside the window's patch of sky (quads.sky): a seam elsewhere in the room may let a sliver
// of the world through, and the weather never shows there.
const quad = JSON.parse(readFileSync('content/scene/bounds-seat.json', 'utf8')).quads.sky;
const inQuad = (px, py) => {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = quad[i];
    const [bx, by] = quad[(i + 1) % 4];
    const c = Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax));
    if (c && sign && c !== sign) return false;
    sign ||= c;
  }
  return true;
};
const sky = Buffer.alloc(w * h);
let [x0, y0, x1, y1] = [w, h, -1, -1];
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    const v = inQuad((x + 0.5) / w, (y + 0.5) / h) ? 255 - data[y * w + x] : 0;
    // below 8 is anti-aliasing noise on solid geometry
    sky[y * w + x] = v < 8 ? 0 : v;
    if (v >= 8)
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
// Drop specks: a hairline seam in the room's walls is see-through too.
const MIN_SPECK = 200;
const seen = new Uint8Array(w * h);
for (let k = 0; k < w * h; k++) {
  if (!sky[k] || seen[k]) continue;
  const part = [k];
  seen[k] = 1;
  for (let i = 0; i < part.length; i++) {
    const q = part[i];
    const [qx, qy] = [q % w, Math.floor(q / w)];
    for (const [nx, ny] of [
      [qx + 1, qy],
      [qx - 1, qy],
      [qx, qy + 1],
      [qx, qy - 1],
    ]) {
      const n = ny * w + nx;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && sky[n] && !seen[n]) {
        seen[n] = 1;
        part.push(n);
      }
    }
  }
  if (part.length < MIN_SPECK) for (const q of part) sky[q] = 0;
}
[x0, y0, x1, y1] = [w, h, -1, -1];
for (let k = 0; k < w * h; k++)
  if (sky[k]) {
    const [x, y] = [k % w, Math.floor(k / w)];
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
if (x1 < 0) throw new Error('encode_sky: no sky in the mask');
const cw = x1 - x0 + 1;
const ch = y1 - y0 + 1;
// The outline of the glass, as a clip path in the crop's own units (0–1 across and down; drawn with
// clipPathUnits="objectBoundingBox" and the even-odd rule, so a gap between leaves is a hole).
const loops = trace({ data: sky.map((v) => (v >= 128 ? 1 : 0)), w, h })
  .map((loop) => simplify(loop, 0.8))
  .filter((loop) => loop.length >= 3);
const n = (v) => Number(v.toFixed(4));
const d = loops
  .map(
    (loop) => 'M' + loop.map(([x, y]) => `${n((x - x0) / cw)} ${n((y - y0) / ch)}`).join('L') + 'Z',
  )
  .join('');
writeFileSync(CLIP, JSON.stringify({ d }) + '\n');
const r = (v) => Math.round(v * 1e5) / 1e5;
writeFileSync(
  RECT,
  JSON.stringify(
    { x0: r(x0 / w), y0: r(y0 / h), x1: r((x1 + 1) / w), y1: r((y1 + 1) / h) },
    null,
    2,
  ) + '\n',
);
console.log(`${CLIP}  ${loops.length} loops, ${(d.length / 1024).toFixed(1)} kB → ${RECT}`);
