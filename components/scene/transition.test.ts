import { describe, expect, it } from 'vitest';
import { CAMERAS } from '@/content/scene/cameras';
import { blend, cameraFor, hfov } from './transition';

describe('the shared camera transition', () => {
  it('starts on the first camera and ends on the second', () => {
    const a = CAMERAS.overview;
    const b = CAMERAS.monitor;
    expect(blend(a, b, 0).eye).toEqual(a.eye);
    expect(blend(a, b, 0).target).toEqual(a.target);
    expect(blend(a, b, 1).eye).toEqual(b.eye);
    expect(blend(a, b, 1).target).toEqual(b.target);
  });

  it('gives the overview its horizontal field of view', () => {
    expect(hfov(CAMERAS.overview)).toBeCloseTo(2 * Math.atan(18 / 35), 9);
  });

  it('uses the phone camera for the overview on a phone', () => {
    expect(cameraFor('overview', 'phone')).toBe(CAMERAS.phone);
  });
});
