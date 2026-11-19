import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import { hotspotVars } from '@/content/deskLayout';
import { deskDescription, DESK_OBJECTS, type SectionSlug } from '@/content/objects';
import { useTheme } from '@/lib/useTheme';
import { ART, ArtDefs, DeskSurface, LampLight } from './art';
import { Hotspot } from './Hotspot';

type Props = {
  selected: SectionSlug | null;
  onOpen: (slug: SectionSlug) => void;
  onClose: () => void;
};

/**
 * Tier 1: the still desk (spec §3.3). First paint, the reduced-motion and no-WebGL experience,
 * and the layer the live scene will swap in over. Every state is CSS on aria-pressed and the
 * theme, so a statically rendered section route paints already selected.
 */
export function DeskStill({ selected, onOpen, onClose }: Props) {
  const { theme, toggle } = useTheme();

  // Under 1024px: keep the opened object in view above the sheet (hotspots carry a
  // scroll-margin the sheet's height). Only when the selection changes; a direct load paints
  // in place.
  const shown = useRef(selected);
  useEffect(() => {
    if (shown.current === selected) return;
    shown.current = selected;
    if (!selected || !matchMedia('(max-width: 1023px)').matches) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .querySelector(`.hotspot[data-slug="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [selected]);
  const Mug = ART.mug;
  const Lamp = ART.lightbar;

  // Clicking bare felt goes back to the desk (spec §2); objects handle their own clicks.
  const onLayerClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target as Element).closest('button.hotspot')) onClose();
  };

  return (
    <div className="desk-still" data-tier="1">
      <p className="visually-hidden">{deskDescription()}</p>
      <div className="desk-still__mat">
        <div className="desk-still__layer" aria-hidden="true" onClick={onLayerClick}>
          <ArtDefs />
          <DeskSurface />
          <div
            className="hotspot hotspot--deco"
            data-item="mug"
            style={hotspotVars('mug') as CSSProperties}
          >
            <Mug />
          </div>
          {DESK_OBJECTS.map((o) => {
            const Art = ART[o.id];
            return (
              <Hotspot
                key={o.id}
                item={o.id}
                slug={o.slug}
                pressed={selected === o.slug}
                onClick={() => onOpen(o.slug)}
              >
                <Art />
              </Hotspot>
            );
          })}
          <Hotspot item="lightbar" pressed={theme === 'lamp'} onClick={toggle}>
            <Lamp />
          </Hotspot>
          <LampLight />
        </div>
      </div>
    </div>
  );
}
