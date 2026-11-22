// The hover glow's rings, on the edges only:
// from render_masks.py's silhouettes, per clickable item, a soft ring
// around it — its silhouette blurred, kept only outside the silhouette, so the object itself is
// never lit — as white-on-alpha WebP at a quarter of the master. The monitor's screen splits into
// its two halves at the CV half's left edge (bounds-seat.json quads.screen_right): How I build
// (monitor) and the CV. Neither half's ring lies on the screen, so one half never lights the other.
//
//   node scripts/scene/encode_glow.mjs [masks dir]   (default ~/Portfolio-assets/renders/masks)
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2] ?? join(homedir(), 'Portfolio-assets/renders/masks');
const OUT = 'public/glow';
const BLUR = 5; // px at a quarter of the master: ~20 px of glow at full size
const GAIN = 1.8;
const ITEMS = [
  'kit',
  'phone',
  'badge',
  'photo',
  'notepad',
  'card',
  'lightbar',
  'car',
  'ball',
  'board',
  'mug',
];

mkdirSync(OUT, { recursive: true });

async function grey(file) {
  const { data, info } = await sharp(file)
    .removeAlpha()
    .greyscale()
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  // below 8 is render noise, not the object
  for (let k = 0; k < data.length; k++) if (data[k] < 8) data[k] = 0;
  return { data, w: info.width, h: info.height };
}

async function write(name, values, w, h) {
  const rgba = Buffer.alloc(w * h * 4, 255);
  for (let k = 0; k < w * h; k++) rgba[k * 4 + 3] = values[k];
  const file = join(OUT, `${name}.webp`);
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .webp({ lossless: true })
    .toFile(file);
  console.log(`${file}  ${(statSync(file).size / 1024).toFixed(1)} kB`);
}

/** The ring around `mask`, cleared wherever `cover` is (the object, or the whole screen). */
async function ring(name, mask, w, h, cover = mask) {
  const blurred = await sharp(mask, { raw: { width: w, height: h, channels: 1 } })
    .blur(BLUR)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const out = Buffer.alloc(w * h);
  for (let k = 0; k < w * h; k++)
    out[k] = Math.min(255, Math.round(blurred[k] * (1 - cover[k] / 255) * GAIN));
  await write(`${name}-ring`, out, w, h);
}

for (const item of ITEMS) {
  const { data, w, h } = await grey(join(SRC, `mask-${item}.png`));
  await ring(item, data, w, h);
}

// The screen: left of the line through the CV half's top-left and bottom-left corners is How I build.
const { data, w, h } = await grey(join(SRC, 'mask-screen.png'));
const [[ax, ay], , , [bx, by]] = JSON.parse(readFileSync('content/scene/bounds-seat.json', 'utf8'))
  .quads.screen_right;
const halves = { monitor: Buffer.alloc(w * h), cv: Buffer.alloc(w * h) };
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    const k = y * w + x;
    const [u, v] = [(x + 0.5) / w, (y + 0.5) / h];
    const right = (bx - ax) * (v - ay) - (by - ay) * (u - ax) < 0;
    (right ? halves.cv : halves.monitor)[k] = data[k];
  }
for (const [name, mask] of Object.entries(halves)) await ring(name, mask, w, h, data);
