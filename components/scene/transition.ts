import type { SceneCamera } from '@/content/scene/cameras';

/** The move every moment makes, in both tiers and in the Cycles clips. */
export const MOVE_MS = 900;
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export const hfov = (c: SceneCamera) => 2 * Math.atan(c.sensorWidth / 2 / c.lens);
