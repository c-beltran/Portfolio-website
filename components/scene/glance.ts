import { useEffect, useRef } from 'react';

/**
 * Your head follows the cursor (design 2026-11-19 §3.1): the live seat turns a few degrees towards
 * the pointer, eased and damped, and back to centre when the pointer leaves. Tier 2 only.
 */
export type Vec3 = [number, number, number];
export type Glance = { yaw: number; pitch: number };

/** ±3° yaw (positive looks right) and ±2° pitch (positive looks up), radians. */
export const LIMITS = { yaw: (3 * Math.PI) / 180, pitch: (2 * Math.PI) / 180 };
/** The damping time constant, seconds. */
export const TAU = 0.25;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v: Vec3) => Math.hypot(...v);
const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Rodrigues: v turned by angle a about the unit axis k. */
function rotate(v: Vec3, k: Vec3, a: number): Vec3 {
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const kv = cross(k, v);
  const d = dot(k, v) * (1 - c);
  return [
    v[0] * c + kv[0] * s + k[0] * d,
    v[1] * c + kv[1] * s + k[1] * d,
    v[2] * c + kv[2] * s + k[2] * d,
  ];
}

/** The look-at point turned by the glance, at the same distance from the eye (three.js, Y up). */
export function glanceTarget(eye: Vec3, target: Vec3, yaw: number, pitch: number): Vec3 {
  if (yaw === 0 && pitch === 0) return target;
  const d = sub(target, eye);
  let v = rotate(d, [0, 1, 0], -yaw); // about world up; positive yaw turns right (towards +x)
  const right = cross(v, [0, 1, 0]);
  v = rotate(v, scale(right, 1 / len(right)), pitch);
  return [eye[0] + v[0], eye[1] + v[1], eye[2] + v[2]];
}

/** The screen shift of the DOM overlays for a glance: the scene moves against the turn. */
export function glanceShift(yaw: number, pitch: number, focalPx: number): [number, number] {
  return [-focalPx * Math.tan(yaw) || 0, focalPx * Math.tan(pitch) || 0];
}

/** One step of the damping towards the goal (exponential, never overshoots). */
export const damp = (current: number, goal: number, dt: number) =>
  goal + (current - goal) * Math.exp(-dt / TAU);

const clamp1 = (x: number) => Math.max(-1, Math.min(1, x));

/**
 * The damped glance from the mouse or pen (never touch), or on Android from the device's tilt
 * (where it needs no permission prompt: ±15° from the first reading is full). Calls onChange every
 * animation frame while it moves, and not at all with reduced motion.
 */
export function useGlance(onChange: (g: Glance) => void) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cur: Glance = { yaw: 0, pitch: 0 };
    const goal: Glance = { yaw: 0, pitch: 0 };
    let id = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      cur.yaw = damp(cur.yaw, goal.yaw, dt);
      cur.pitch = damp(cur.pitch, goal.pitch, dt);
      const done = Math.abs(cur.yaw - goal.yaw) < 1e-5 && Math.abs(cur.pitch - goal.pitch) < 1e-5;
      if (done) Object.assign(cur, goal);
      cb.current({ ...cur });
      id = done ? 0 : requestAnimationFrame(tick);
      if (done) last = 0;
    };
    const aim = (x: number, y: number) => {
      goal.yaw = clamp1(x) * LIMITS.yaw;
      goal.pitch = clamp1(y) * LIMITS.pitch;
      if (!id) id = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      aim((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2);
    };
    const onLeave = () => aim(0, 0);
    let base: [number, number] | null = null;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      base ??= [e.beta, e.gamma];
      aim((e.gamma - base[1]) / 15, -(e.beta - base[0]) / 15);
    };
    const tilt =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown })
        .requestPermission !== 'function';
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    if (tilt) window.addEventListener('deviceorientation', onTilt);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      if (tilt) window.removeEventListener('deviceorientation', onTilt);
    };
  }, []);
}
