import * as THREE from 'three';
import { artOf } from '@/content/opened';
import poses from '@/content/scene/opened-poses.json';
import type { Vec3 } from '@/content/scene/cameras';
import type { SpinId } from '@/lib/spin/spin';

type Quat = [number, number, number, number];

/**
 * The camera that sees a spinnable object exactly as its opened render does: at the seat's eye,
 * turned as the seat camera is (so the object's pivot, on the view axis, projects to the centre of
 * the full frame), with an off-axis frustum cut to the render's crop. The crop is theta tall at unit
 * distance (its height over the focal length) and aspect × theta wide, and puts the pivot at the
 * art's pivot (fractions from the top left). The frustum is given at unit distance.
 */
export function spinCamera(id: SpinId): {
  position: Vec3;
  quaternion: Quat;
  frustum: { left: number; right: number; top: number; bottom: number };
} {
  const { theta, aspect, pivot } = artOf(id);
  const forward = new THREE.Vector3(...(poses.forward as Vec3));
  const up = new THREE.Vector3(...(poses.up as Vec3));
  const look = new THREE.Matrix4().lookAt(new THREE.Vector3(), forward, up);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(look).toArray() as Quat;
  const w = theta * aspect;
  const left = -pivot[0] * w;
  const top = pivot[1] * theta;
  return {
    position: poses.eye as Vec3,
    quaternion,
    frustum: { left, right: left + w, top, bottom: top - theta },
  };
}
