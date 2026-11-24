import seat from '@/content/scene/bounds-seat.json';
import type { Lamp, Render, Time } from '@/lib/light';
import type { Condition, Sky } from '@/lib/weather/types';

type RGB = [number, number, number];

/** How the room's light sits over the render on show (Tier 1 CSS layers, Tier 2 uniforms). */
export type Light = {
  /** The weather's tint on daylight: a colour multiplied in at strength k (0–1). */
  tint: { rgb: RGB; k: number };
  /** Moonlight over the day render at night (lamp off): a deep blue multiplied in, 0–1. */
  moonK: number;
  /** The lamp's warm pool over the day render (lamp on by day), 0–1. */
  poolK: number;
};

/** Each weather's tint on daylight, and its strength in full day. */
const TINTS: Record<Condition, { rgb: RGB; k: number }> = {
  clear: { rgb: [255, 238, 214], k: 0.55 },
  partly: { rgb: [246, 240, 230], k: 0.45 },
  overcast: { rgb: [204, 212, 224], k: 0.75 },
  fog: { rgb: [214, 220, 228], k: 0.7 },
  rain: { rgb: [188, 198, 214], k: 0.85 },
  snow: { rgb: [210, 218, 234], k: 0.75 },
  storm: { rgb: [160, 170, 192], k: 1 },
};

export type Box = { x0: number; y0: number; x1: number; y1: number };
const O = seat.objects as Record<string, Box>;
const laptop = (seat as unknown as { decor: Record<string, Box> }).decor.deco_laptop!;

/**
 * The screens keep their own light, in master fractions: the monitor's two halves (their hotspots
 * are the screen) and the laptop's screen (the lid's upper half, inset from its edges). The
 * phone's screen is dark.
 */
export const SCREENS: Box[] = [
  O.obj_monitor!,
  O.obj_cv!,
  {
    x0: laptop.x0 + (laptop.x1 - laptop.x0) * 0.08,
    x1: laptop.x1 - (laptop.x1 - laptop.x0) * 0.04,
    y0: laptop.y0,
    y1: laptop.y0 + (laptop.y1 - laptop.y0) * 0.48,
  },
];

/** Moonlight, multiplied over the day render. */
export const MOON_RGB: RGB = [74, 90, 148];
/**
 * The lamp's pool on the desk, where the lamp render lights it most (the mat before the keyboard):
 * its colour, its centre and its radii, in master fractions.
 */
export const POOL: { rgb: RGB; at: [number, number]; r: [number, number] } = {
  rgb: [255, 206, 150],
  at: [0.47, 0.84],
  r: [0.2, 0.32],
};
/** Master x where the window side's tint is full, and where it has fallen to its far share. */
export const WINDOW_SIDE = { from: 0.9, to: 0.35 };
export const TINT_FAR_SHARE = 0.4;
/** Weather and time changes fade this long; the lamp's own changes follow its 0.6 s cross-fade. */
export const LIGHT_FADE_MS = 2000;

/**
 * The room's light for the sky (null until the weather is known: no tint yet, and day or night by
 * the clock), the render on show and the lamp.
 */
export function lightFor(sky: Sky | null, render: Render, lamp: Lamp, time: Time): Light {
  const day = sky ? sky.dayness : time === 'night' ? 0 : 1;
  const t = sky ? TINTS[sky.condition] : TINTS.clear;
  const onDay = render === 'day';
  return {
    tint: { rgb: [...t.rgb], k: sky ? t.k * day : 0 },
    moonK: onDay ? 1 - day : 0,
    poolK: onDay && lamp === 'on' ? 1 : 0,
  };
}
