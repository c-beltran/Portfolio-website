import * as THREE from 'three';
import type { Vec3 } from '@/content/scene/cameras';

/** A mover pivot's pose in three's world axes; the quaternion is three's (x, y, z, w). */
export type Pose = { position: Vec3; quaternion: [number, number, number, number] };

type Present = {
  /** The seat's eye and view axis the canonical pose was made for (opened-poses.json). */
  eye: Vec3;
  forward: Vec3;
  /** The opened render's pose: d0 along forward, turned to show the object (opened-poses.json). */
  canonical: Pose;
  d0: number;
  /** The render's crop height over its focal length (opened-art.json): its angular height. */
  theta: number;
  /** Unit ray from the eye through the centre of the art box (.opened__art), world axes. */
  ray: Vec3;
  /** That box's height, and the live camera's focal length, in the same pixels. */
  artHeightPx: number;
  focalPx: number;
};

/**
 * Where an object stands when it has come forward: the canonical pose,
 * turned about the eye from the view axis onto the ray through the panel's slot, and moved along
 * that ray until it is as tall on screen as the art box (the render's angular height, scaled). The
 * eye sees the same side of it as the render shows. The DOM slot is the only layout; this only
 * reads it.
 */
export function presentPose(p: Present): Pose {
  const eye = new THREE.Vector3(...p.eye);
  const forward = new THREE.Vector3(...p.forward).normalize();
  const ray = new THREE.Vector3(...p.ray).normalize();
  const d = (p.theta * p.d0 * p.focalPx) / p.artHeightPx;
  const q = new THREE.Quaternion()
    .setFromUnitVectors(forward, ray)
    // normalised: the JSON's 6-decimal rounding leaves it ~1e-7 off unit, which three's rotation
    // formulas turn into a skew
    .multiply(new THREE.Quaternion(...p.canonical.quaternion).normalize());
  return {
    position: eye.addScaledVector(ray, d).toArray() as Vec3,
    quaternion: q.toArray() as Pose['quaternion'],
  };
}

/** Between two poses: position along the line, rotation along the shorter arc. */
export function blendPose(a: Pose, b: Pose, k: number): Pose {
  const position = new THREE.Vector3(...a.position).lerp(new THREE.Vector3(...b.position), k);
  const q = new THREE.Quaternion(...a.quaternion).slerp(new THREE.Quaternion(...b.quaternion), k);
  return { position: position.toArray() as Vec3, quaternion: q.toArray() as Pose['quaternion'] };
}

/**
 * How long, in px, an upright segment of length `size` looks through the camera, centred `dist`
 * along `ray` from the camera and square to the ray. presentPose sizes an object as if it sat on
 * the camera's axis, as in its render; off the axis a flat image stretches it (about 1/cos² along
 * the offset), so the live scene measures that here and refits.
 */
export function projectedHeight(
  cam: THREE.Camera,
  ray: Vec3,
  dist: number,
  size: number,
  view: { width: number; height: number },
): number {
  const r = new THREE.Vector3(...ray).normalize();
  const centre = cam.getWorldPosition(new THREE.Vector3()).addScaledVector(r, dist);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
    cam.getWorldQuaternion(new THREE.Quaternion()),
  );
  up.addScaledVector(r, -up.dot(r)).normalize();
  const a = centre
    .clone()
    .addScaledVector(up, size / 2)
    .project(cam);
  const b = centre
    .clone()
    .addScaledVector(up, -size / 2)
    .project(cam);
  return Math.hypot(((a.x - b.x) * view.width) / 2, ((a.y - b.y) * view.height) / 2);
}
