import { statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

/** Tier 1 stills from the approved M3a render (spec §7: LCP ≤ 2.0 s on a mid phone). */
const DIR = join(process.cwd(), 'public/stills');
const SIZES = {
  desk: { 1280: [1280, 720], 2560: [2560, 1440] },
  phone: { 540: [540, 540], 1080: [1080, 1080] },
} as const;
const FILES = Object.entries(SIZES).flatMap(([view, widths]) =>
  ['day', 'lamp'].flatMap((mode) =>
    Object.entries(widths).flatMap(([w, [width, height]]) =>
      ['avif', 'webp'].map((ext) => ({ name: `${view}-${mode}-${w}.${ext}`, ext, width, height })),
    ),
  ),
);
const KB = 1024;
const BUDGET: Record<string, number> = {
  'desk-day-1280.avif': 120 * KB,
  'phone-day-540.avif': 60 * KB,
};

describe('Tier 1 stills', () => {
  it('has all 16 files', () => {
    expect(FILES).toHaveLength(16);
  });

  it.each(FILES)('$name has its pixel size', async ({ name, width, height }) => {
    const meta = await sharp(join(DIR, name)).metadata();
    expect([meta.width, meta.height]).toEqual([width, height]);
  });

  it.each(FILES)('$name fits its byte budget', ({ name, ext }) => {
    const limit = BUDGET[name] ?? (ext === 'avif' ? 350 * KB : 500 * KB);
    expect(statSync(join(DIR, name)).size).toBeLessThanOrEqual(limit);
  });
});
