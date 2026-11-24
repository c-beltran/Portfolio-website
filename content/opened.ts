import { LAYOUT } from './deskLayout';
import { DESK_OBJECTS, type SectionSlug } from './objects';
import { wallPiece } from './wall';
import art from './scene/opened-art.json';
import { screenAffine, type Pt, type Region } from './scene/screenAffine';

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

/** The fixed things the view leans in to, square to their face: the two monitor halves, the board, the diploma. */
export const LEAN_IDS = ['monitor', 'cv', 'board', 'diploma'] as const;
export type LeanId = (typeof LEAN_IDS)[number];

/** Every clickable object either comes forward or is leaned in to: never a panel alone. */
export const OPENED_IDS = [...MOVER_IDS, ...LEAN_IDS] as const;
export type OpenedId = (typeof OPENED_IDS)[number];

export const isMover = (id: string): id is MoverId => (MOVER_IDS as readonly string[]).includes(id);
export const isLean = (id: string): id is LeanId => (LEAN_IDS as readonly string[]).includes(id);

/** How much of a lean-in's edge fades into the dimmed desk, on each side (globals.css). */
export const LEAN_FEATHER = 0.06;
/** The part of a lean-in's face that HTML is laid on: inside the feather. */
export const LEAN_REGION: Region = { s0: 0.03, t0: 0.04, s1: 0.97, t1: 0.96 };

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
  /** Movers only: the patch over the object's spot on the still, master-normalised, y down. */
  patch?: { x0: number; y0: number; x1: number; y1: number };
  patchWidths?: number[];
  /** The quad that HTML, or the clip, is laid on, normalised (0,0 top left): TL, TR, BR, BL. */
  screen?: [number, number][];
  /** The mug only: where its steam rises from, as fractions of the art (x, y) and its width (w). */
  steam?: { x: number; y: number; w: number };
};

const ART = art as unknown as Record<OpenedId, OpenedArt>;

const isOpened = (id: string): id is OpenedId => (OPENED_IDS as readonly string[]).includes(id);

/**
 * The object a section brings forward or leans in to, or null on the desk. `via` names a wall
 * piece that opened the section instead of its own object (the diploma, for the CV).
 */
export function openedFor(slug: SectionSlug | null, via?: string | null): OpenedId | null {
  const piece = wallPiece(via);
  if (piece && piece.opens === slug && isOpened(piece.id)) return piece.id;
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

/**
 * Where HTML (or the phone's clip) sits on an object's face: percents of the art box, plus the
 * unitless matrix that lays the box's top and left edges onto the face (an affine fit, near exact
 * because each face looks straight at the eye).
 */
export function faceBox(id: OpenedId): {
  left: string;
  top: string;
  width: string;
  height: string;
  transform: string;
} {
  const a = artOf(id);
  if (!a.screen) throw new Error(`${id} has no face`);
  const f = screenAffine(
    a.screen as Pt[],
    { w: a.aspect, h: 1 },
    // a lean-in's screen is the whole face it zooms to; the diploma's is already its paper
    isLean(id) && id !== 'diploma' ? LEAN_REGION : undefined,
  );
  // Art-height units → percents of the art box (its width is aspect × its height).
  return {
    left: `${(f.x / a.aspect) * 100}%`,
    top: `${f.y * 100}%`,
    width: `${(f.w / a.aspect) * 100}%`,
    height: `${f.h * 100}%`,
    transform: `matrix(${f.matrix.join(', ')}, 0, 0)`,
  };
}
