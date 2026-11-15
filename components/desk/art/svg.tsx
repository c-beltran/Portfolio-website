import type { ReactNode } from 'react';
import { ART_ASPECT, type DeskItemId } from '@/content/deskLayout';

export const W = 100;
export const heightOf = (id: DeskItemId) => W / ART_ASPECT[id];

/** Every object's art: a viewBox matching its box's pixel aspect, so nothing ever stretches. */
export function ArtSvg({ id, children }: { id: DeskItemId; children: ReactNode }) {
  return (
    <svg
      className={`art art--${id}`}
      viewBox={`0 0 ${W} ${heightOf(id).toFixed(2)}`}
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const label = (text: string) => text.toUpperCase();
