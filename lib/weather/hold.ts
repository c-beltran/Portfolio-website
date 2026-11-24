const REDUCED = '(prefers-reduced-motion: reduce)';

export const reducedMotion = () => matchMedia(REDUCED).matches;

/**
 * Whether the window's weather holds a still frame: reduced motion, the motion pause, a hidden
 * tab, or a lean-in on the monitor covering the window (the desk's data-open).
 */
export function weatherHeld(el: Element | null, paused: boolean): boolean {
  const open = el?.closest('.desk')?.getAttribute('data-open') ?? '';
  return reducedMotion() || paused || document.hidden || open === 'monitor' || open === 'cv';
}
