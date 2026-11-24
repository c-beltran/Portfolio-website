import { DESK_OBJECTS, type DeskObject } from './objects';
import type { SceneBounds } from './scene/bounds';
import seatBounds from './scene/bounds-seat.json' with { type: 'json' };

/**
 * Where everything sits on the seat's master: each object's box is its 3D
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

/** The clickable items: the section objects (the monitor is two) plus the light bar. */
export const INTERACTIVE: readonly DeskItemId[] = [
  'cv',
  'photo',
  'badge',
  'monitor',
  'kit',
  'phone',
  'notepad',
  'card',
  // the room
  'car',
  'ball',
  'board',
  'mug',
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
  // the model car stands in front of the photo's foot
  car: 3,
  ball: 2,
  board: 1,
  mug: 2,
};

/** Seen only in ultrawide windows: the ball lies by the left wall. */
export const ULTRAWIDE_ONLY: readonly DeskItemId[] = ['ball'];
/**
 * Two window aspects for the ball (bounds.test checks both against its projected box): from PEEK
 * enough of it shows to light and name (about a tenth); from MIN it is wholly in view.
 */
export const ULTRAWIDE_PEEK = [11, 5] as const;
export const ULTRAWIDE_MIN = [13, 5] as const;

/**
 * The hotspot is never hidden: it is the ball's own box, clipped by the window, so whatever shows
 * of the ball can be clicked, in both tiers.
 * The glow and label spill past the ball, so they wait for PEEK. Between PEEK and MIN
 * the label sits beside the ball, where the window can't cut it, and the target reaches a further
 * 44px into the window for a finger. Generated, so it works without JavaScript.
 */
export function ultrawideOnlyCss(): string {
  const each = (part: (id: DeskItemId) => string) => ULTRAWIDE_ONLY.map(part).join(',\n  ');
  const [peek, min] = [ULTRAWIDE_PEEK.join('/'), ULTRAWIDE_MIN.join('/')];
  return `@media not all and (min-aspect-ratio: ${peek}) {
  ${each((id) => `.hotspot[data-item='${id}'] .sticker`)},
  ${each((id) => `.desk-glow[data-item='${id}']`)} {
    display: none;
  }
}
@media (min-aspect-ratio: ${peek}) and (max-aspect-ratio: ${min}) {
  ${each((id) => `.hotspot[data-item='${id}'] .sticker`)} {
    left: 100%;
    transform: rotate(-2deg);
  }
  ${each((id) => `.hotspot[data-item='${id}'][data-slug][aria-pressed='true'] .sticker`)} {
    transform: translateY(-3px) rotate(-2deg);
  }
  ${each((id) => `.hotspot[data-item='${id}']::after`)} {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 100%;
    width: 44px;
  }
}`;
}

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

/**
 * Labels for the keyboard: an object's tape label shows while its Sections button has
 * focus, under the same rule that shows the Sections card (not after a pointer or touch).
 * Generated from the objects, so it works without JavaScript.
 */
export function labelFocusCss(): string {
  const on = ":root:not([data-input='pointer'])";
  const rules = DESK_OBJECTS.flatMap((o) => {
    const focus = `${on} .desk:has(.drawer__button[data-slug='${o.slug}']:focus)`;
    // its label, and its glow
    return [
      `${focus} .hotspot[data-slug='${o.slug}'] .sticker`,
      `${focus} .desk-glow[data-item='${o.id}']`,
    ];
  });
  const lamp = `${on} .desk:has(.drawer__button--lamp:focus)`;
  rules.push(
    `${lamp} .hotspot[data-item='lightbar'] .sticker`,
    `${lamp} .desk-glow[data-item='lightbar']`,
  );
  return `${rules.join(',\n')} {\n  opacity: 1;\n}`;
}
