/** The objects a visitor can pick up and spin once they have come forward. */
export const SPIN_IDS = ['car', 'ball', 'mug'] as const;
export type SpinId = (typeof SPIN_IDS)[number];
export const isSpin = (id: string): id is SpinId => (SPIN_IDS as readonly string[]).includes(id);

/**
 * A fidget spin: drags turn the object about the screen's axes (horizontal drag about the vertical
 * axis, vertical drag about the horizontal one), a flick keeps it turning until it slows to rest,
 * the arrow keys turn it in steps, and reset eases it home. Free rotation, as a quaternion.
 */
/** A unit quaternion, [x, y, z, w] (three.js's order). */
export type Quat = [number, number, number, number];

export type Spin = {
  /**
   * The turn applied to the object, in screen axes (x right, y up, z towards the eye). Kept free of
   * three.js: this runs in the page before anything is grabbed, and three loads only on the grab.
   */
  readonly q: Readonly<Quat>;
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

/** a · b */
function mul(a: Readonly<Quat>, b: Readonly<Quat>): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function normalize(q: Quat): Quat {
  const n = Math.hypot(...q) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Along the shorter arc from a to b. */
function slerp(a: Readonly<Quat>, b: Readonly<Quat>, t: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  if (d > 0.9995) return normalize(a.map((v, i) => v + (s * b[i]! - v) * t) as Quat);
  const th = Math.acos(d);
  const ka = Math.sin((1 - t) * th) / Math.sin(th);
  const kb = (s * Math.sin(t * th)) / Math.sin(th);
  return normalize(a.map((v, i) => v * ka + b[i]! * kb) as Quat);
}

const IDENTITY: Readonly<Quat> = [0, 0, 0, 1];

export function createSpin(o: { reducedMotion: boolean; pxPerRad?: number }): Spin {
  const pxPerRad = o.pxPerRad ?? 180;
  const q: Quat = [0, 0, 0, 1];
  const set = (v: Readonly<Quat>) => {
    q[0] = v[0];
    q[1] = v[1];
    q[2] = v[2];
    q[3] = v[3];
  };
  // angular velocity, rad/ms, about screen y (from horizontal motion) and x (from vertical)
  let vy = 0;
  let vx = 0;
  let resetFrom: Quat | null = null;
  let resetT = 0;

  /** Pre-multiplied: the turn is in screen axes, whatever the object's own orientation. */
  const rotate = (ry: number, rx: number) => {
    let r = [...q] as Quat;
    if (ry) r = mul([0, Math.sin(ry / 2), 0, Math.cos(ry / 2)], r);
    if (rx) r = mul([Math.sin(rx / 2), 0, 0, Math.cos(rx / 2)], r);
    set(normalize(r));
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
        set(IDENTITY);
        resetFrom = null;
        return;
      }
      resetFrom = [...q] as Quat;
      resetT = 0;
    },
    step(dt) {
      if (resetFrom) {
        resetT = Math.min(1, resetT + dt / RESET_MS);
        const k = 1 - (1 - resetT) ** 3;
        set(slerp(resetFrom, IDENTITY, k));
        if (resetT >= 1) {
          set(IDENTITY);
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
