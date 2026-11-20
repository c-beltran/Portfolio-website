/**
 * The seat framing (design 2026-11-19 §3.2), shared by the site and Blender (scripts/scene/framing.py
 * reads the same framing.json). The seat camera renders a "master" frame around a "safe frame",
 * the part that must always show.
 *
 * - Wide windows (above range[0], 6:5) fit the safe frame inside them (contain) and the master fills
 *   the rest. Beyond 32:9 the master covers the window instead, so there is never a gap.
 * - Portrait windows (6:5 and narrower, option C) show the safe frame at full height and pan
 *   sideways across it: pan −1 is its left edge, +1 its right edge.
 *
 * Units: sizes are in safe-frame heights; rects are normalised to the master, y down.
 */
import data from './framing.json' with { type: 'json' };

export type Rect = { x0: number; y0: number; x1: number; y1: number };

export function ratio(s: string): number {
  const [a, b] = s.split('/').map(Number);
  return a! / (b ?? 1);
}

const S = ratio(data.safeAspect);
const [LO, HI] = data.range.map(ratio) as [number, number];

/** Portrait windows, which pan: up to 6:5 wide. */
export const PORTRAIT = `(max-aspect-ratio: ${data.range[0]})`;

export const isPortrait = (aspect: number) => aspect <= LO;

/** The master's size (safe heights) and where its safe frame sits: bottom edge, centred. */
export function master(): { w: number; h: number; safe: Rect } {
  const w = Math.max(HI, S);
  const h = Math.max(1, S / LO);
  return { w, h, safe: { x0: (w - S) / 2 / w, y0: 1 - 1 / h, x1: (w + S) / 2 / w, y1: 1 } };
}

/**
 * A wide window of aspect a: pixels per safe height for a window 1 unit tall is the safe frame
 * contained, but never less than covering the master's width or height (framingCss's --u).
 */
function wide(a: number): Rect {
  const { w, h } = master();
  const k = Math.max(Math.min(a / S, 1), a / w, 1 / h);
  const [vw, vh] = [a / k, 1 / k];
  return { x0: (w - vw) / 2 / w, y0: 1 - vh / h, x1: (w + vw) / 2 / w, y1: 1 };
}

/** The region a portrait window pans across: the safe frame. */
export const portraitStrip = (): Rect => master().safe;

/** The master region a window of this aspect shows. pan (−1…1) applies to portrait windows only. */
export function visible(a: number, pan = 0): Rect {
  if (!isPortrait(a)) return wide(a);
  const { w, safe } = master();
  const p = Math.max(-1, Math.min(1, pan));
  const cx = 0.5 + (p * Math.max(0, S - a)) / 2 / w;
  return { x0: cx - a / 2 / w, y0: safe.y0, x1: cx + a / 2 / w, y1: 1 };
}

const union = (a: Rect, b: Rect): Rect => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
});

/** Wide band i (between bands[i] and bands[i + 1]): everything a window in it can show. */
export function band(i: number): Rect {
  const b = data.bands.map(ratio);
  if (i < 0 || i >= b.length - 1) throw new Error(`no band ${i}`);
  // wide() changes monotonically with the aspect, so the two ends bound the band.
  return union(wide(b[i]!), wide(b[i + 1]!));
}

export const bandCount = () => data.bands.length - 1;

/** The wide band a window of this aspect loads (bandMedia's queries), the last one beyond it. */
export function bandFor(aspect: number): number {
  const b = data.bands.map(ratio);
  let i = 0;
  for (let k = 1; k < b.length - 1; k++) if (aspect >= b[k]!) i = k;
  return i;
}

/** A band's own media query; the first band is the default for every wide window. */
export function bandMedia(i: number): string {
  return i === 0 ? '' : `(min-aspect-ratio: ${data.bands[i]})`;
}

/** three's setViewOffset(fullW, fullH, x, y, layerW, layerH): the master, with the window on it. */
export function viewOffset(aspect: number, layerW: number, layerH: number, pan = 0) {
  const { w, h } = master();
  const v = visible(aspect, pan);
  const px = layerH / ((v.y1 - v.y0) * h); // pixels per safe height
  const fullW = w * px;
  const fullH = h * px;
  return { fullW, fullH, x: v.x0 * fullW, y: v.y0 * fullH };
}
