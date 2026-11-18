// The scene's cameras (written by scripts/scene/export_cameras.py from workspace.blend), in three.js
// axes (Y up, metres). The live scene and the Cycles clips both frame from these.
import data from './cameras.json';

export type Vec3 = [number, number, number];

export type SceneCamera = {
  eye: Vec3;
  target: Vec3;
  /** Focal length, mm. */
  lens: number;
  /** Horizontal sensor width, mm (Blender's horizontal sensor fit). */
  sensorWidth: number;
  /** Lens shift as a fraction of the frame's larger side. */
  shift: [number, number];
};

export const CAMERAS = data as Record<'overview' | 'phone' | 'monitor', SceneCamera>;

/** three.js PerspectiveCamera.fov (vertical, degrees) for a frame of this width / height. */
export function verticalFov(cam: SceneCamera, aspect: number): number {
  const sensorHeight = cam.sensorWidth / aspect;
  return (2 * Math.atan(sensorHeight / 2 / cam.lens) * 180) / Math.PI;
}
