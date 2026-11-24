import { describe, expect, it } from 'vitest';
import {
  band,
  bandCount,
  bandFor,
  bandMedia,
  isPortrait,
  master,
  PORTRAIT,
  portraitStrip,
  ratio,
  viewOffset,
  visible,
  type Rect,
} from './framing';

const [LO, HI] = [6 / 5, 32 / 9];
const S = 8 / 5;

const contains = (outer: Rect, inner: Rect, eps = 1e-9) =>
  outer.x0 <= inner.x0 + eps &&
  outer.y0 <= inner.y0 + eps &&
  outer.x1 >= inner.x1 - eps &&
  outer.y1 >= inner.y1 - eps;

/** Width / height of a master rect in master pixels. */
const aspectOf = (r: Rect) => ((r.x1 - r.x0) * master().w) / ((r.y1 - r.y0) * master().h);

const WHOLE: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 };

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
  it('wide enough for 32:9, tall enough for 6:5, safe frame at the bottom centre', () => {
    const m = master();
    expect(m.w).toBeCloseTo(32 / 9, 12);
    expect(m.h).toBeCloseTo(4 / 3, 12);
    expect(m.safe.x0).toBeCloseTo(0.275, 6);
    expect(m.safe.y0).toBeCloseTo(0.25, 6);
    expect(m.safe.x1).toBeCloseTo(0.725, 6);
    expect(m.safe.y1).toBe(1);
  });
});

describe('visible, wide windows (above 6:5)', () => {
  it('is the safe frame at the safe aspect', () => {
    const v = visible(S);
    const s = master().safe;
    for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(v[k]).toBeCloseTo(s[k], 9);
  });

  it('at 32:9 spans the full width and the safe height', () => {
    const v = visible(32 / 9);
    expect(v.x0).toBeCloseTo(0, 9);
    expect(v.x1).toBeCloseTo(1, 9);
    expect(v.y0).toBeCloseTo(0.25, 9);
    expect(v.y1).toBeCloseTo(1, 9);
  });

  it('just above 6:5 spans the full height', () => {
    const v = visible(LO + 1e-9);
    expect(v.y0).toBeCloseTo(0, 6);
    expect(v.y1).toBeCloseTo(1, 9);
  });

  it('stays in the master, holds the safe frame, has the window aspect, ignores pan', () => {
    const r = rng(1);
    for (let i = 0; i < 200; i++) {
      const a = LO + 1e-6 + (HI - LO) * r();
      const v = visible(a);
      expect(contains(WHOLE, v)).toBe(true);
      expect(contains(v, master().safe)).toBe(true);
      expect(aspectOf(v)).toBeCloseTo(a, 9);
      expect(visible(a, 1)).toEqual(v);
    }
  });

  it('beyond 32:9 still covers the window from inside the master', () => {
    const v = visible(HI * 1.6);
    expect(contains(WHOLE, v)).toBe(true);
    expect(aspectOf(v)).toBeCloseTo(HI * 1.6, 9);
  });
});

describe('visible, portrait windows (6:5 and narrower)', () => {
  it('shows one safe height, centred, at pan 0', () => {
    const v = visible(9 / 19.5);
    const s = master().safe;
    expect(v.y0).toBeCloseTo(s.y0, 12);
    expect(v.y1).toBe(1);
    expect((v.x0 + v.x1) / 2).toBeCloseTo(0.5, 12);
    expect(aspectOf(v)).toBeCloseTo(9 / 19.5, 9);
  });

  it('6:5 itself is portrait', () => {
    expect(visible(LO).y0).toBeCloseTo(master().safe.y0, 12);
  });

  it('pans to the safe frame edges at ±1, and clamps beyond them', () => {
    const s = master().safe;
    expect(visible(0.5, -1).x0).toBeCloseTo(s.x0, 12);
    expect(visible(0.5, 1).x1).toBeCloseTo(s.x1, 12);
    expect(visible(0.5, -3)).toEqual(visible(0.5, -1));
    expect(visible(0.5, 3)).toEqual(visible(0.5, 1));
  });

  it('stays inside the portrait strip at every aspect and pan', () => {
    const r = rng(2);
    for (let i = 0; i < 200; i++) {
      const a = 0.25 + (LO - 0.25) * r();
      const v = visible(a, r() * 2 - 1);
      expect(contains(portraitStrip(), v)).toBe(true);
      expect(aspectOf(v)).toBeCloseTo(a, 9);
    }
  });

  it('the strip is the safe frame', () => {
    expect(portraitStrip()).toEqual(master().safe);
  });
});

describe('band', () => {
  it('each band holds what the window shows at its ends and middle', () => {
    const b = [6 / 5 + 1e-9, 8 / 5, 21 / 10, 32 / 9];
    expect(bandCount()).toBe(3);
    for (let i = 0; i < bandCount(); i++) {
      const [a0, a1] = [b[i]!, b[i + 1]!];
      for (const a of [a0, (a0 + a1) / 2, a1]) expect(contains(band(i), visible(a))).toBe(true);
    }
  });
});

describe('bandFor', () => {
  it('is the wide band a window of this aspect loads (the last one beyond 32:9)', () => {
    expect(bandFor(1.3)).toBe(0);
    expect(bandFor(8 / 5)).toBe(1);
    expect(bandFor(2.2)).toBe(2);
    expect(bandFor(5)).toBe(2);
  });
});

describe('isPortrait, PORTRAIT and bandMedia', () => {
  it('portrait up to 6:5, wide above', () => {
    expect(isPortrait(1.2)).toBe(true);
    expect(isPortrait(1.2001)).toBe(false);
    expect(PORTRAIT).toBe('(max-aspect-ratio: 6/5)');
  });

  it('a band above the first starts at its ratio; the first needs no query of its own', () => {
    expect(bandMedia(2)).toBe('(min-aspect-ratio: 21/10)');
    expect(bandMedia(1)).toBe('(min-aspect-ratio: 8/5)');
    expect(bandMedia(0)).toBe('');
  });
});

describe('viewOffset', () => {
  const check = (W: number, H: number, pan = 0) => {
    const o = viewOffset(W / H, W, H, pan);
    const m = master();
    const v = visible(W / H, pan);
    expect(o.fullW / o.fullH).toBeCloseTo(m.w / m.h, 9);
    expect(o.x / o.fullW).toBeCloseTo(v.x0, 9);
    expect((o.x + W) / o.fullW).toBeCloseTo(v.x1, 9);
    expect(o.y / o.fullH).toBeCloseTo(v.y0, 9);
    expect((o.y + H) / o.fullH).toBeCloseTo(v.y1, 9);
  };

  it('frames the master at its own aspect, with the window on the visible rect', () => {
    check(1280, 800);
  });

  it('follows the pan in a portrait window', () => {
    check(390, 844, 1);
    check(390, 844, -0.4);
  });
});
