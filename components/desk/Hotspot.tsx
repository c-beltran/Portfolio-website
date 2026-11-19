import type { CSSProperties } from 'react';
import { hotspotVars, type DeskItemId } from '@/content/deskLayout';

type Props = {
  item: DeskItemId;
  slug?: string;
  pressed: boolean;
  onClick: () => void;
  /** The tape label on the object (spec §2, discoverability). */
  label: string;
};

/**
 * A desk object you can click: a box over the object in the still, grown to 44px around its
 * centre. Placed by transform only (spec §4): left/top stay 0 and globals.css builds the
 * transform from hotspotVars. Out of the Tab order: the drawer is the
 * keyboard and screen-reader path (spec §3.4).
 */
export function Hotspot({ item, slug, pressed, onClick, label }: Props) {
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
      // A click must not move focus into the aria-hidden desk (focus stays where it was).
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="sticker">{label.toUpperCase()}</span>
    </button>
  );
}
