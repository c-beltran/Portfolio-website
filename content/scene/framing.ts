/**
 * The seat framing (design 2026-11-19 §3.2), shared by the site and Blender (scripts/scene/framing.py
 * reads the same framing.json). Each seat camera renders a "master" frame around a "safe frame",
 * the part that must always show. A window fits the safe frame inside it (contain) and the master
 * fills the rest. Outside a frame's aspect range the master covers the window instead, so there is
 * never a gap.
 *
 * Units: sizes are in safe-frame heights; rects are normalised to the master, y down.
 */
import data from './framing.json';

export type FrameName = keyof typeof data;
export type Rect = { x0: number; y0: number; x1: number; y1: number };

/** The portrait seat's media query: windows up to 6:5 wide. */
export const PORTRAIT = `(max-aspect-ratio: ${data.seatPhone.range[1]})`;

export function ratio(s: string): number {
  const [a, b] = s.split('/').map(Number);
  return a! / (b ?? 1);
}

const safeAspect = (f: FrameName) => ratio(data[f].safeAspect);
const range = (f: FrameName) => data[f].range.map(ratio) as [number, number];

/** The master's size (safe heights) and where its safe frame sits: bottom edge, centred. */
export function master(f: FrameName): { w: number; h: number; safe: Rect } {
  const s = safeAspect(f);
  const [lo, hi] = range(f);
  const w = Math.max(hi, s);
  const h = Math.max(1, s / lo);
  return { w, h, safe: { x0: (w - s) / 2 / w, y0: 1 - 1 / h, x1: (w + s) / 2 / w, y1: 1 } };
}

/**
 * Pixels per safe height for a window of aspect a, 1 unit tall: the safe frame contained, but
 * never less than covering the master's width or height (the same max/min as framingCss's --u).
 */
function scale(f: FrameName, a: number): number {
  const { w, h } = master(f);
  return Math.max(Math.min(a / safeAspect(f), 1), a / w, 1 / h);
}

/** The master region a window of this aspect shows: centred on the safe frame, bottom-aligned. */
export function visible(f: FrameName, a: number): Rect {
  const { w, h } = master(f);
  const k = scale(f, a);
  const [vw, vh] = [a / k, 1 / k];
  return { x0: (w - vw) / 2 / w, y0: 1 - vh / h, x1: (w + vw) / 2 / w, y1: 1 };
}

const union = (a: Rect, b: Rect): Rect => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
});

/** Band i (between bands[i] and bands[i + 1]): everything a window in it can show. */
export function band(f: FrameName, i: number): Rect {
  const b = data[f].bands.map(ratio);
  if (i < 0 || i >= b.length - 1) throw new Error(`${f} has no band ${i}`);
  // visible() changes monotonically with the aspect, so the two ends bound the band.
  return union(visible(f, b[i]!), visible(f, b[i + 1]!));
}

export const bandCount = (f: FrameName) => data[f].bands.length - 1;

/** A band's own media query; the first band of a frame is its frame's default. */
export function bandMedia(f: FrameName, i: number): string {
  return i === 0 ? '' : `(min-aspect-ratio: ${data[f].bands[i]})`;
}

export function frameFor(aspect: number): FrameName {
  return aspect <= range('seatPhone')[1] ? 'seatPhone' : 'seat';
}

/** three's setViewOffset(fullW, fullH, x, y, layerW, layerH): the master, with the window on it. */
export function viewOffset(f: FrameName, aspect: number, layerW: number, layerH: number) {
  const { w, h } = master(f);
  const v = visible(f, aspect);
  const px = layerH / ((v.y1 - v.y0) * h); // pixels per safe height
  const fullW = w * px;
  const fullH = h * px;
  return { fullW, fullH, x: v.x0 * fullW, y: v.y0 * fullH };
}
