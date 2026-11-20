import { describe, expect, it } from 'vitest';
import { CAMERAS } from '@/content/scene/cameras';
import { blend, cameraFor, hfov } from './transition';

describe('the shared camera transition', () => {
  it('starts on the first camera and ends on the second', () => {
    const a = CAMERAS.seat;
    const b = CAMERAS.monitor;
    expect(blend(a, b, 0).eye).toEqual(a.eye);
    expect(blend(a, b, 0).target).toEqual(a.target);
    expect(blend(a, b, 1).eye).toEqual(b.eye);
    expect(blend(a, b, 1).target).toEqual(b.target);
  });

  it('gives the seat its horizontal field of view across the master', () => {
    expect(hfov(CAMERAS.seat)).toBeCloseTo(2 * Math.atan(18 / CAMERAS.seat.lens), 9);
  });

  it('rests at the seat, on every window shape (design 2026-11-19 §3.2)', () => {
    expect(cameraFor('rest')).toBe(CAMERAS.seat);
    expect(cameraFor('monitor')).toBe(CAMERAS.monitor);
  });
});
