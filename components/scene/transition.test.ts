import { describe, expect, it } from 'vitest';
import { CAMERAS } from '@/content/scene/cameras';
import { hfov } from './transition';

describe('the shared camera transition', () => {
  it('gives the seat its horizontal field of view across the master', () => {
    expect(hfov(CAMERAS.seat)).toBeCloseTo(2 * Math.atan(18 / CAMERAS.seat.lens), 9);
  });
});
