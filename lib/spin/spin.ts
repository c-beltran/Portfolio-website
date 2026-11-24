import * as THREE from 'three';

/** The objects a visitor can pick up and spin once they have come forward. */
export const SPIN_IDS = ['car', 'ball', 'mug'] as const;
export type SpinId = (typeof SPIN_IDS)[number];
export const isSpin = (id: string): id is SpinId => (SPIN_IDS as readonly string[]).includes(id);

/**
 * A fidget spin: drags turn the object about the screen's axes (horizontal drag about the vertical
 * axis, vertical drag about the horizontal one), a flick keeps it turning until it slows to rest,
 * the arrow keys turn it in steps, and reset eases it home. Free rotation, as a quaternion.
 */
export type Spin = {
  /** The turn applied to the object, in screen axes (x right, y up, z towards the eye). */
  readonly q: THREE.Quaternion;
  drag(dxPx: number, dyPx: number): void;
  release(vxPxPerMs: number, vyPxPerMs: number): void;
  nudge(axis: 'x' | 'y', deg: number): void;
  reset(instant?: boolean): void;
  /** Advances momentum or the reset; true while it is still moving. */
  step(dtMs: number): boolean;
  readonly atRest: boolean;
};

/** How fast a flick fades: a firm one (2 px/ms) is at rest about 1.5 s later. */
const DECAY_MS = 320;
/** Below this (rad/ms) the spin has stopped. */
const STILL = 1e-4;
const RESET_MS = 500;

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);

export function createSpin(o: { reducedMotion: boolean; pxPerRad?: number }): Spin {
  const pxPerRad = o.pxPerRad ?? 180;
  const q = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  // angular velocity, rad/ms, about screen y (from horizontal motion) and x (from vertical)
  let vy = 0;
  let vx = 0;
  let resetFrom: THREE.Quaternion | null = null;
  let resetT = 0;

  /** Pre-multiplied: the turn is in screen axes, whatever the object's own orientation. */
  const rotate = (ry: number, rx: number) => {
    if (ry) q.premultiply(turn.setFromAxisAngle(Y, ry));
    if (rx) q.premultiply(turn.setFromAxisAngle(X, rx));
    q.normalize();
  };

  return {
    q,
    drag(dx, dy) {
      resetFrom = null;
      vx = vy = 0;
      rotate(dx / pxPerRad, dy / pxPerRad);
    },
    release(vxPx, vyPx) {
      if (o.reducedMotion) return;
      vy = vxPx / pxPerRad;
      vx = vyPx / pxPerRad;
    },
    nudge(axis, deg) {
      resetFrom = null;
      vx = vy = 0;
      const r = (deg * Math.PI) / 180;
      if (axis === 'y') rotate(r, 0);
      else rotate(0, r);
    },
    reset(instant = false) {
      vx = vy = 0;
      if (instant || o.reducedMotion) {
        q.identity();
        resetFrom = null;
        return;
      }
      resetFrom = q.clone();
      resetT = 0;
    },
    step(dt) {
      if (resetFrom) {
        resetT = Math.min(1, resetT + dt / RESET_MS);
        const k = 1 - (1 - resetT) ** 3;
        q.slerpQuaternions(resetFrom, new THREE.Quaternion(), k);
        if (resetT >= 1) {
          q.identity();
          resetFrom = null;
        }
        return true;
      }
      if (Math.hypot(vx, vy) < STILL) {
        vx = vy = 0;
        return false;
      }
      rotate(vy * dt, vx * dt);
      const f = Math.exp(-dt / DECAY_MS);
      vx *= f;
      vy *= f;
      return true;
    },
    get atRest() {
      return !resetFrom && Math.hypot(vx, vy) < STILL;
    },
  };
}
