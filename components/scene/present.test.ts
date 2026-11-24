import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import poses from '@/content/scene/opened-poses.json';
import { blendPose, presentPose, projectedHeight, spunPose, type Pose } from './present';

/**
 * The pose an object takes in front of the panel's slot: the canonical
 * pose (the opened render's), turned about the eye onto the ray through the slot and moved along it
 * until it fills the slot as the render fills the art.
 */
const v = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);
const eye = poses.eye as [number, number, number];
const forward = poses.forward as [number, number, number];
const canonical = poses.kit.pose as Pose;
const FACE = new THREE.Vector3(0, 1, 0); // the kit's inside, in three's local axes (Blender +Z)
const base = { eye, forward, canonical, d0: 0.42, theta: 0.9, focalPx: 1000 };

const faceAngle = (p: Pose) => {
  const face = FACE.clone().applyQuaternion(new THREE.Quaternion(...p.quaternion).normalize());
  return face.angleTo(v(eye).sub(v(p.position)));
};
const rayTo = (dx: number, dy: number): [number, number, number] => {
  const f = v(forward);
  const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, f);
  return f.add(right.multiplyScalar(dx)).add(up.multiplyScalar(dy)).normalize().toArray();
};

describe('presentPose', () => {
  it('puts the object on the ray', () => {
    const ray = rayTo(-0.3, 0.1);
    const p = presentPose({ ...base, ray, artHeightPx: 500 });
    const d = v(p.position).sub(v(eye));
    expect(d.clone().normalize().dot(v(ray))).toBeCloseTo(1, 9);
    // d = θ·d0·focalPx / artHeightPx
    expect(d.length()).toBeCloseTo((0.9 * 0.42 * 1000) / 500, 9);
  });

  it('twice the art height halves the distance', () => {
    const ray = rayTo(0.2, -0.05);
    const a = presentPose({ ...base, ray, artHeightPx: 400 });
    const b = presentPose({ ...base, ray, artHeightPx: 800 });
    const da = v(a.position).distanceTo(v(eye));
    const db = v(b.position).distanceTo(v(eye));
    expect(db).toBeCloseTo(da / 2, 9);
  });

  it('keeps the canonical turn when the ray is the view axis', () => {
    const p = presentPose({ ...base, ray: forward, artHeightPx: 378 });
    const want = new THREE.Quaternion(...canonical.quaternion).normalize().toArray();
    p.quaternion.forEach((x, i) => expect(x).toBeCloseTo(want[i]!, 9));
  });

  it('shows the eye the same side of the object as the render did, off the axis too', () => {
    const want = faceAngle(canonical);
    for (const ray of [rayTo(-0.35, 0), rayTo(0.3, 0.12), rayTo(0, -0.25)]) {
      const p = presentPose({ ...base, ray, artHeightPx: 450 });
      // to 1e-5 rad: the JSON's 6 decimals put the canonical point ~6e-7 off its own forward axis
      expect(faceAngle(p)).toBeCloseTo(want, 5);
    }
  });
});

describe('blendPose', () => {
  const a: Pose = { position: [0, 0, 0], quaternion: [0, 0, 0, 1] };
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const b: Pose = { position: [1, 2, 3], quaternion: turn.toArray() as Pose['quaternion'] };

  it('is exact at 0 and 1', () => {
    expect(blendPose(a, b, 0)).toEqual(a);
    const end = blendPose(a, b, 1);
    expect(end.position).toEqual(b.position);
    end.quaternion.forEach((x, i) => expect(x).toBeCloseTo(b.quaternion[i]!, 9));
  });

  it('takes the short way round for a sign-flipped quaternion', () => {
    const flipped: Pose = { ...b, quaternion: b.quaternion.map((x) => -x) as Pose['quaternion'] };
    const m1 = new THREE.Quaternion(...blendPose(a, b, 0.5).quaternion);
    const m2 = new THREE.Quaternion(...blendPose(a, flipped, 0.5).quaternion);
    expect(m1.angleTo(m2)).toBeLessThan(1e-9);
    expect(m1.angleTo(new THREE.Quaternion())).toBeCloseTo(Math.PI / 4, 9);
  });
});

describe('projectedHeight', () => {
  // a camera at the origin looking down -z, 50° vertical field, 1000×800 px
  const cam = new THREE.PerspectiveCamera(50, 1000 / 800, 0.05, 20);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const view = { width: 1000, height: 800 };
  const f = 400 / Math.tan((25 * Math.PI) / 180);

  it('on the axis, is focal × size / distance', () => {
    expect(projectedHeight(cam, [0, 0, -1], 2, 0.1, view)).toBeCloseTo((f * 0.1) / 2, 6);
  });

  it('off the axis, a flat image stretches it about 1/cos² along the offset', () => {
    const a = (15 * Math.PI) / 180;
    const ray: [number, number, number] = [0, -Math.sin(a), -Math.cos(a)];
    const h = projectedHeight(cam, ray, 2, 0.05, view);
    expect(h / ((f * 0.05) / 2)).toBeCloseTo(1 / Math.cos(a) ** 2, 2);
  });
});

describe('spunPose', () => {
  it('rotates about the centre, not the pivot', () => {
    const pose: Pose = { position: [1, 0, 0], quaternion: [0, 0, 0, 1] };
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const out = spunPose(pose, [0, 0, 0], q);
    expect(out.position[0]).toBeCloseTo(0, 9);
    expect(out.position[2]).toBeCloseTo(-1, 9);
    expect(new THREE.Quaternion(...out.quaternion).angleTo(q)).toBeLessThan(1e-9);
    const still = spunPose(pose, [1, 0, 0], q);
    expect(still.position).toEqual([1, 0, 0]);
  });
});
