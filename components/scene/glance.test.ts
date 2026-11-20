import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAMERAS } from '@/content/scene/cameras';
import { damp, glanceShift, glanceTarget, LIMITS, TAU, type Vec3 } from './glance';

const { eye, target } = CAMERAS.seat;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Screen x, y (pixels, y down) of a world point through a camera at eye looking at t. */
function project(t: Vec3, p: Vec3, w = 1000, h = 600) {
  const cam = new THREE.PerspectiveCamera(50, w / h, 0.05, 20);
  cam.position.set(...eye);
  cam.lookAt(...t);
  cam.updateMatrixWorld();
  const v = new THREE.Vector3(...p).project(cam);
  return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
}

describe('glanceTarget', () => {
  it('a zero glance returns the target', () => {
    expect(glanceTarget(eye, target, 0, 0)).toEqual(target);
  });

  it('yaw +3° looks right (towards +x) and keeps the distance from the eye', () => {
    const t = glanceTarget(eye, target, LIMITS.yaw, 0);
    expect(t[0]).toBeGreaterThan(target[0]);
    expect(dist(t, eye)).toBeCloseTo(dist(target, eye), 9);
  });

  it('pitch +2° looks up (towards +y)', () => {
    expect(glanceTarget(eye, target, 0, LIMITS.pitch)[1]).toBeGreaterThan(target[1]);
  });
});

describe('glanceShift', () => {
  it('is zero at rest', () => {
    expect(glanceShift(0, 0, 800)).toEqual([0, 0]);
  });

  it('moves the overlays the way a projected point moves when the camera turns', () => {
    const p: Vec3 = [target[0] + 0.01, target[1], target[2]];
    const [x0, y0] = project(target, p);
    const [x1] = project(glanceTarget(eye, target, 0.01, 0), p);
    const [, y2] = project(glanceTarget(eye, target, 0, 0.01), p);
    const [dx] = glanceShift(0.01, 0, 800);
    const [, dy] = glanceShift(0, 0.01, 800);
    expect(Math.sign(x1! - x0!)).toBe(Math.sign(dx));
    expect(Math.sign(y2! - y0!)).toBe(Math.sign(dy));
  });
});

describe('damp', () => {
  it('closes 1 − 1/e of the gap in one time constant, and never overshoots', () => {
    expect(damp(0, 1, TAU)).toBeCloseTo(1 - Math.exp(-1), 9);
    expect(damp(0, 1, 10)).toBeLessThanOrEqual(1);
    expect(TAU).toBe(0.25);
  });
});
