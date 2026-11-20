import { useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';
import { markHintSeen } from './hint';

/**
 * "Turn your phone sideways" (design 2026-11-19 §3.5): on arrival on an upright touch screen the
 * desk grays out for about 4 s under this card. All CSS (globals.css .turn-hint): it shows only
 * under (pointer: coarse) and PORTRAIT and until html[data-hint-seen], so it works in Tier 1
 * without JavaScript. A tap dismisses it and is swallowed here, so it never opens what's under it.
 * Hidden from assistive tech: it is advice about the picture.
 */
export function TurnHint() {
  const ref = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  // Leaving the desk (a section opens) counts as seen: it's an arrival hint.
  useEffect(() => () => markHintSeen(), []);

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (closing.current) return;
    closing.current = true;
    ref.current?.setAttribute('data-closing', 'true');
    // The tap's click lands on this card while it fades; it goes for good once the click is in.
    window.setTimeout(markHintSeen, 400);
  };
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    markHintSeen();
  };

  return (
    <div
      ref={ref}
      className="turn-hint"
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onClick={onClick}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && !closing.current) markHintSeen();
      }}
    >
      <div className="turn-hint__card">
        <svg
          className="turn-hint__phone"
          viewBox="0 0 64 64"
          width="64"
          height="64"
          aria-hidden="true"
        >
          <rect
            x="20"
            y="8"
            width="24"
            height="44"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="32" cy="46" r="2" fill="currentColor" />
        </svg>
        <p>Turn your phone sideways to see the whole desk, or swipe to look around.</p>
      </div>
    </div>
  );
}
