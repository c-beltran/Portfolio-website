import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { band, bandCount, master, portraitStrip, type Rect } from './framing';

/** Tier 1 stills (LCP ≤ 2.0 s on a mid phone). */
const DIR = join(process.cwd(), 'public/stills');

/**
 * The seat stills: crops of the master per wide band (b0…) and the portrait strip
 * (p), at a 900 px and a 1600 px safe height (the master's own; nothing is upscaled).
 */
const SAFE_PX = [900, 1600];
const SEAT_RECTS: [string, Rect][] = [
  ...Array.from({ length: bandCount() }, (_, i): [string, Rect] => [`b${i}`, band(i)]),
  ['p', portraitStrip()],
];
const px = (r: Rect, safe: number) => {
  const m = master();
  return [Math.round((r.x1 - r.x0) * m.w * safe), Math.round((r.y1 - r.y0) * m.h * safe)] as const;
};
const SEAT_FILES = SEAT_RECTS.flatMap(([b, r]) =>
  ['day', 'lamp'].flatMap((mode) =>
    SAFE_PX.flatMap((safe) => {
      const [width, height] = px(r, safe);
      return ['avif', 'webp'].map((ext) => ({
        name: `seat-${b}-${mode}-${width}.${ext}`,
        ext,
        width,
        height,
      }));
    }),
  ),
);
const KB = 1024;
const BUDGET: Record<string, number> = {
  // Desktop 1×, and the files Lighthouse's mobile run (412×823 @1.75) and phones fetch: the strip
  // is 1.6 safe heights wide, so every phone takes its 2560 px one.
  'seat-b1-day-1890.avif': 140 * KB,
  'seat-p-day-1440.avif': 110 * KB,
  'seat-p-day-2560.avif': 180 * KB,
};

describe('Tier 1 seat stills', () => {
  it('has 32 files: 4 crops × 2 modes × 2 sizes × 2 formats', () => {
    expect(SEAT_FILES).toHaveLength(32);
    expect(SEAT_FILES.map((f) => f.name)).toContain('seat-p-day-2560.avif');
  });

  it.each(SEAT_FILES)('$name has its pixel size', async ({ name, width, height }) => {
    const meta = await sharp(join(DIR, name)).metadata();
    expect([meta.width, meta.height]).toEqual([width, height]);
  });

  it.each(SEAT_FILES)('$name fits its byte budget', ({ name, ext }) => {
    const limit = BUDGET[name] ?? (ext === 'avif' ? 350 * KB : 500 * KB);
    expect(statSync(join(DIR, name)).size).toBeLessThanOrEqual(limit);
  });
});

/**
 * The room, read out of the stills themselves: the ball by the
 * left wall shows in the ultrawide crop, and the magnet board hangs left of the monitor in every
 * crop. Boxes from bounds-seat.json, mapped into each crop by its band; measured from the
 * extracted pixels (sharp's stats() ignores extract()).
 */
describe('the room', () => {
  type B = { x0: number; y0: number; x1: number; y1: number };
  const seat = JSON.parse(
    readFileSync(join(process.cwd(), 'content/scene/bounds-seat.json'), 'utf8'),
  ) as { objects: Record<string, B> };

  /** Luma of every pixel in a box (master-normalised) of a band's crop. */
  async function luma(file: string, r: Rect, b: B) {
    const { data, info } = await sharp(join(DIR, file))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const [W, H] = [info.width, info.height];
    const x0 = Math.max(0, Math.floor(((b.x0 - r.x0) / (r.x1 - r.x0)) * W));
    const x1 = Math.min(W, Math.ceil(((b.x1 - r.x0) / (r.x1 - r.x0)) * W));
    const y0 = Math.max(0, Math.floor(((b.y0 - r.y0) / (r.y1 - r.y0)) * H));
    const y1 = Math.min(H, Math.ceil(((b.y1 - r.y0) / (r.y1 - r.y0)) * H));
    const out: number[] = [];
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const k = (y * W + x) * 3;
        out.push(0.2126 * data[k]! + 0.7152 * data[k + 1]! + 0.0722 * data[k + 2]!);
      }
    return out;
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = (a: number[]) => Math.sqrt(mean(a.map((v) => (v - mean(a)) ** 2)));

  it('the ball shows in the ultrawide still: its middle brighter than the floor round it', async () => {
    const b = seat.objects.obj_ball!;
    const [w, h] = [b.x1 - b.x0, b.y1 - b.y0];
    const middle = { x0: b.x0 + w / 4, y0: b.y0 + h / 4, x1: b.x1 - w / 4, y1: b.y1 - h / 4 };
    // the floor one to two widths to its right (to its left is the lit wall, brighter than both)
    const around = { x0: b.x1 + w, y0: b.y0 + h / 4, x1: b.x1 + 2 * w, y1: b.y1 - h / 4 };
    const r = band(bandCount() - 1);
    const inside = mean(await luma('seat-b2-day-3200.webp', r, middle));
    const floor = mean(await luma('seat-b2-day-3200.webp', r, around));
    expect(inside - floor).toBeGreaterThanOrEqual(30);
  });

  it('the board hangs on the wall: its magnets break up the plain wall', async () => {
    const values = await luma('seat-b1-day-1890.webp', band(1), seat.objects.obj_board!);
    expect(sd(values)).toBeGreaterThanOrEqual(15);
  });
});
