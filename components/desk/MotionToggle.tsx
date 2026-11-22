'use client';

import { useMotion } from '@/lib/useMotion';

/**
 * The pointer's pause for the desk's motion. Like the hotspots it is out of the tab order and
 * hidden from assistive tech, whose path is "Pause motion" in the Sections list.
 */
export function MotionToggle() {
  const { ready, paused, toggle } = useMotion();
  if (!ready) return null;
  return (
    <button
      type="button"
      className="motion-toggle"
      tabIndex={-1}
      aria-hidden="true"
      title={paused ? 'Play motion' : 'Pause motion'}
      // like the hotspots: a click never moves focus onto a control hidden from assistive tech
      onMouseDown={(e) => e.preventDefault()}
      onClick={toggle}
    >
      <svg viewBox="0 0 16 16" width="16" height="16">
        <path d={paused ? 'M4 2l10 6-10 6z' : 'M3 2h3.5v12H3zM9.5 2H13v12H9.5z'} />
      </svg>
    </button>
  );
}
