import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createSpin, isSpin, SPIN_IDS } from './spin';

const angleOf = (q: THREE.Quaternion) => 2 * Math.acos(Math.min(1, Math.abs(q.w)));
const axisOf = (q: THREE.Quaternion) => new THREE.Vector3(q.x, q.y, q.z).normalize();
const run = (s: ReturnType<typeof createSpin>, ms: number) => {
  for (let t = 0; t < ms; t += 16) s.step(16);
};

describe('the spin', () => {
  it('spins only the car, the ball and the mug', () => {
    expect(SPIN_IDS).toEqual(['car', 'ball', 'mug']);
    expect(isSpin('car')).toBe(true);
    expect(isSpin('badge')).toBe(false);
  });

  it('drag turns about the screen axes', () => {
    const a = createSpin({ reducedMotion: false, pxPerRad: 180 });
    a.drag(180, 0);
    expect(angleOf(a.q)).toBeCloseTo(1, 6);
    expect(axisOf(a.q).y).toBeCloseTo(1, 6);
    const b = createSpin({ reducedMotion: false, pxPerRad: 180 });
    b.drag(0, 180);
    expect(angleOf(b.q)).toBeCloseTo(1, 6);
    expect(axisOf(b.q).x).toBeCloseTo(1, 6);
  });

  it('a flick coasts and comes to rest in about 1.5 s', () => {
    const s = createSpin({ reducedMotion: false });
    s.release(2, 0);
    run(s, 1000);
    expect(s.atRest).toBe(false);
    run(s, 1000);
    expect(s.atRest).toBe(true);
    expect(angleOf(s.q)).toBeGreaterThan(0.5);
  });

  it('reduced motion has no momentum', () => {
    const s = createSpin({ reducedMotion: true });
    const before = s.q.clone();
    s.release(2, 0);
    expect(s.step(16)).toBe(false);
    expect(s.q.equals(before)).toBe(true);
  });

  it('arrow steps are 15° and shift steps 45°', () => {
    const s = createSpin({ reducedMotion: false });
    s.nudge('y', 15);
    expect(angleOf(s.q)).toBeCloseTo((15 * Math.PI) / 180, 6);
    const t = createSpin({ reducedMotion: false });
    t.nudge('x', 45);
    expect(angleOf(t.q)).toBeCloseTo((45 * Math.PI) / 180, 6);
  });

  it('reset eases home, or jumps when instant', () => {
    const s = createSpin({ reducedMotion: false });
    s.drag(300, 120);
    s.reset();
    expect(s.step(16)).toBe(true);
    run(s, 600);
    expect(angleOf(s.q)).toBeLessThan(1e-6);
    expect(s.atRest).toBe(true);
    const t = createSpin({ reducedMotion: false });
    t.drag(300, 120);
    t.release(3, 1);
    t.reset(true);
    expect(angleOf(t.q)).toBe(0);
    expect(t.step(16)).toBe(false);
  });

  it('free rotation never gimbal-locks', () => {
    const s = createSpin({ reducedMotion: false });
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 400 - 200;
    for (let i = 0; i < 200; i++) s.drag(rand(), rand());
    expect(Math.abs(1 - s.q.length())).toBeLessThan(1e-9);
  });
});
