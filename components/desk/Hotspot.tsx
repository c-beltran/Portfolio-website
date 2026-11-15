import type { CSSProperties, ReactNode } from 'react';
import { hotspotVars, type DeskItemId } from '@/content/deskLayout';

type Props = {
  item: DeskItemId;
  slug?: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
};

/**
 * A desk object you can click. Placed and lifted by transform only (spec §4): left/top stay 0
 * and globals.css builds the transform from hotspotVars. Out of the Tab order: the drawer is the
 * keyboard and screen-reader path (spec §3.4).
 */
export function Hotspot({ item, slug, pressed, onClick, children }: Props) {
  return (
    <button
      type="button"
      className="hotspot"
      data-item={item}
      data-slug={slug}
      tabIndex={-1}
      aria-pressed={pressed}
      style={hotspotVars(item) as CSSProperties}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
