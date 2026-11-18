import { CAMERAS, type SceneCamera, type Vec3 } from '@/content/scene/cameras';

/** The camera move both the live scene and the Cycles clips use (scripts/scene/render_clip.py). */
export const MOVE_MS = 900;
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export type Framing = 'desktop' | 'phone';
export type View = 'overview' | 'monitor';

/** The resting camera for a view in a framing (the phone's overview is its own camera). */
export function cameraFor(view: View, framing: Framing): SceneCamera {
  return view === 'monitor'
    ? CAMERAS.monitor
    : framing === 'phone'
      ? CAMERAS.phone
      : CAMERAS.overview;
}

export const hfov = (c: SceneCamera) => 2 * Math.atan(c.sensorWidth / 2 / c.lens);

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
  lerp(a[2], b[2], k),
];

/** The camera pose k (0–1, already eased) of the way from a to b. */
export function blend(a: SceneCamera, b: SceneCamera, k: number) {
  return {
    eye: lerp3(a.eye, b.eye, k),
    target: lerp3(a.target, b.target, k),
    hfov: lerp(hfov(a), hfov(b), k),
    shift: [lerp(a.shift[0], b.shift[0], k), lerp(a.shift[1], b.shift[1], k)] as [number, number],
  };
}
