/** The turn-sideways hint's once-per-visit flag (design 2026-11-19 §3.5), in sessionStorage. */
export const HINT_KEY = 'desk-hint-seen';
/** Fired on window when the hint has gone (ended, tapped away, or skipped). */
export const HINT_END = 'deskhintend';

/** Inline in <head>: a hint already seen in this tab never paints. */
export const HINT_SCRIPT = `(function(){try{if(sessionStorage.getItem('${HINT_KEY}'))document.documentElement.dataset.hintSeen='true'}catch(e){}})();`;

export function markHintSeen(): void {
  try {
    sessionStorage.setItem(HINT_KEY, '1');
  } catch {}
  if (document.documentElement.dataset.hintSeen) return;
  document.documentElement.dataset.hintSeen = 'true';
  window.dispatchEvent(new Event(HINT_END));
}

/** Whether the hint is on screen now (its CSS decides: an upright touch screen, not yet seen). */
export function hintShowing(): boolean {
  const el = document.querySelector('.turn-hint');
  return !!el && getComputedStyle(el).display !== 'none';
}
