import { statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { band, bandCount, master, portraitStrip, type Rect } from './framing';

/** Tier 1 stills (spec §7: LCP ≤ 2.0 s on a mid phone). */
const DIR = join(process.cwd(), 'public/stills');

/**
 * The seat stills (M3c phase 1): crops of the master per wide band (b0…) and the portrait strip
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
