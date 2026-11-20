/**
 * The portrait pan (design 2026-11-19 §3.2, option C): .desk-still scrolls sideways across the safe
 * frame. −1 is its left edge, +1 its right edge, 0 the centre; framing.ts visible(aspect, pan)
 * uses the same scale.
 */

/** The pan from the element's horizontal scroll; 0 when it can't scroll (wide windows). */
export function panOf(el: HTMLElement): number {
  const max = el.scrollWidth - el.clientWidth;
  return max > 0 ? (el.scrollLeft / max) * 2 - 1 : 0;
}

export function setPan(el: HTMLElement, pan: number): void {
  const max = el.scrollWidth - el.clientWidth;
  if (max > 0) el.scrollLeft = ((Math.max(-1, Math.min(1, pan)) + 1) / 2) * max;
}

/**
 * Inline, right after .desk-still: centres it before first paint (the stylesheets are in by then,
 * so the stage has its width). Without JavaScript the view starts at the left edge.
 */
export const CENTRE_SCRIPT =
  '(function(d){if(d)d.scrollLeft=(d.scrollWidth-d.clientWidth)/2})(document.currentScript&&document.currentScript.previousElementSibling)';
