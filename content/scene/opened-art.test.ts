import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import art from './opened-art.json';
import bounds from './bounds-seat.json';

/**
 * The opened-object stills (design 2026-11-19 §5.5, §6): a Cycles render of each object that comes
 * forward, in its opened pose, cut out on transparency, ≤ 150 kB a file; and the patch that hides
 * the object on the Tier 1 still while it is out (≤ 40 kB a file, my call), both loaded on demand.
 */
const DIR = join(process.cwd(), 'public/opened');
const KB = 1024;
type Entry = {
  aspect: number;
  theta: number;
  patch: { x0: number; y0: number; x1: number; y1: number };
  patchWidths: number[];
  widths: number[];
  screen?: [number, number][];
};
const ART = art as unknown as Record<'kit' | 'phone', Entry>;
const OBJ = { kit: 'obj_kit', phone: 'obj_phone' } as const;

describe.each(['kit', 'phone'] as const)('the opened %s', (id) => {
  const a = ART[id];

  it('has its framing', () => {
    expect(a.aspect).toBeGreaterThan(0.3);
    expect(a.aspect).toBeLessThan(4);
    expect(a.theta).toBeGreaterThan(0.05);
    expect(a.theta).toBeLessThan(1.5);
    expect(a.widths).toEqual([800, 1600]);
  });

  for (const mode of ['day', 'lamp']) {
    for (const w of [800, 1600]) {
      for (const ext of ['avif', 'webp']) {
        const name = `${id}-${mode}-${w}.${ext}`;
        it(`${name} is cut out, ${w} px wide, ≤ 150 kB`, async () => {
          const p = join(DIR, name);
          expect(existsSync(p), name).toBe(true);
          const m = await sharp(p).metadata();
          expect(m.hasAlpha).toBe(true);
          expect(m.width).toBe(w);
          expect(m.width! / m.height!).toBeCloseTo(a.aspect, 1);
          expect(statSync(p).size).toBeLessThanOrEqual(150 * KB);
        });
      }
    }
  }

  it('its patch covers its spot on the desk', () => {
    const b = (
      bounds.objects as Record<string, { x0: number; y0: number; x1: number; y1: number }>
    )[OBJ[id]]!;
    expect(a.patch.x0).toBeLessThanOrEqual(b.x0);
    expect(a.patch.y0).toBeLessThanOrEqual(b.y0);
    expect(a.patch.x1).toBeGreaterThanOrEqual(b.x1);
    expect(a.patch.y1).toBeGreaterThanOrEqual(b.y1);
  });

  for (const mode of ['day', 'lamp']) {
    it(`its ${mode} patch files are ≤ 40 kB`, () => {
      expect(a.patchWidths).toHaveLength(2);
      for (const w of a.patchWidths)
        for (const ext of ['avif', 'webp']) {
          const p = join(DIR, `patch-${id}-${mode}-${w}.${ext}`);
          expect(existsSync(p), p).toBe(true);
          expect(statSync(p).size).toBeLessThanOrEqual(40 * KB);
        }
    });
  }
});

describe('the phone screen', () => {
  it('is a convex quad inside the art', () => {
    const q = ART.phone.screen!;
    expect(q).toHaveLength(4);
    for (const [s, t] of q) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
    // convex, one winding: every turn has the same sign
    const turns = q.map((p, i) => {
      const [a, b, c] = [p, q[(i + 1) % 4]!, q[(i + 2) % 4]!];
      return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    });
    expect(turns.every((t) => t > 0) || turns.every((t) => t < 0)).toBe(true);
  });
});
