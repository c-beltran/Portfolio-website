import { describe, expect, it } from 'vitest';
import {
  band,
  bandMedia,
  frameFor,
  master,
  PORTRAIT,
  ratio,
  viewOffset,
  visible,
  type FrameName,
  type Rect,
} from './framing';
import data from './framing.json';

const RANGES: Record<FrameName, [number, number]> = {
  seat: [6 / 5, 32 / 9],
  seatPhone: [3 / 7, 6 / 5],
};

const contains = (outer: Rect, inner: Rect, eps = 1e-9) =>
  outer.x0 <= inner.x0 + eps &&
  outer.y0 <= inner.y0 + eps &&
  outer.x1 >= inner.x1 - eps &&
  outer.y1 >= inner.y1 - eps;

/** Width / height of a master rect in master pixels. */
const aspectOf = (f: FrameName, r: Rect) =>
  ((r.x1 - r.x0) * master(f).w) / ((r.y1 - r.y0) * master(f).h);

// A fixed-seed generator, so a failure reproduces.
function rng(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
}

describe('ratio', () => {
  it('parses "a/b"', () => {
    expect(ratio('8/5')).toBe(1.6);
    expect(ratio('32/9')).toBeCloseTo(3.5556, 4);
  });
});

describe('master', () => {
  it('seat: wide enough for 32:9, tall enough for 6:5, safe frame at the bottom centre', () => {
    const m = master('seat');
    expect(m.w).toBeCloseTo(32 / 9, 12);
    expect(m.h).toBeCloseTo(4 / 3, 12);
    expect(m.safe.x0).toBeCloseTo(0.275, 6);
    expect(m.safe.y0).toBeCloseTo(0.25, 6);
    expect(m.safe.x1).toBeCloseTo(0.725, 6);
    expect(m.safe.y1).toBe(1);
  });

  it('seatPhone: 1.2 wide, 1.75 tall', () => {
    const m = master('seatPhone');
    expect(m.w).toBeCloseTo(1.2, 12);
    expect(m.h).toBeCloseTo(1.75, 12);
  });
});

describe('visible', () => {
  it('is the safe frame at the safe aspect', () => {
    const v = visible('seat', 8 / 5);
    const s = master('seat').safe;
    for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(v[k]).toBeCloseTo(s[k], 9);
  });

  it('at 32:9 spans the full width and the safe height', () => {
    const v = visible('seat', 32 / 9);
    expect(v.x0).toBeCloseTo(0, 9);
    expect(v.x1).toBeCloseTo(1, 9);
    expect(v.y0).toBeCloseTo(0.25, 9);
    expect(v.y1).toBeCloseTo(1, 9);
  });

  it('at 6:5 spans the full height', () => {
    const v = visible('seat', 6 / 5);
    expect(v.y0).toBeCloseTo(0, 9);
    expect(v.y1).toBeCloseTo(1, 9);
  });

  for (const f of ['seat', 'seatPhone'] as const) {
    it(`${f}: stays in the master, holds the safe frame, has the window's aspect`, () => {
      const r = rng(f === 'seat' ? 1 : 2);
      const [lo, hi] = RANGES[f];
      for (let i = 0; i < 200; i++) {
        const a = lo + (hi - lo) * r();
        const v = visible(f, a);
        expect(contains({ x0: 0, y0: 0, x1: 1, y1: 1 }, v)).toBe(true);
        expect(contains(v, master(f).safe)).toBe(true);
        expect(aspectOf(f, v)).toBeCloseTo(a, 9);
      }
    });

    it(`${f}: outside its range it still covers the window from inside the master`, () => {
      for (const a of [RANGES[f][0] * 0.6, RANGES[f][1] * 1.6]) {
        const v = visible(f, a);
        expect(contains({ x0: 0, y0: 0, x1: 1, y1: 1 }, v)).toBe(true);
        expect(aspectOf(f, v)).toBeCloseTo(a, 9);
      }
    });
  }
});

describe('band', () => {
  for (const f of ['seat', 'seatPhone'] as const) {
    const bands = data[f].bands.map(ratio);
    it(`${f}: each band holds what the window shows at its ends and middle`, () => {
      for (let i = 0; i < bands.length - 1; i++) {
        const [a0, a1] = [bands[i]!, bands[i + 1]!];
        for (const a of [a0, (a0 + a1) / 2, a1])
          expect(contains(band(f, i), visible(f, a))).toBe(true);
      }
    });
  }
});

describe('frameFor, PORTRAIT and bandMedia', () => {
  it('portrait up to 6:5, the wide seat above', () => {
    expect(frameFor(1.2)).toBe('seatPhone');
    expect(frameFor(1.2001)).toBe('seat');
    expect(PORTRAIT).toBe('(max-aspect-ratio: 6/5)');
  });

  it('a band above the first starts at its ratio; the first needs no query of its own', () => {
    expect(bandMedia('seat', 2)).toBe('(min-aspect-ratio: 21/10)');
    expect(bandMedia('seat', 1)).toBe('(min-aspect-ratio: 8/5)');
    expect(bandMedia('seat', 0)).toBe('');
    expect(bandMedia('seatPhone', 1)).toBe('(min-aspect-ratio: 3/5)');
  });
});

describe('viewOffset', () => {
  it('frames the master at its own aspect, with the window on the visible rect', () => {
    const [W, H] = [1280, 800];
    const o = viewOffset('seat', W / H, W, H);
    const m = master('seat');
    const v = visible('seat', W / H);
    expect(o.fullW / o.fullH).toBeCloseTo(m.w / m.h, 9);
    expect(o.x / o.fullW).toBeCloseTo(v.x0, 9);
    expect((o.x + W) / o.fullW).toBeCloseTo(v.x1, 9);
    expect(o.y / o.fullH).toBeCloseTo(v.y0, 9);
    expect((o.y + H) / o.fullH).toBeCloseTo(v.y1, 9);
  });
});
