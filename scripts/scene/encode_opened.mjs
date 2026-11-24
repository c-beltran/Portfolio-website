// Encodes render_opened.py's outputs for Tier 1, and writes their framing to
// content/scene/opened-art.json (and the terminal loop's to screen-loop.json).
//
//   node scripts/scene/encode_opened.mjs [renders dir] [--only ids] [--patches-only ids] [--loop]
//
// Reads opened-<id>-<mode>.png, patch-<id>-<mode>.png and loop-<k>-<mode>.png, each with its .json
// sidecar (default dir ~/Portfolio-assets/renders/opened). --only and --patches-only merge into
// opened-art.json, keeping the entries they don't touch.
// - A mover: both modes cropped to the union of their alpha boxes plus a 2% margin, at 800 and
//   1600 px wide, alpha kept: public/opened/<id>-<mode>-<w>.{avif,webp}.
// - A lean-in: opaque, cropped to its screen quad's box plus LEAN_MARGIN of its larger side.
// - Patches and loop frames: at the stills' 900 and 1600 px safe heights (the render is at 1600).
// Each entry: aspect (w/h), theta (the crop's height over the render's focal length, so the live
// scene can size to the same box), pivot (where the frame's centre falls in the crop), screen
// (normalised to the crop, 0,0 top left), the patch rect and widths for a mover, and steam for the mug.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
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
const patchesOnly = flag('--patches-only');
const withLoop = argv.includes('--loop') && argv.splice(argv.indexOf('--loop'), 1);
const SRC = argv[0] ?? join(homedir(), 'Portfolio-assets/renders/opened');
const OUT = 'public/opened';
const JSON_OUT = 'content/scene/opened-art.json';
const LOOP_OUT = 'content/scene/screen-loop.json';
const MOVERS = ['kit', 'phone', 'badge', 'photo', 'notepad', 'card', 'car', 'ball', 'mug'];
const LEANS = ['monitor', 'cv', 'board'];
const MODES = ['day', 'lamp'];
const WIDTHS = [800, 1600];
const SAFE = [900, 1600];
const MARGIN = 0.02;
const LEAN_MARGIN = 0.06;
const ALPHA = 8; // a pixel counts as the object above this alpha (0–255)
// The stills' qualities (encode_stills.mjs, which runs on import, so they're repeated here).
const QUALITY = { avif: 50, webp: 72 };

mkdirSync(OUT, { recursive: true });
const side = (f) => JSON.parse(readFileSync(join(SRC, `${f}.png.json`), 'utf8'));
const kb = (f) => `${(statSync(f).size / 1024).toFixed(0)} kB`;
const r5 = (v) => +v.toFixed(5);

async function alphaBox(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let [x0, y0, x1, y1] = [info.width, info.height, -1, -1];
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > ALPHA) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) throw new Error(`${file}: nothing drawn`);
  return { x0, y0, x1, y1, w: info.width, h: info.height };
}

async function encode(src, name, resize, opaque) {
  let base = resize.crop ? sharp(src).extract(resize.crop) : sharp(src);
  if (opaque) base = base.removeAlpha();
  base = base.resize({ width: resize.width });
  await base.clone().avif({ quality: QUALITY.avif, effort: 9 }).toFile(`${name}.avif`);
  await base.clone().webp({ quality: QUALITY.webp }).toFile(`${name}.webp`);
  console.log(`${name}: avif ${kb(`${name}.avif`)}, webp ${kb(`${name}.webp`)}`);
}

async function framed(id) {
  const lean = LEANS.includes(id);
  const s = side(`opened-${id}-day`);
  const size = s.size;
  let left, top, right, bottom;
  if (lean) {
    const xs = s.screen.map((p) => p[0]);
    const ys = s.screen.map((p) => p[1]);
    const pad =
      LEAN_MARGIN * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    [left, top] = [
      Math.max(0, Math.floor(Math.min(...xs) - pad)),
      Math.max(0, Math.floor(Math.min(...ys) - pad)),
    ];
    [right, bottom] = [
      Math.min(size, Math.ceil(Math.max(...xs) + pad)),
      Math.min(size, Math.ceil(Math.max(...ys) + pad)),
    ];
  } else {
    const boxes = await Promise.all(MODES.map((m) => alphaBox(join(SRC, `opened-${id}-${m}.png`))));
    const pad = Math.round(MARGIN * Math.max(boxes[0].w, boxes[0].h));
    left = Math.max(0, Math.min(...boxes.map((b) => b.x0)) - pad);
    top = Math.max(0, Math.min(...boxes.map((b) => b.y0)) - pad);
    right = Math.min(size, Math.max(...boxes.map((b) => b.x1)) + 1 + pad);
    bottom = Math.min(size, Math.max(...boxes.map((b) => b.y1)) + 1 + pad);
  }
  const crop = { left, top, width: right - left, height: bottom - top };
  for (const mode of MODES)
    for (const width of WIDTHS)
      await encode(
        join(SRC, `opened-${id}-${mode}.png`),
        join(OUT, `${id}-${mode}-${width}`),
        { crop, width },
        lean,
      );
  const norm = ([x, y]) => [r5((x - left) / crop.width), r5((y - top) / crop.height)];
  const entry = {
    aspect: r5(crop.width / crop.height),
    theta: r5(crop.height / s.focalPx),
    widths: WIDTHS,
    // The frame's centre is the pivot (a mover's render looks straight at it) or the lean-in's aim.
    pivot: norm([size / 2, size / 2]),
  };
  if (s.screen) entry.screen = s.screen.map(norm);
  if (s.steam) {
    const [x, y] = norm(s.steam.centre);
    entry.steam = { x, y, w: r5(s.steam.width / crop.width) };
  }
  return entry;
}

async function patched(id) {
  const p = side(`patch-${id}-day`);
  const pw = (await sharp(join(SRC, `patch-${id}-day.png`)).metadata()).width;
  const patchWidths = SAFE.map((safe) => Math.round((pw * safe) / 1600));
  for (const mode of MODES)
    for (const width of patchWidths)
      await encode(
        join(SRC, `patch-${id}-${mode}.png`),
        join(OUT, `patch-${id}-${mode}-${width}`),
        { width },
        true,
      );
  return {
    patch: Object.fromEntries(Object.entries(p.patch).map(([k, v]) => [k, r5(v)])),
    patchWidths,
  };
}

const art = existsSync(JSON_OUT) ? JSON.parse(readFileSync(JSON_OUT, 'utf8')) : {};
for (const id of only ?? [...MOVERS, ...LEANS]) {
  if (!MOVERS.includes(id) && !LEANS.includes(id)) throw new Error(`unknown id ${id}`);
  const entry = await framed(id);
  art[id] = MOVERS.includes(id) ? { ...entry, ...(await patched(id)) } : entry;
}
for (const id of patchesOnly ?? []) {
  if (!art[id]) throw new Error(`${id}: no art entry to add a patch to`);
  art[id] = { ...art[id], ...(await patched(id)) };
}
const ordered = Object.fromEntries(
  [...MOVERS, ...LEANS].filter((id) => art[id]).map((id) => [id, art[id]]),
);
writeFileSync(JSON_OUT, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(`wrote ${JSON_OUT}`);

if (withLoop) {
  mkdirSync('public/screens', { recursive: true });
  const s = side('loop-1-day');
  const lw = (await sharp(join(SRC, 'loop-1-day.png')).metadata()).width;
  const widths = SAFE.map((safe) => Math.round((lw * safe) / 1600));
  for (let k = 1; k <= 3; k++)
    for (const mode of MODES)
      for (const width of widths)
        await encode(
          join(SRC, `loop-${k}-${mode}.png`),
          join('public/screens', `terminal-${k}-${mode}-${width}`),
          { width },
          true,
        );
  const rect = Object.fromEntries(Object.entries(s.rect).map(([k, v]) => [k, r5(v)]));
  writeFileSync(LOOP_OUT, `${JSON.stringify({ rect, widths, frames: 3 }, null, 2)}\n`);
  console.log(`wrote ${LOOP_OUT}`);
}
