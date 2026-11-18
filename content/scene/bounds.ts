// Hotspot bounds for the Tier 1 still: each interactive object's projected box from the overview
// camera, normalized 0–1 with y down (written by scripts/scene/export_bounds.py).

export type Box = { x0: number; y0: number; x1: number; y1: number };

export type SceneBounds = {
  camera: string;
  /** Still height / width. */
  aspect: number;
  objects: Record<string, Box>;
  /** Narrowest desk width (px) at which no two 44 px hotspots overlap; null if none does. */
  minCollisionFreeWidth: number | null;
};

/** WCAG 2.5.5 target size: every hotspot is at least this many CSS px on each side. */
export const MIN_TARGET = 44;
/** Widest desk the search considers (px). */
export const MAX_WIDTH = 4000;

function grow(lo: number, hi: number): [number, number] {
  const pad = Math.max(0, MIN_TARGET - (hi - lo)) / 2;
  return [lo - pad, hi + pad];
}

/** The object's hotspot in px on a desk `width` px wide: its box, grown to at least 44×44. */
export function hotspot(b: Box, width: number, aspect: number): Box {
  const height = width * aspect;
  const [x0, x1] = grow(b.x0 * width, b.x1 * width);
  const [y0, y1] = grow(b.y0 * height, b.y1 * height);
  return { x0, y0, x1, y1 };
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Pairs of objects whose hotspots overlap on a desk `width` px wide, in key order. */
export function collidingPairs(
  boxes: Record<string, Box>,
  width: number,
  aspect: number,
): [string, string][] {
  const keys = Object.keys(boxes).sort();
  const spots = keys.map((k) => hotspot(boxes[k]!, width, aspect));
  const pairs: [string, string][] = [];
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++)
      if (overlaps(spots[i]!, spots[j]!)) pairs.push([keys[i]!, keys[j]!]);
  return pairs;
}

/** The narrowest width from which every wider desk (up to MAX_WIDTH) is collision-free. */
export function minCollisionFreeWidth(boxes: Record<string, Box>, aspect: number): number | null {
  let free: number | null = null;
  for (let w = MAX_WIDTH; w >= 1; w--) {
    if (collidingPairs(boxes, w, aspect).length > 0) break;
    free = w;
  }
  return free;
}
