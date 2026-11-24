import { describe, expect, it } from 'vitest';
import { dayness, sunElevation } from './sun';

describe("the sun's height", () => {
  it('is high at a June noon in Greenwich', () => {
    expect(sunElevation({ lat: 51.48, lon: 0 }, new Date('2026-06-21T12:00:00Z'))).toBeCloseTo(
      62,
      0,
    );
  });

  it('is well below the horizon at a June midnight in Greenwich', () => {
    expect(sunElevation({ lat: 51.48, lon: 0 }, new Date('2026-06-21T00:00:00Z'))).toBeLessThan(
      -10,
    );
  });

  it('is low at a December noon in New York', () => {
    const e = sunElevation({ lat: 40.71, lon: -74.01 }, new Date('2026-12-21T17:00:00Z'));
    expect(Math.abs(e - 25.8)).toBeLessThan(1);
  });

  it('is nearly overhead at an equinox noon in Quito', () => {
    expect(
      sunElevation({ lat: -0.18, lon: -78.47 }, new Date('2026-03-20T17:15:00Z')),
    ).toBeGreaterThan(80);
  });
});

describe('dayness', () => {
  it('is 1 from sunrise to sunset, 0 from 6° below, and blends in twilight', () => {
    expect(dayness(30)).toBe(1);
    expect(dayness(0)).toBe(1);
    expect(dayness(-3)).toBeCloseTo(0.5);
    expect(dayness(-6)).toBe(0);
    expect(dayness(-40)).toBe(0);
  });
});
