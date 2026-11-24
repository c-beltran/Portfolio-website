import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { artOf } from '@/content/opened';
import poses from '@/content/scene/opened-poses.json';
import { SPIN_IDS } from '@/lib/spin/spin';
import { spinCamera } from './spinCamera';

/** A three camera from spinCamera, with its off-axis frustum at a near plane of 0.01. */
function camera(id: (typeof SPIN_IDS)[number]) {
  const c = spinCamera(id);
  const cam = new THREE.PerspectiveCamera();
  cam.position.fromArray(c.position);
  cam.quaternion.fromArray(c.quaternion);
  cam.updateMatrixWorld(true);
  const n = 0.01;
  const f = c.frustum;
  cam.projectionMatrix.makePerspective(f.left * n, f.right * n, f.top * n, f.bottom * n, n, 10);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  return { cam, c };
}

describe('the spin camera', () => {
  for (const id of SPIN_IDS) {
    it(`frames the ${id} as its opened render: the pivot lands where the render put it`, () => {
      const { cam } = camera(id);
      const p = new THREE.Vector3(...poses[id].pose.position).project(cam);
      const [px, py] = artOf(id).pivot;
      expect((p.x + 1) / 2).toBeCloseTo(px, 3);
      expect((1 - p.y) / 2).toBeCloseTo(py, 3);
    });

    it(`the ${id}'s frame is as tall as the render's angular height, and as wide as its aspect`, () => {
      const { c } = camera(id);
      const a = artOf(id);
      expect(c.frustum.top - c.frustum.bottom).toBeCloseTo(a.theta, 6);
      expect((c.frustum.right - c.frustum.left) / (c.frustum.top - c.frustum.bottom)).toBeCloseTo(
        a.aspect,
        6,
      );
    });
  }
});
