import { LAYOUT } from './deskLayout';
import { DESK_OBJECTS, type SectionSlug } from './objects';
import art from './scene/opened-art.json';

/** The objects modeled and baked to come forward (scripts/scene/bake_logic.py MOVERS). */
export const MOVER_IDS = [
  'kit',
  'phone',
  'badge',
  'photo',
  'notepad',
  'card',
  'car',
  'ball',
  'mug',
] as const;
export type MoverId = (typeof MOVER_IDS)[number];

/**
 * The objects that come forward: the kit case and the phone so far. The rest open their
 * section's panel in place.
 */
export const OPENED_IDS = ['kit', 'phone'] as const;
export type OpenedId = (typeof OPENED_IDS)[number];

/** How far the desk dims while an object is out: CSS brightness() in Tier 1, the shader in Tier 2. */
export const DIM_LEVEL = 0.45;

export type OpenedArt = {
  /** Width over height of the cropped render. */
  aspect: number;
  /** The crop's height over the render's focal length: its angular size (Tier 2 sizes to it). */
  theta: number;
  widths: number[];
  /** Where the object's pivot falls in the art, 0–1 from the top left (the live object aims there). */
  pivot: [number, number];
  /** The patch over the object's spot on the still, master-normalised, y down. */
  patch: { x0: number; y0: number; x1: number; y1: number };
  patchWidths: number[];
  /** The phone's clip quad in the art, normalised (0,0 top left): TL, TR, BR, BL. */
  screen?: [number, number][];
};

const ART = art as unknown as Record<OpenedId, OpenedArt>;

const isOpened = (id: string): id is OpenedId => (OPENED_IDS as readonly string[]).includes(id);

/** The object a section brings forward, or null (most sections don't, yet). */
export function openedFor(slug: SectionSlug | null): OpenedId | null {
  const id = DESK_OBJECTS.find((o) => o.slug === slug)?.id;
  return id && isOpened(id) ? id : null;
}

/** An object comes out on the side of the window it already sits on. */
export function sideOf(id: OpenedId): 'left' | 'right' {
  const b = LAYOUT[id];
  return b.x + b.w / 2 < 50 ? 'left' : 'right';
}

export function artOf(id: OpenedId): OpenedArt {
  return ART[id];
}

export function artSrc(id: OpenedId, mode: 'day' | 'lamp', width: number, ext: 'avif' | 'webp') {
  return `/opened/${id}-${mode}-${width}.${ext}`;
}

export function patchSrc(id: OpenedId, mode: 'day' | 'lamp', width: number, ext: 'avif' | 'webp') {
  return `/opened/patch-${id}-${mode}-${width}.${ext}`;
}
