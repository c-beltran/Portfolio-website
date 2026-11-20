import { describe, expect, it } from 'vitest';
import bounds from './bounds-seat.json';
import { CAMERAS, verticalFov } from './cameras';
import { master } from './framing';

const deg = (r: number) => (r * 180) / Math.PI;

describe('cameras.json', () => {
  it('has the overview, phone, monitor and seat cameras', () => {
    expect(Object.keys(CAMERAS).sort()).toEqual(['monitor', 'overview', 'phone', 'seat']);
  });

  it('frames the seat master: horizontal fit across it, shifted up so the safe frame sits at the bottom', () => {
    const { w, h } = master();
    const seat = CAMERAS.seat;
    // Approved safe field of view, 73.5°, widened to the master's width.
    const hfov = 2 * Math.atan(seat.sensorWidth / 2 / seat.lens);
    expect(Math.tan(hfov / 2)).toBeCloseTo((Math.tan(((73.5 / 2) * Math.PI) / 180) * w) / 1.6, 3);
    expect(seat.shift[0]).toBe(0);
    expect(seat.shift[1]).toBeCloseTo((h - 1) / (2 * w), 4);
    expect(verticalFov(seat, w / h)).toBeCloseTo(
      deg(2 * Math.atan(seat.sensorWidth / (w / h) / 2 / seat.lens)),
      6,
    );
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

  it('aims the monitor camera at the screen (its two halves, seen from the seat)', () => {
    const [l, r] = [bounds.objects.obj_monitor, bounds.objects.obj_cv];
    const t = CAMERAS.monitor.target;
    expect(t[0]).toBeGreaterThan(-0.5);
    expect(t[0]).toBeLessThan(0.5);
    expect((l.x0 + r.x1) / 2).toBeCloseTo(0.5, 1); // the screen is centred in the seat's view
    expect(CAMERAS.monitor.eye[2]).toBeLessThan(CAMERAS.seat.eye[2]); // closer to the screen
  });
});
