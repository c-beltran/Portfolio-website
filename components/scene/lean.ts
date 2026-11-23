import * as THREE from 'three';
import { artOf, type LeanId } from '@/content/opened';
import { CAMERAS } from '@/content/scene/cameras';

/** A camera as plain numbers: where it is, where it faces, and its projection (column-major). */
export type CamState = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  projection: number[];
};
/** A box in CSS px. */
export type ScreenBox = { left: number; top: number; width: number; height: number };

export function stateOf(camera: THREE.PerspectiveCamera): CamState {
  return {
    position: camera.position.toArray() as CamState['position'],
    quaternion: camera.quaternion.toArray() as CamState['quaternion'],
    projection: [...camera.projectionMatrix.elements],
  };
}

const scratch = new THREE.PerspectiveCamera(50, 1, 0.05, 20);

/**
 * The live view leaned in to a face, square to it from its lean-in camera, framed so the face
 * fills the art box exactly as the Tier 1 render would: a focal length of box height / theta px,
 * with the optical axis through the art's pivot (setViewOffset moves it off the canvas centre).
 */
export function leanView(id: LeanId, box: ScreenBox, canvas: ScreenBox): CamState {
  const c = CAMERAS[id];
  const a = artOf(id);
  const cam = scratch;
  cam.position.set(...c.eye);
  cam.up.set(0, 1, 0);
  cam.lookAt(...c.target);
  const f = box.height / a.theta;
  const [W, H] = [canvas.width, canvas.height];
  const cx = box.left - canvas.left + a.pivot[0] * box.width;
  const cy = box.top - canvas.top + a.pivot[1] * box.height;
  const [fullW, fullH] = [2 * Math.max(cx, W - cx), 2 * Math.max(cy, H - cy)];
  cam.aspect = fullW / fullH;
  cam.fov = (2 * Math.atan(fullH / 2 / f) * 180) / Math.PI;
  cam.setViewOffset(fullW, fullH, fullW / 2 - cx, fullH / 2 - cy, W, H);
  return stateOf(cam);
}

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

/** Between two camera states: position and projection lerped, rotation slerped; exact at 0 and 1. */
export function blendCam(a: CamState, b: CamState, k: number): CamState {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const lerp = (x: number, y: number) => x + (y - x) * k;
  qa.fromArray(a.quaternion).slerp(qb.fromArray(b.quaternion), k);
  return {
    position: a.position.map((v, i) => lerp(v, b.position[i]!)) as CamState['position'],
    quaternion: qa.toArray() as CamState['quaternion'],
    projection: a.projection.map((v, i) => lerp(v, b.projection[i]!)),
  };
}

/**
 * The live camera from the seat and the lean-ins on their way, folded in order (the one closing
 * first, then the one opening), so going from one lean-in to another passes near the seat.
 */
export function leanCamera(seat: CamState, leans: { state: CamState; k: number }[]): CamState {
  return leans.reduce((cam, l) => blendCam(cam, l.state, l.k), seat);
}
