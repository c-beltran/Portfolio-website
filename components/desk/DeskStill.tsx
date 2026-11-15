import type { CSSProperties, MouseEvent } from 'react';
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
  const Mug = ART.mug;
  const Lamp = ART.lamp;

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
          <Hotspot item="lamp" pressed={theme === 'lamp'} onClick={toggle}>
            <Lamp />
          </Hotspot>
          <LampLight />
        </div>
      </div>
    </div>
  );
}
