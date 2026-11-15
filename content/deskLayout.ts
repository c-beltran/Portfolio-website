import type { DeskObject } from './objects';

/**
 * Where everything sits on the still desk (spec §3.1, §6). Two layouts, both written into CSS
 * custom properties at build time; a media query picks one, so no script ever reads the viewport.
 * In M4 the same boxes hold cut-outs from the baked render.
 */
export type DeskItemId = DeskObject['id'] | 'lamp' | 'mug';
export type LayoutName = 'wide' | 'phone';
/** Percent of the desk's width (x, w) and height (y, h); rot in degrees. */
export type Box = { x: number; y: number; w: number; h: number; rot: number };

/** Desk width / height. Wide is the mock's 16:10.5; phone is a portrait crop. */
export const DESK_ASPECT: Record<LayoutName, number> = { wide: 16 / 10.5, phone: 3 / 4 };

/**
 * The desk's inner width in px at the narrowest viewport each layout renders at.
 * wide (landscape, and everything from 720px): a 568×320 landscape phone, where globals.css caps the
 *   desk at (60dvh − 28px) × 3.05 so the tallest object fits above the sheet: (192 − 28) × 3.05 ≈ 500.
 * phone (portrait under 720px): 320 − 2×16 page gutter − 2×8 mat = 272.
 */
export const MIN_RENDER_WIDTH: Record<LayoutName, number> = { wide: 500, phone: 272 };

/** Each item's art, width / height in px. Box heights derive from it, so art never stretches. */
export const ART_ASPECT: Record<DeskItemId, number> = {
  badge: 0.6,
  laptop: 1.15,
  gauge: 100 / 130,
  phone: 9 / 19,
  photo: 0.85,
  note: 1,
  card: 1.75,
  lamp: 0.8,
  mug: 1,
};

type Place = { x: number; y: number; w: number; rot: number };

const PLACES: Record<LayoutName, Record<DeskItemId, Place>> = {
  // From the mock (x, y, w, rot). The laptop narrows from 40 to 36 to make room for the lamp.
  wide: {
    badge: { x: 4, y: 13, w: 15, rot: -8 },
    laptop: { x: 25, y: 9, w: 36, rot: -1.5 },
    lamp: { x: 62, y: 6, w: 9, rot: 0 },
    gauge: { x: 72, y: 5, w: 21, rot: 4 },
    phone: { x: 82, y: 56, w: 10, rot: 12 },
    photo: { x: 5, y: 60, w: 14, rot: 6 },
    note: { x: 27, y: 69, w: 14, rot: -5 },
    card: { x: 50, y: 74, w: 19, rot: 3 },
    mug: { x: 70, y: 78, w: 10, rot: 0 },
  },
  // Portrait rearrangement, three rows, every target at least 44px at a 320px viewport (272px desk).
  phone: {
    badge: { x: 3, y: 3, w: 18, rot: -8 },
    laptop: { x: 26, y: 4, w: 46, rot: -1.5 },
    lamp: { x: 78, y: 3, w: 17, rot: 0 },
    gauge: { x: 4, y: 38, w: 24, rot: 4 },
    photo: { x: 35, y: 41, w: 19, rot: 6 },
    phone: { x: 61, y: 37, w: 17, rot: 12 },
    mug: { x: 83, y: 44, w: 13, rot: 0 },
    note: { x: 6, y: 72, w: 18, rot: -5 },
    card: { x: 34, y: 74, w: 30, rot: 3 },
  },
};

function toBoxes(layout: LayoutName): Record<DeskItemId, Box> {
  const entries = Object.entries(PLACES[layout]).map(([id, p]) => {
    const h = Number(((p.w * DESK_ASPECT[layout]) / ART_ASPECT[id as DeskItemId]).toFixed(3));
    return [id, { ...p, h }] as const;
  });
  return Object.fromEntries(entries) as Record<DeskItemId, Box>;
}

export const LAYOUT: Record<LayoutName, Record<DeskItemId, Box>> = {
  wide: toBoxes('wide'),
  phone: toBoxes('phone'),
};

/** The clickable items: the seven section objects plus the lamp. The mug is decoration. */
export const INTERACTIVE: readonly DeskItemId[] = [
  'photo',
  'badge',
  'laptop',
  'gauge',
  'phone',
  'note',
  'card',
  'lamp',
];

const pct = (n: number) => `${n.toFixed(3)}%`;

function vars(b: Box, prefix: '' | 'p-') {
  // Translate percentages refer to the element's own size, so x / w * 100% lands it at x% of the desk.
  return {
    [`--${prefix}w`]: `${b.w}%`,
    [`--${prefix}h`]: `${b.h}%`,
    [`--${prefix}tx`]: pct((b.x / b.w) * 100),
    [`--${prefix}ty`]: pct((b.y / b.h) * 100),
    [`--${prefix}rot`]: `${b.rot}deg`,
  };
}

/** CSS custom properties for both layouts; globals.css turns them into width, height and transform. */
export function hotspotVars(id: DeskItemId): Record<`--${string}`, string> {
  return { ...vars(LAYOUT.wide[id], ''), ...vars(LAYOUT.phone[id], 'p-') };
}
