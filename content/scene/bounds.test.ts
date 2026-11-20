import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collidingPairs, minCollisionFreeWidth, type Box, type SceneBounds } from './bounds';
import { master, visible } from './framing';

const OBJECTS = [
  'obj_monitor',
  'obj_kit',
  'obj_phone',
  'obj_badge',
  'obj_photo',
  'obj_notepad',
  'obj_card',
  'obj_lightbar',
] as const;

const ASPECT = 1440 / 2560; // any aspect: the search itself

describe('minCollisionFreeWidth', () => {
  it('is small for two small boxes far apart', () => {
    const boxes: Record<string, Box> = {
      a: { x0: 0.1, y0: 0.1, x1: 0.12, y1: 0.12 },
      b: { x0: 0.8, y0: 0.8, x1: 0.82, y1: 0.82 },
    };
    // The 44 px hotspots meet when 44 px > 0.68 W (x gap plus one box), i.e. below ~65 px.
    const w = minCollisionFreeWidth(boxes, ASPECT);
    expect(w).not.toBeNull();
    expect(w!).toBeLessThan(120);
    expect(collidingPairs(boxes, w!, ASPECT)).toEqual([]);
    expect(collidingPairs(boxes, w! - 1, ASPECT)).not.toEqual([]);
  });

  it('is null when two objects overlap on screen at every width', () => {
    const boxes: Record<string, Box> = {
      a: { x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.5 },
      b: { x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.6 },
    };
    expect(minCollisionFreeWidth(boxes, ASPECT)).toBeNull();
    expect(collidingPairs(boxes, 4000, ASPECT)).toEqual([['a', 'b']]);
  });

  it('grows a 2 px-wide box to 44 px around its centre', () => {
    const boxes: Record<string, Box> = {
      a: { x0: 0.5, y0: 0.5, x1: 0.502, y1: 0.502 },
      b: { x0: 0.54, y0: 0.49, x1: 0.56, y1: 0.51 },
    };
    // At 1000 px: a is 2 px wide at x 500, grows to 479..523; b starts at 540. Free.
    expect(collidingPairs(boxes, 1000, ASPECT)).toEqual([]);
    // At 500 px: a grows to 228.5..272.5; b is 270..280. They touch.
    expect(collidingPairs(boxes, 500, ASPECT)).toEqual([['a', 'b']]);
  });
});

/** Pixels per safe height in a W×H window (framing.ts). */
const uFor = (W: number, H: number) => {
  const v = visible(W / H);
  return H / ((v.y1 - v.y0) * master().h);
};
// The smallest windows the seat supports: a wide one (500×416, just above 6:5) and a portrait one.
const NARROWEST_U = uFor(500, 416);
const SEAT_OBJECTS = [...OBJECTS, 'obj_cv'];

describe('content/scene/bounds-seat.json', () => {
  const path = new URL('./bounds-seat.json', import.meta.url);

  it('exists (written by scripts/scene/export_bounds.py --camera seat)', () => {
    expect(existsSync(path)).toBe(true);
  });

  const data = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as SceneBounds & {
        quads: { screen_right: [number, number][] };
      })
    : null;
  const m = master();

  it('is normalised to the master, from cam_seat', () => {
    expect(data!.camera).toBe('cam_seat');
    expect(data!.aspect).toBeCloseTo(m.h / m.w, 3);
  });

  it('has the monitor halves (obj_monitor left, obj_cv right) and every object inside the safe frame', () => {
    expect(Object.keys(data!.objects).sort()).toEqual([...SEAT_OBJECTS].sort());
    for (const [name, b] of Object.entries(data!.objects)) {
      expect(b.x0, name).toBeGreaterThanOrEqual(m.safe.x0);
      expect(b.y0, name).toBeGreaterThanOrEqual(m.safe.y0);
      expect(b.x1, name).toBeLessThanOrEqual(m.safe.x1);
      expect(b.y1, name).toBeLessThanOrEqual(m.safe.y1);
    }
    const [l, r] = [data!.objects.obj_monitor!, data!.objects.obj_cv!];
    expect(l.x1).toBeCloseTo(r.x0, 2); // the halves meet at the image's midline
    expect(l.x0).toBeLessThan(r.x0);
  });

  it('gives the right half its screen quad (TL, TR, BR, BL) inside obj_cv', () => {
    const q = data!.quads.screen_right;
    const cv = data!.objects.obj_cv!;
    // The curved screen's midline leans by a few ten-thousandths; the box edge is its mean.
    const tol = 5e-4;
    expect(q).toHaveLength(4);
    for (const [x, y] of q) {
      expect(x).toBeGreaterThanOrEqual(cv.x0 - tol);
      expect(x).toBeLessThanOrEqual(cv.x1 + tol);
      expect(y).toBeGreaterThanOrEqual(cv.y0 - tol);
      expect(y).toBeLessThanOrEqual(cv.y1 + tol);
    }
    const [tl, tr, br, bl] = q as [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ];
    expect(tl[0]).toBeLessThan(tr[0]);
    expect(bl[0]).toBeLessThan(br[0]);
    expect(tl[1]).toBeLessThan(bl[1]);
    expect(tr[1]).toBeLessThan(br[1]);
  });

  it('records the minCollisionFreeWidth its boxes give', () => {
    expect(data!.minCollisionFreeWidth).toBe(minCollisionFreeWidth(data!.objects, data!.aspect));
  });

  it('portrait windows from 320×480 scale up at least as far as the narrowest wide window', () => {
    expect(uFor(320, 480)).toBeGreaterThanOrEqual(NARROWEST_U);
  });

  // Overlaps Carlos is shown in the phase 1 review (a report: objects are never moved to fit).
  //  - the photo frame stands in front of the monitor's right half, at every size;
  //  - the thin light bar's 44 px hotspot reaches the screen below it in small windows;
  //  - the badge lies just below the kit case, touching only at the narrowest window.
  const ACCEPTED: [string, string][] = [
    ['obj_badge', 'obj_kit'],
    ['obj_cv', 'obj_lightbar'],
    ['obj_cv', 'obj_photo'],
    ['obj_lightbar', 'obj_monitor'],
  ];

  it('has no hotspot overlaps beyond the accepted ones, from the narrowest window to 4K', () => {
    const seen = new Set<string>();
    const [lo, hi] = [Math.floor(m.w * NARROWEST_U), Math.ceil(m.w * uFor(3840, 2160))];
    for (let w = lo; w <= hi; w += 1)
      for (const p of collidingPairs(data!.objects, w, data!.aspect)) seen.add(p.join(' × '));
    expect([...seen].sort()).toEqual(ACCEPTED.map((p) => p.join(' × ')).sort());
  });
});
