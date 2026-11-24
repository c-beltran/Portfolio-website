'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import seat from '@/content/scene/bounds-seat.json';
import { useMotion } from '@/lib/useMotion';

const MUG = seat.objects.obj_mug;
const [W, H] = [MUG.x1 - MUG.x0, MUG.y1 - MUG.y0];
// The cup's opening within the mug's box, which takes in the handle on the right.
const STYLE = {
  '--sx': MUG.x0 + 0.46 * W,
  '--sy': MUG.y0 + 0.2 * H,
  '--sw': 0.56 * W,
  '--sh': 1.25 * H,
} as CSSProperties;

const onVisibility = (f: () => void) => {
  document.addEventListener('visibilitychange', f);
  return () => document.removeEventListener('visibilitychange', f);
};

/**
 * Steam over the mug: three soft wisps in the overlay
 * above the still and the live scene, following the glance. Only transform and opacity move. It
 * mounts once the page is idle, and waits while paused, while an object is out (globals.css) and
 * while the tab is hidden.
 */
export function Steam() {
  const { paused } = useMotion();
  const hidden = useSyncExternalStore(
    onVisibility,
    () => document.hidden,
    () => false,
  );
  return (
    <div
      className="steam"
      aria-hidden="true"
      data-paused={paused || hidden || undefined}
      style={STYLE}
    >
      {[0, 1, 2].map((i) => (
        <i key={i} className="steam__wisp">
          <svg viewBox="0 0 40 100" preserveAspectRatio="none">
            <path d="M20 94 C6 78 34 64 20 48 S8 22 22 6" />
          </svg>
        </i>
      ))}
    </div>
  );
}
