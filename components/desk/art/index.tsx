import type { JSX } from 'react';
import type { DeskItemId } from '@/content/deskLayout';
import { Badge } from './Badge';
import { Card } from './Card';
import { Gauge } from './Gauge';
import { Lamp } from './Lamp';
import { Laptop } from './Laptop';
import { Mug } from './Mug';
import { Note } from './Note';
import { Phone } from './Phone';
import { Polaroid } from './Polaroid';

/**
 * M2 placeholder art: flat primitives. States (needle, phone light, lamp) are CSS, keyed on the
 * hotspot's aria-pressed and the theme, so they're right before any script runs.
 */
export const ART: Record<DeskItemId, () => JSX.Element> = {
  photo: Polaroid,
  badge: Badge,
  laptop: Laptop,
  gauge: Gauge,
  phone: Phone,
  note: Note,
  card: Card,
  lamp: Lamp,
  mug: Mug,
};

/** Shared SVG defs (shadows, the phone's light spill), rendered once per desk. */
export function ArtDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        <filter id="mug-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity="0.35" />
        </filter>
        <radialGradient id="phone-spill">
          <stop offset="0%" stopColor="#FFD84D" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFD84D" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** The felt mat and its handwritten invitation. */
export function DeskSurface() {
  return (
    <div className="desk-still__felt">
      <span className="desk-still__scrawl">go ahead, touch things</span>
    </div>
  );
}

/** Lamp mode: the room dims (multiply) except a warm pool under the lamp. Above objects, below the selected one. */
export function LampLight() {
  return <div className="desk-still__light" />;
}
