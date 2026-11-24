import { describe, expect, it } from 'vitest';
import type { Condition, Sky } from '@/lib/weather/types';
import { LIGHT_FADE_MS, lightFor, MOON_RGB, POOL, TINT_FAR_SHARE } from './light';

const sky = (condition: Condition, dayness: number): Sky => ({
  condition,
  intensity: 0.75,
  windMs: 2,
  windDeg: 270,
  dayness,
  source: 'live',
});

describe('lightFor', () => {
  it('before the weather is known: no tint, the moon by the clock, the pool by the lamp', () => {
    expect(lightFor(null, 'day', 'off', 'day')).toEqual({
      tint: { rgb: expect.any(Array), k: 0 },
      moonK: 0,
      poolK: 0,
    });
    expect(lightFor(null, 'day', 'off', 'night').moonK).toBe(1);
    expect(lightFor(null, 'day', 'on', 'day').poolK).toBe(1);
  });

  it('night with the lamp off is moonlit; with it on the lamp render has its own night and pool', () => {
    expect(lightFor(sky('clear', 0), 'day', 'off', 'night').moonK).toBe(1);
    const lit = lightFor(sky('clear', 0), 'lamp', 'on', 'night');
    expect([lit.moonK, lit.poolK]).toEqual([0, 0]);
  });

  it('day with the lamp on adds the pool, without moonlight', () => {
    const l = lightFor(sky('rain', 1), 'day', 'on', 'day');
    expect([l.moonK, l.poolK]).toEqual([0, 1]);
  });

  it('the moon follows the sun after the page has painted (twilight is half moonlit)', () => {
    expect(lightFor(sky('clear', 0.5), 'day', 'off', 'day').moonK).toBeCloseTo(0.5);
  });

  it('a clear day warms, a wet one cools', () => {
    const [r, , b] = lightFor(sky('clear', 1), 'day', 'off', 'day').tint.rgb;
    expect(r).toBeGreaterThan(b);
    for (const c of ['overcast', 'fog', 'rain', 'snow', 'storm'] as const) {
      const [cr, , cb] = lightFor(sky(c, 1), 'day', 'off', 'day').tint.rgb;
      expect(cb, c).toBeGreaterThanOrEqual(cr);
    }
  });

  it('the tint is daylight: none at night, less in twilight', () => {
    for (const c of ['clear', 'partly', 'overcast', 'fog', 'rain', 'snow', 'storm'] as const)
      expect(lightFor(sky(c, 0), 'day', 'off', 'night').tint.k, c).toBe(0);
    expect(lightFor(sky('rain', 1), 'day', 'off', 'day').tint.k).toBeGreaterThan(
      lightFor(sky('rain', 0.5), 'day', 'off', 'day').tint.k,
    );
  });

  it('a storm is the deepest tint', () => {
    const k = (c: Condition) => lightFor(sky(c, 1), 'day', 'off', 'day').tint.k;
    for (const c of ['clear', 'partly', 'overcast', 'fog', 'rain', 'snow'] as const)
      expect(k('storm')).toBeGreaterThan(k(c));
  });

  it('has its constants in range', () => {
    for (const v of [...MOON_RGB, ...POOL.rgb]) expect(v).toBeGreaterThanOrEqual(0);
    expect(POOL.at.every((v) => v > 0 && v < 1)).toBe(true);
    expect(TINT_FAR_SHARE).toBe(0.4);
    expect(LIGHT_FADE_MS).toBe(2000);
  });
});
