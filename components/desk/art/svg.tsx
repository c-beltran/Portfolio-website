import type { ReactNode } from 'react';
import { ART_ASPECT, type DeskItemId } from '@/content/deskLayout';

export const W = 100;
export const heightOf = (id: DeskItemId) => W / ART_ASPECT[id];

/** Every object's art: a viewBox matching its box's pixel aspect, so nothing ever stretches. */
type StickerSpec = { x: number; y: number; rot: number; text: string };

export function ArtSvg({
  id,
  sticker,
  children,
}: {
  id: DeskItemId;
  /** The cream label: position in the art's own units (width 100), drawn as HTML text. */
  sticker?: StickerSpec;
  children: ReactNode;
}) {
  const h = heightOf(id);
  return (
    <>
      <svg
        className={`art art--${id}`}
        viewBox={`0 0 ${W} ${h.toFixed(2)}`}
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
        focusable="false"
      >
        {children}
      </svg>
      {sticker && (
        <span
          className="sticker"
          style={{
            left: `${sticker.x}%`,
            top: `${((sticker.y / h) * 100).toFixed(2)}%`,
            transform: `rotate(${sticker.rot}deg)`,
          }}
        >
          {sticker.text}
        </span>
      )}
    </>
  );
}

export const label = (text: string) => text.toUpperCase();
