import { MOVE_MS } from './transition';

/**
 * Where an object is in its coming-forward moment: travel from its place
 * on the desk to the slot (0–1), and its clip (the lid opening, the phone turning; 0–1). Both are
 * linear in time; the caller eases the travel (easeOutCubic) when it poses the object.
 */
export type Moment = { travel: number; clip: number };

export const REST: Moment = { travel: 0, clip: 0 };
export const OUT: Moment = { travel: 1, clip: 1 };

/** A frame longer than this (a background tab, a stall) still advances only this much. */
const MAX_STEP_MS = 100;

/** Clamped to 0–1, and snapped there from within float noise, so a run of steps settles exactly. */
const EPS = 1e-9;
const clamp01 = (x: number) => (x < EPS ? 0 : x > 1 - EPS ? 1 : x);

/**
 * One step of the moment. Opening: the object travels for MOVE_MS (0.9 s), then its clip plays over
 * clipMs. Closing: travel and clip fold back together over MOVE_MS. Either way it moves on from
 * wherever it is, so a reversal mid-move never jumps.
 */
export function stepMoment(m: Moment, open: boolean, dtMs: number, clipMs: number): Moment {
  const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS);
  if (open) {
    const travel = clamp01(m.travel + dt / MOVE_MS);
    // The clip waits for the travel; any time left in this step after arriving goes to the clip.
    const over = m.travel + dt / MOVE_MS - 1;
    const spare = m.travel >= 1 ? dt : over > EPS ? over * MOVE_MS : 0;
    return { travel, clip: clamp01(m.clip + spare / clipMs) };
  }
  return { travel: clamp01(m.travel - dt / MOVE_MS), clip: clamp01(m.clip - dt / MOVE_MS) };
}
