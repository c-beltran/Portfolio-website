import type { DeskObject } from './objects';
import type { SceneBounds } from './scene/bounds';
import seatBounds from './scene/bounds-seat.json' with { type: 'json' };

/**
 * Where everything sits on the seat's master (design 2026-11-19 §3.2): each object's box is its 3D
 * model's projected bounds from cam_seat (scripts/scene/export_bounds.py), so the still and the
 * live scene line up. One layout for every window shape: the framing CSS (content/scene/framingCss)
 * places the master, and the hotspots sit on it in master percents.
 */
export type DeskItemId = DeskObject['id'] | 'lightbar';
/** Percent of the master's width (x, w) and height (y, h). */
export type Box = { x: number; y: number; w: number; h: number };

const BOUNDS = seatBounds as SceneBounds;

/** Portrait windows, which pan across the safe frame (framing.ts). */
export { PORTRAIT } from './scene/framing';

/** The clickable items: the eight section objects (the monitor is two) plus the light bar. */
export const INTERACTIVE: readonly DeskItemId[] = [
  'cv',
  'photo',
  'badge',
  'monitor',
  'kit',
  'phone',
  'notepad',
  'card',
  'lightbar',
];

/**
 * z-order where 44px targets overlap (content/scene/bounds.test.ts lists the overlaps): the
 * smaller, nearer object on top. Light bar over both screen halves; the photo frame, which stands
 * in front of the screen's corner, over the CV half; badge over the kit case.
 */
export const HOTSPOT_STACK: Record<DeskItemId, number> = {
  monitor: 1,
  cv: 1,
  kit: 2,
  photo: 2,
  phone: 2,
  notepad: 2,
  card: 2,
  badge: 3,
  lightbar: 3,
};

function toBoxes(): Record<DeskItemId, Box> {
  const entries = INTERACTIVE.map((id) => {
    const b = BOUNDS.objects[`obj_${id}`];
    if (!b) throw new Error(`no projected box for ${id}`);
    const pct = (n: number) => Number((n * 100).toFixed(3));
    return [id, { x: pct(b.x0), y: pct(b.y0), w: pct(b.x1 - b.x0), h: pct(b.y1 - b.y0) }] as const;
  });
  return Object.fromEntries(entries) as Record<DeskItemId, Box>;
}

export const LAYOUT: Record<DeskItemId, Box> = toBoxes();

const num = (n: number) => n.toFixed(3);

/**
 * CSS custom properties (unitless percents of the master); globals.css turns them into size and a
 * centring transform, grown to the 44px minimum around the centre.
 */
export function hotspotVars(id: DeskItemId): Record<`--${string}`, string> {
  const b = LAYOUT[id];
  return {
    '--cx': num(b.x + b.w / 2),
    '--cy': num(b.y + b.h / 2),
    '--w': num(b.w),
    '--h': num(b.h),
    '--z': String(HOTSPOT_STACK[id]),
  };
}
