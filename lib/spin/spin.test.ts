import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createSpin, isSpin, SPIN_IDS } from './spin';

const three = (q: readonly number[]) => new THREE.Quaternion(q[0], q[1], q[2], q[3]);
const angleOf = (q: readonly number[]) => 2 * Math.acos(Math.min(1, Math.abs(three(q).w)));
const axisOf = (q: readonly number[]) => new THREE.Vector3(q[0], q[1], q[2]).normalize();
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
    const before = [...s.q];
    s.release(2, 0);
    expect(s.step(16)).toBe(false);
    expect([...s.q]).toEqual(before);
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
    expect(Math.abs(1 - three(s.q).length())).toBeLessThan(1e-9);
  });

  it('turns as three.js would: horizontal then vertical, in screen axes', () => {
    const s = createSpin({ reducedMotion: false, pxPerRad: 100 });
    s.drag(50, 0);
    s.drag(0, 30);
    const want = new THREE.Quaternion()
      .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5))
      .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3));
    expect(three(s.q).angleTo(want)).toBeLessThan(1e-6); // acos near 1 rounds to ~1e-8
  });
});

describe('the spin stays light', () => {
  it('never imports three.js (it runs in the page before anything is grabbed)', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['lib/spin/spin.ts', 'lib/spin/live.ts', 'components/desk/SpinTarget.tsx'])
      expect(readFileSync(f, 'utf8')).not.toMatch(/from 'three'/);
  });
});
