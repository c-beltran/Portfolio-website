import type { DeskObject } from './objects';
import type { SceneBounds } from './scene/bounds';
import wideBounds from './scene/bounds.json' with { type: 'json' };
import phoneBounds from './scene/bounds-phone.json' with { type: 'json' };

/**
 * Where everything sits on the Tier 1 still (spec §3.1, §6): each object's box is its 3D model's
 * projected bounds (scripts/scene/export_bounds.py), so the still and the live scene line up.
 * Two layouts, both written into CSS custom properties at build time; a media query picks one, so
 * no script ever reads the viewport.
 */
export type DeskItemId = DeskObject['id'] | 'lightbar';
export type LayoutName = 'wide' | 'phone';
/** Percent of the desk's width (x, w) and height (y, h). */
export type Box = { x: number; y: number; w: number; h: number };

const BOUNDS: Record<LayoutName, SceneBounds> = {
  wide: wideBounds as SceneBounds,
  phone: phoneBounds as SceneBounds,
};

/** The site's portrait phone layout: the phone camera's square framing (still and live). */
export const PORTRAIT = '(max-width: 719px) and (orientation: portrait)';

/** Desk width / height: the stills' (2560×1440 overview, 1080×1080 phone camera). */
export const DESK_ASPECT: Record<LayoutName, number> = { wide: 16 / 9, phone: 1 };

/**
 * The desk's inner width in px at the narrowest viewport each layout renders at.
 * wide (landscape, and everything from 720px): a 568×320 landscape phone, where globals.css caps
 *   the desk so it fits above the sheet, but never below 500px.
 * phone (portrait under 720px): 320 − 2×16 page gutter − 2×8 mat = 272.
 */
export const MIN_RENDER_WIDTH: Record<LayoutName, number> = { wide: 500, phone: 272 };

/** The clickable items: the seven section objects plus the light bar (the lamp toggle). */
export const INTERACTIVE: readonly DeskItemId[] = [
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
 * smaller, nearer object on top. Light bar over monitor; badge over kit case; on the phone camera,
 * kit case and photo over the monitor.
 */
export const HOTSPOT_STACK: Record<DeskItemId, number> = {
  monitor: 1,
  kit: 2,
  photo: 2,
  phone: 2,
  notepad: 2,
  card: 2,
  badge: 3,
  lightbar: 3,
};

function toBoxes(layout: LayoutName): Record<DeskItemId, Box> {
  const entries = INTERACTIVE.map((id) => {
    const b = BOUNDS[layout].objects[`obj_${id}`];
    if (!b) throw new Error(`no projected box for ${id} (${layout})`);
    const pct = (n: number) => Number((n * 100).toFixed(3));
    return [id, { x: pct(b.x0), y: pct(b.y0), w: pct(b.x1 - b.x0), h: pct(b.y1 - b.y0) }] as const;
  });
  return Object.fromEntries(entries) as Record<DeskItemId, Box>;
}

export const LAYOUT: Record<LayoutName, Record<DeskItemId, Box>> = {
  wide: toBoxes('wide'),
  phone: toBoxes('phone'),
};

const num = (n: number) => n.toFixed(3);

function vars(b: Box, prefix: '' | 'p-') {
  return {
    [`--${prefix}cx`]: num(b.x + b.w / 2),
    [`--${prefix}cy`]: num(b.y + b.h / 2),
    [`--${prefix}w`]: num(b.w),
    [`--${prefix}h`]: num(b.h),
  };
}

/**
 * CSS custom properties for both layouts (unitless percents); globals.css turns them into size and
 * a centring transform, grown to the 44px minimum around the centre.
 */
export function hotspotVars(id: DeskItemId): Record<`--${string}`, string> {
  return {
    ...vars(LAYOUT.wide[id], ''),
    ...vars(LAYOUT.phone[id], 'p-'),
    '--z': String(HOTSPOT_STACK[id]),
  };
}
