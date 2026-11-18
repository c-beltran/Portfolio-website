import { describe, expect, it } from 'vitest';
import bounds from './bounds.json';
import { CAMERAS, verticalFov } from './cameras';

const deg = (r: number) => (r * 180) / Math.PI;

describe('cameras.json', () => {
  it('has the overview, phone and monitor cameras', () => {
    expect(Object.keys(CAMERAS).sort()).toEqual(['monitor', 'overview', 'phone']);
  });

  it('gives three.js the vertical field of view of the Blender lens (horizontal sensor fit)', () => {
    expect(verticalFov(CAMERAS.overview, 16 / 9)).toBeCloseTo(
      deg(2 * Math.atan(36 / (16 / 9) / 2 / 35)),
      6,
    );
    expect(verticalFov(CAMERAS.phone, 1)).toBeCloseTo(deg(2 * Math.atan(18 / 2 / 19.5)), 6);
  });

  it('puts every eye above the desk top (three.js Y up)', () => {
    for (const [name, c] of Object.entries(CAMERAS)) expect(c.eye[1], name).toBeGreaterThan(0.75);
  });

  it('aims the monitor camera at the screen seen from the overview', () => {
    const m = bounds.objects.obj_monitor;
    const t = CAMERAS.monitor.target;
    // The screen's centre is near the middle of its projected box; the target sits within it in x.
    expect(t[0]).toBeGreaterThan(-0.5);
    expect(t[0]).toBeLessThan(0.5);
    expect((m.x0 + m.x1) / 2).toBeGreaterThan(0.4);
    expect(CAMERAS.monitor.eye[2]).toBeLessThan(CAMERAS.overview.eye[2]); // closer to the screen
  });
});
