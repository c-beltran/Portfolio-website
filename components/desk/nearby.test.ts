import { describe, expect, it } from 'vitest';
import { nearby } from './nearby';

describe('nearby', () => {
  const centres: Record<string, [number, number]> = { kit: [100, 100], badge: [100, 200] };

  it('returns the nearest of two in range', () => {
    expect(nearby(centres, [100, 130], 90)).toBe('kit');
    expect(nearby(centres, [100, 170], 90)).toBe('badge');
  });

  it('returns null when nothing is in range', () => {
    expect(nearby(centres, [400, 400], 90)).toBeNull();
    expect(nearby({}, [0, 0], 90)).toBeNull();
  });

  it('gives a tie to the first key', () => {
    expect(nearby(centres, [100, 150], 90)).toBe('kit');
  });
});
