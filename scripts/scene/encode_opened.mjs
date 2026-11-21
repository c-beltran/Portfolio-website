// Encodes render_opened.py's outputs for Tier 1 (design 2026-11-19 §5.5, §6), and writes their
// framing to content/scene/opened-art.json.
//
//   node scripts/scene/encode_opened.mjs [renders dir]   (default ~/Portfolio-assets/renders/opened)
//
// Reads opened-<id>-<mode>.png and patch-<id>-<mode>.png, each with its .json sidecar.
// Opened: both modes cropped to the union of their alpha boxes plus a 2% margin, at 800 and 1600 px
// wide, alpha kept: public/opened/<id>-<mode>-<w>.{avif,webp}. Patches: at the stills' 900 and 1600
// px safe heights (the render is at 1600): public/opened/patch-<id>-<mode>-<w>.{avif,webp}.
// opened-art.json: per id, aspect (w/h), theta (the crop's height over the render's focal length,
// so the live scene can size the object to the same box), the patch rect (master-normalised, y down)
// and its widths, and for the phone its screen quad normalised to the crop (0,0 top left).
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = process.argv[2] ?? join(homedir(), 'Portfolio-assets/renders/opened');
const OUT = 'public/opened';
const JSON_OUT = 'content/scene/opened-art.json';
const IDS = ['kit', 'phone'];
const MODES = ['day', 'lamp'];
const WIDTHS = [800, 1600];
const SAFE = [900, 1600];
const MARGIN = 0.02;
const ALPHA = 8; // a pixel counts as the object above this alpha (0–255)
// The stills' qualities (encode_stills.mjs, which runs on import, so they're repeated here).
const QUALITY = { avif: 50, webp: 72 };

mkdirSync(OUT, { recursive: true });
const side = (f) => JSON.parse(readFileSync(join(SRC, `${f}.png.json`), 'utf8'));
const kb = (f) => `${(statSync(f).size / 1024).toFixed(0)} kB`;

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

const art = {};
for (const id of IDS) {
  const boxes = await Promise.all(MODES.map((m) => alphaBox(join(SRC, `opened-${id}-${m}.png`))));
  const { w, h } = boxes[0];
  const pad = Math.round(MARGIN * Math.max(w, h));
  const left = Math.max(0, Math.min(...boxes.map((b) => b.x0)) - pad);
  const top = Math.max(0, Math.min(...boxes.map((b) => b.y0)) - pad);
  const right = Math.min(w, Math.max(...boxes.map((b) => b.x1)) + 1 + pad);
  const bottom = Math.min(h, Math.max(...boxes.map((b) => b.y1)) + 1 + pad);
  const crop = { left, top, width: right - left, height: bottom - top };
  const s = side(`opened-${id}-day`);
  for (const mode of MODES)
    for (const width of WIDTHS) {
      const base = sharp(join(SRC, `opened-${id}-${mode}.png`))
        .extract(crop)
        .resize({ width });
      const name = join(OUT, `${id}-${mode}-${width}`);
      await base.clone().avif({ quality: QUALITY.avif, effort: 9 }).toFile(`${name}.avif`);
      await base.clone().webp({ quality: QUALITY.webp }).toFile(`${name}.webp`);
      console.log(
        `${name} (${crop.width}×${crop.height} crop): avif ${kb(`${name}.avif`)}, webp ${kb(`${name}.webp`)}`,
      );
    }
  const entry = {
    aspect: +(crop.width / crop.height).toFixed(5),
    theta: +(crop.height / s.focalPx).toFixed(5),
    widths: WIDTHS,
  };
  if (s.screen)
    entry.screen = s.screen.map(([x, y]) => [
      +((x - left) / crop.width).toFixed(5),
      +((y - top) / crop.height).toFixed(5),
    ]);

  const p = side(`patch-${id}-day`);
  entry.patch = Object.fromEntries(Object.entries(p.patch).map(([k, v]) => [k, +v.toFixed(5)]));
  const pw = (await sharp(join(SRC, `patch-${id}-day.png`)).metadata()).width;
  entry.patchWidths = SAFE.map((safe) => Math.round((pw * safe) / 1600));
  for (const mode of MODES)
    for (const width of entry.patchWidths) {
      const base = sharp(join(SRC, `patch-${id}-${mode}.png`))
        .removeAlpha() // opaque: a piece of the still
        .resize({ width });
      const name = join(OUT, `patch-${id}-${mode}-${width}`);
      await base.clone().avif({ quality: QUALITY.avif, effort: 9 }).toFile(`${name}.avif`);
      await base.clone().webp({ quality: QUALITY.webp }).toFile(`${name}.webp`);
      console.log(`${name}: avif ${kb(`${name}.avif`)}, webp ${kb(`${name}.webp`)}`);
    }
  art[id] = entry;
}
writeFileSync(JSON_OUT, `${JSON.stringify(art, null, 2)}\n`);
console.log(`wrote ${JSON_OUT}`);
