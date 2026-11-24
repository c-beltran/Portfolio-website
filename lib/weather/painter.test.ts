import { describe, expect, it } from 'vitest';
import { birdsAllowed, nextFlashAt, particleCount, skyColors, starsAlpha } from './painter';
import type { Condition } from './types';

const ALL: Condition[] = ['clear', 'partly', 'overcast', 'fog', 'rain', 'snow', 'storm'];

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('what falls', () => {
  it('rain, snow and storms fall, more as they get heavier; the rest have nothing falling', () => {
    for (const c of ['rain', 'snow', 'storm'] as const) {
      expect(particleCount(c, 0.5, 1e5)).toBeGreaterThan(0);
      expect(particleCount(c, 1, 1e5)).toBeGreaterThan(particleCount(c, 0.35, 1e5));
    }
    for (const c of ['clear', 'partly', 'overcast', 'fog'] as const)
      expect(particleCount(c, 1, 1e5)).toBe(0);
  });

  it('scales with the window, never past a cap', () => {
    expect(particleCount('rain', 1, 4e5)).toBeGreaterThan(particleCount('rain', 1, 1e5));
    expect(particleCount('rain', 1, 1e9)).toBeLessThanOrEqual(600);
  });
});

describe('birds and stars', () => {
  it('birds fly only in clear or partly cloudy daylight', () => {
    expect(birdsAllowed('clear', 1)).toBe(true);
    expect(birdsAllowed('partly', 0.5)).toBe(true);
    expect(birdsAllowed('clear', 0.4)).toBe(false);
    for (const c of ['overcast', 'fog', 'rain', 'snow', 'storm'] as const)
      expect(birdsAllowed(c, 1)).toBe(false);
  });

  it('stars show only on clear or partly cloudy nights', () => {
    expect(starsAlpha('clear', 0)).toBeGreaterThan(0);
    expect(starsAlpha('partly', 0)).toBeGreaterThan(0);
    expect(starsAlpha('clear', 0.5)).toBe(0);
    expect(starsAlpha('clear', 1)).toBe(0);
    for (const c of ['overcast', 'fog', 'rain', 'storm'] as const) expect(starsAlpha(c, 0)).toBe(0);
  });
});

describe('the sky', () => {
  it('a clear day is bluer than an overcast one', () => {
    const [cr, , cb] = rgb(skyColors('clear', 1).top);
    const [or, , ob] = rgb(skyColors('overcast', 1).top);
    expect(cb - cr).toBeGreaterThan(ob - or);
  });

  it('every sky is darker at night than by day', () => {
    for (const c of ALL) {
      expect(lum(skyColors(c, 0).top), c).toBeLessThan(lum(skyColors(c, 1).top));
      expect(lum(skyColors(c, 0).bottom), c).toBeLessThan(lum(skyColors(c, 1).bottom));
    }
  });

  it('gives hex colours', () => {
    for (const c of ALL)
      for (const d of [0, 0.5, 1]) {
        const s = skyColors(c, d);
        expect(s.top).toMatch(/^#[0-9a-f]{6}$/);
        expect(s.bottom).toMatch(/^#[0-9a-f]{6}$/);
      }
  });
});

describe('the storm flash', () => {
  it('is never sooner than 3 s after the last', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    let t = 0;
    for (let i = 0; i < 1000; i++) {
      const next = nextFlashAt(t, rand);
      expect(next - t).toBeGreaterThanOrEqual(3000);
      t = next;
    }
  });
});
