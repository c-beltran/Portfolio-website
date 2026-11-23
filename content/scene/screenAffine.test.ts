import { FACE_IDS } from '../faces';
import { isLean, LEAN_REGION } from '../opened';
import { describe, expect, it } from 'vitest';
import art from './opened-art.json';
import seat from './bounds-seat.json';
import { master } from './framing';
import { homography, NAME_REGION, quadMatrix3d, screenAffine, type Pt } from './screenAffine';

const QUAD = seat.quads.screen_right as Pt[];
const M = master();
const SQUARE: Pt[] = [
  [0.2, 0.2],
  [0.4, 0.2],
  [0.4, 0.4],
  [0.2, 0.4],
];
const close = (a: Pt, b: Pt, eps = 1e-9) => {
  expect(a[0]).toBeCloseTo(b[0], -Math.log10(eps));
  expect(a[1]).toBeCloseTo(b[1], -Math.log10(eps));
};
/** A box corner (bx, by) through the fit, back in master-normalised coordinates. */
const through = (f: ReturnType<typeof screenAffine>, bx: number, by: number): Pt => {
  const [a, b, c, d] = f.matrix;
  return [(f.x + a * bx + c * by) / M.w, (f.y + b * bx + d * by) / M.h];
};

describe('homography', () => {
  it('maps the unit square onto the quad, corner for corner', () => {
    const H = homography(QUAD);
    close(H(0, 0), QUAD[0]!);
    close(H(1, 0), QUAD[1]!);
    close(H(1, 1), QUAD[2]!);
    close(H(0, 1), QUAD[3]!);
  });
});

describe('screenAffine', () => {
  it('maps the top-left, top-right and bottom-left corners exactly', () => {
    const f = screenAffine(QUAD, M);
    close(through(f, 0, 0), QUAD[0]!);
    close(through(f, f.w, 0), QUAD[1]!);
    close(through(f, 0, f.h), QUAD[3]!);
  });

  it('puts the name region within 3% of its diagonal at the fourth corner, on the real quad', () => {
    const f = screenAffine(QUAD, M, NAME_REGION);
    const br = homography(QUAD)(NAME_REGION.s1, NAME_REGION.t1);
    const got = through(f, f.w, f.h);
    const err = Math.hypot((got[0] - br[0]) * M.w, (got[1] - br[1]) * M.h);
    expect(err / Math.hypot(f.w, f.h)).toBeLessThan(0.03);
  });

  it("the phone screen's affine fit is within 1% at its fourth corner", () => {
    // The clip on the opened phone: the screen faces the eye squarely, so an affine fit
    // of the whole quad is near exact. Units: art heights (x scaled by the art's aspect).
    const q = art.phone.screen as Pt[];
    const m = { w: art.phone.aspect, h: 1 };
    const f = screenAffine(q, m);
    const [a, b, c, d] = f.matrix;
    const got: Pt = [(f.x + a * f.w + c * f.h) / m.w, (f.y + b * f.w + d * f.h) / m.h];
    const br = q[2]!;
    const err = Math.hypot((got[0] - br[0]) * m.w, (got[1] - br[1]) * m.h);
    expect(err / Math.hypot(f.w, f.h)).toBeLessThan(0.01);
  });

  it("each face's affine fit is within 1% (movers) or 3% (lean-ins) of its box's diagonal at the fourth corner", () => {
    for (const id of FACE_IDS) {
      const a = (art as unknown as Record<string, { aspect: number; screen: Pt[] }>)[id]!;
      const lean = isLean(id);
      const r = lean ? LEAN_REGION : { s0: 0, t0: 0, s1: 1, t1: 1 };
      const m = { w: a.aspect, h: 1 };
      const f = screenAffine(a.screen, m, r);
      const [p, q, c, d] = f.matrix;
      const got: Pt = [(f.x + p * f.w + c * f.h) / m.w, (f.y + q * f.w + d * f.h) / m.h];
      const br = homography(a.screen)(r.s1, r.t1);
      const err = Math.hypot((got[0] - br[0]) * m.w, (got[1] - br[1]) * m.h);
      expect(err / Math.hypot(f.w, f.h), id).toBeLessThan(lean ? 0.03 : 0.01);
    }
  });

  it('gives an axis-aligned square the identity matrix', () => {
    const f = screenAffine(SQUARE, { w: 1, h: 1 });
    f.matrix.forEach((v, i) => expect(v).toBeCloseTo([1, 0, 0, 1][i]!, 12));
    expect(f.w).toBeCloseTo(0.2, 12);
    expect(f.h).toBeCloseTo(0.2, 12);
    expect([f.x, f.y]).toEqual([0.2, 0.2]);
  });
});

describe('quadMatrix3d', () => {
  /** Apply a CSS matrix3d (column-major) to (x, y, 0, 1). */
  const apply = (m: string, x: number, y: number): Pt => {
    const v = m.slice('matrix3d('.length, -1).split(',').map(Number);
    const X = v[0]! * x + v[4]! * y + v[12]!;
    const Y = v[1]! * x + v[5]! * y + v[13]!;
    const W = v[3]! * x + v[7]! * y + v[15]!;
    return [X / W, Y / W];
  };

  it('maps the box corners onto the quad', () => {
    const quad: Pt[] = [
      [12, 30],
      [180, 22],
      [205, 140],
      [4, 128],
    ];
    const m = quadMatrix3d(160, 100, quad);
    const corners: Pt[] = [
      [0, 0],
      [160, 0],
      [160, 100],
      [0, 100],
    ];
    corners.forEach(([x, y], i) => {
      const [gx, gy] = apply(m, x, y);
      expect(Math.abs(gx - quad[i]![0])).toBeLessThan(1e-6);
      expect(Math.abs(gy - quad[i]![1])).toBeLessThan(1e-6);
    });
  });

  it('gives a box mapped onto itself the identity', () => {
    expect(
      quadMatrix3d(80, 50, [
        [0, 0],
        [80, 0],
        [80, 50],
        [0, 50],
      ]),
    ).toBe('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
  });
});
