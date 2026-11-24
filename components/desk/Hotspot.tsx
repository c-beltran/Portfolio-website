import type { CSSProperties } from 'react';
import { hotspotVars, type DeskItemId } from '@/content/deskLayout';

type Props = {
  item: DeskItemId;
  slug?: string;
  pressed: boolean;
  onClick: () => void;
  /** The tape label on the object (discoverability). */
  label: string;
  /** The pointer came over it: a chance to fetch what opening it shows. */
  onIntent?: () => void;
};

/**
 * A desk object you can click: a box over the object in the still, grown to 44px around its
 * centre. Placed by transform only: left/top stay 0 and globals.css builds the
 * transform from hotspotVars. Out of the Tab order: the drawer is the
 * keyboard and screen-reader path.
 */
export function Hotspot({ item, slug, pressed, onClick, label, onIntent }: Props) {
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
      onPointerEnter={onIntent}
      // A click must not move focus into the aria-hidden desk (focus stays where it was).
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="sticker">{label.toUpperCase()}</span>
    </button>
  );
}
