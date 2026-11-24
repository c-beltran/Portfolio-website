import { describe, expect, it } from 'vitest';
import { OUT, REST, stepMoment, type Moment } from './moment';
import { MOVE_MS } from './transition';

/** The coming-forward timeline: 0.9 s of travel, then the clip. */
const CLIP = 800;
const run = (m: Moment, open: boolean, ms: number, step = 16) => {
  for (let t = 0; t < ms; t += step) m = stepMoment(m, open, Math.min(step, ms - t), CLIP);
  return m;
};

describe('stepMoment', () => {
  it('opening travels for 900 ms, then plays the clip', () => {
    expect(MOVE_MS).toBe(900);
    const out = run(REST, true, 900);
    expect(out.travel).toBeCloseTo(1, 9);
    expect(out.clip).toBe(0);
    const half = run(out, true, CLIP / 2);
    expect(half.clip).toBeCloseTo(0.5, 9);
    expect(run(out, true, CLIP)).toEqual(OUT);
  });

  it('closing mid-travel falls from where it is, never more than dt/900 a step', () => {
    let m = run(REST, true, 450);
    expect(m.travel).toBeCloseTo(0.5, 9);
    for (let i = 0; i < 40; i++) {
      const next = stepMoment(m, false, 16, CLIP);
      expect(m.travel - next.travel).toBeLessThanOrEqual(16 / 900 + 1e-12);
      expect(next.travel).toBeLessThanOrEqual(m.travel);
      m = next;
    }
  });

  it('closing from out reaches rest by 900 ms, the clip folding back with it', () => {
    const m = run(OUT, false, 900);
    expect(m).toEqual(REST);
    const mid = run(OUT, false, 450);
    expect(mid.travel).toBeCloseTo(0.5, 9);
    expect(mid.clip).toBeCloseTo(0.5, 9);
  });

  it('reopening mid-close rises from where it is', () => {
    const closing = run(OUT, false, 300);
    const again = stepMoment(closing, true, 16, CLIP);
    expect(again.travel).toBeGreaterThan(closing.travel);
    expect(again.travel - closing.travel).toBeCloseTo(16 / 900, 9);
  });

  it('counts a 500 ms step as 100', () => {
    expect(stepMoment(REST, true, 500, CLIP).travel).toBeCloseTo(100 / 900, 9);
  });

  it('stays put once settled', () => {
    expect(stepMoment(REST, false, 16, CLIP)).toEqual(REST);
    expect(stepMoment(OUT, true, 16, CLIP)).toEqual(OUT);
  });
});
