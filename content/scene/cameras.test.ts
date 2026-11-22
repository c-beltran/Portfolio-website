import { describe, expect, it } from 'vitest';
import bounds from './bounds-seat.json';
import { CAMERAS, verticalFov, type Vec3 } from './cameras';
import { master } from './framing';

const deg = (r: number) => (r * 180) / Math.PI;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
};
const centroid = (q: Vec3[]) =>
  [0, 1, 2].map((i) => q.reduce((sum, p) => sum + p[i]!, 0) / q.length) as Vec3;
const LEANS = ['monitor', 'cv', 'board'] as const;

describe('cameras.json', () => {
  it('has the overview, phone and seat cameras, and one per lean-in', () => {
    expect(Object.keys(CAMERAS).sort()).toEqual([
      'board',
      'cv',
      'monitor',
      'overview',
      'phone',
      'seat',
    ]);
  });

  it.each(LEANS)('%s: the lean-in looks square at what it shows, calmly, from close up', (id) => {
    const cam = CAMERAS[id];
    const q = cam.screen!;
    expect(q).toHaveLength(4);
    const [tl, tr, br, bl] = q as [Vec3, Vec3, Vec3, Vec3];
    expect(tl[0]).toBeLessThan(tr[0]); // top-left, top-right, bottom-right, bottom-left
    expect(tl[1]).toBeGreaterThan(bl[1]);
    expect(Math.hypot(...sub(cam.eye, centroid(q)))).toBeCloseTo(0.45, 2);

    const axis = unit(sub(cam.target, cam.eye));
    const normal = unit(cross(sub(br, tl), sub(bl, tr)));
    expect(deg(Math.acos(Math.min(1, Math.abs(dot(axis, normal)))))).toBeLessThan(1);
    const seat = unit(sub(CAMERAS.seat.target, CAMERAS.seat.eye));
    expect(deg(Math.acos(dot(axis, seat)))).toBeLessThanOrEqual(25);

    // In a square frame through that camera, the farthest corner sits at 0.8 of the half-frame.
    const right = unit(cross(axis, [0, 1, 0]));
    const up = cross(right, axis);
    const half = cam.sensorWidth / 2 / cam.lens;
    const reach = q.map((p) => {
      const d = sub(p, cam.eye);
      return Math.max(Math.abs(dot(d, right)), Math.abs(dot(d, up))) / dot(d, axis) / half;
    });
    expect(Math.abs(Math.max(...reach) - 0.8)).toBeLessThanOrEqual(0.01);
  });

  it('leans in to the left half for How I build and the right half for the CV', () => {
    const x = (id: 'monitor' | 'cv') => centroid(CAMERAS[id].screen!)[0];
    expect(x('monitor')).toBeLessThan(x('cv'));
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
