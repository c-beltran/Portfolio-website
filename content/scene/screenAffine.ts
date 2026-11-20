/**
 * Placing HTML on the monitor's right half (design 2026-11-19 §4.2): the screen seen from the seat
 * is a curved panel in perspective, so its corners (bounds-seat.json quads.screen_right, TL TR BR
 * BL, master-normalised) are not a parallelogram. CSS can't carry a window-sized perspective
 * matrix (its terms would depend on --u), so the name gets an affine fit to a small region of the
 * screen, exact at that region's top-left, top-right and bottom-left corners; over a small region
 * the fourth corner stays close (screenAffine.test.ts).
 */
export type Pt = [number, number];
/** A sub-rectangle of the screen: s across (0 left … 1 right), t down (0 top … 1 bottom). */
export type Region = { s0: number; t0: number; s1: number; t1: number };

/** Where the name and title sit on the right half: a heading across its upper part. */
export const NAME_REGION: Region = { s0: 0.08, t0: 0.1, s1: 0.92, t1: 0.32 };

const WHOLE: Region = { s0: 0, t0: 0, s1: 1, t1: 1 };

/** The projective map of the unit square (s, t) onto the quad (Heckbert's square-to-quad). */
export function homography(quad: Pt[]): (s: number, t: number) => Pt {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad as [Pt, Pt, Pt, Pt];
  const [dx1, dx2, dx3] = [x1 - x2, x3 - x2, x0 - x1 + x2 - x3];
  const [dy1, dy2, dy3] = [y1 - y2, y3 - y2, y0 - y1 + y2 - y3];
  let g = 0;
  let h = 0;
  if (dx3 !== 0 || dy3 !== 0) {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
  }
  const [a, b, d, e] = [x1 - x0 + g * x1, x3 - x0 + h * x3, y1 - y0 + g * y1, y3 - y0 + h * y3];
  return (s, t) => {
    const w = g * s + h * t + 1;
    return [(a * s + b * t + x0) / w, (d * s + e * t + y0) / w];
  };
}

/**
 * A box placed on a region of the quad, in safe-height units (x scaled by m.w, y by m.h): its
 * top-left corner (x, y), its size (w, h) and the unitless 2×2 that maps the box's top and left
 * edges onto the region's, for CSS `translate(x·u, y·u) matrix(a, b, c, d, 0, 0)`.
 */
export function screenAffine(
  quad: Pt[],
  m: { w: number; h: number },
  region: Region = WHOLE,
): { x: number; y: number; w: number; h: number; matrix: [number, number, number, number] } {
  const H = homography(quad);
  const at = (s: number, t: number): Pt => {
    const [x, y] = H(s, t);
    return [x * m.w, y * m.h];
  };
  const tl = at(region.s0, region.t0);
  const tr = at(region.s1, region.t0);
  const bl = at(region.s0, region.t1);
  const top: Pt = [tr[0] - tl[0], tr[1] - tl[1]];
  const left: Pt = [bl[0] - tl[0], bl[1] - tl[1]];
  const w = Math.hypot(...top);
  const h = Math.hypot(...left);
  return {
    x: tl[0],
    y: tl[1],
    w,
    h,
    matrix: [top[0] / w, top[1] / w, left[0] / h, left[1] / h],
  };
}
