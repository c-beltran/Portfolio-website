// The seat look test: crops the seat's master render through framing.ts's
// visible() at the window shapes a visitor will have (portrait ones centred and swiped to each side), and lays them out on one labelled sheet for
// review. Never committed.
//
//   pnpm exec tsx scripts/scene/look_sheet.mjs [renders dir] [out png]
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { visible } from '../../content/scene/framing.ts';

const RENDERS = process.argv[2] ?? join(homedir(), 'Portfolio-assets/renders');
const OUT = process.argv[3] ?? 'docs/private/design/seat/phase1/look-sheet.png';
const MASTER = 'seat-look-seat.png';

/** A crop of a master render: rect normalised to the master. */
async function crop(rect, height) {
  const img = sharp(join(RENDERS, MASTER));
  const { width: W, height: H } = await img.metadata();
  const left = Math.round(rect.x0 * W);
  const top = Math.round(rect.y0 * H);
  const width = Math.round((rect.x1 - rect.x0) * W);
  const h = Math.round((rect.y1 - rect.y0) * H);
  return img.extract({ left, top, width, height: h }).resize({ height }).png().toBuffer();
}

const label = (text, width, size = 22) =>
  Buffer.from(
    `<svg width="${width}" height="${size + 14}"><text x="2" y="${size}" font-family="Helvetica" font-size="${size}" fill="#222">${text}</text></svg>`,
  );

const ROWS = [
  {
    title: 'Wide seat: laptops and desktops (the whole window is the desk)',
    height: 300,
    items: [
      ['6:5 (narrow window)', visible(6 / 5 + 1e-9)],
      ['16:10 (MacBook)', visible(16 / 10)],
      ['16:9 (most monitors)', visible(16 / 9)],
      ['21:9 (ultrawide)', visible(21 / 9)],
      ['32:9 (super-ultrawide)', visible(32 / 9)],
    ],
  },
  {
    title: 'Phones and portrait tablets: straight ahead, swipe sideways to look around',
    height: 560,
    items: [
      ['iPhone, swiped left', visible(9 / 19.5, -1)],
      ['iPhone (9:19.5)', visible(9 / 19.5)],
      ['iPhone, swiped right', visible(9 / 19.5, 1)],
      ['iPad portrait (3:4)', visible(3 / 4)],
    ],
  },
];

const GAP = 24;
const parts = [];
let y = GAP;
let sheetW = 0;
for (const row of ROWS) {
  parts.push({ input: label(row.title, 1800, 30), left: GAP, top: y });
  y += 50;
  let x = GAP;
  for (const [name, rect] of row.items) {
    const buf = await crop(rect, row.height);
    const { width } = await sharp(buf).metadata();
    parts.push({ input: label(name, width + 40), left: x, top: y });
    parts.push({ input: buf, left: x, top: y + 36 });
    x += width + GAP;
  }
  sheetW = Math.max(sheetW, x);
  y += row.height + 36 + GAP * 2;
}
await sharp({ create: { width: sheetW, height: y, channels: 3, background: '#f4f2ee' } })
  .composite(parts)
  .png()
  .toFile(OUT);
console.log(`wrote ${OUT} (${sheetW}×${y})`);
