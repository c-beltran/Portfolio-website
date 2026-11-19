import { useEffect, useRef, type MouseEvent } from 'react';
import { deskDescription, DESK_OBJECTS, type SectionSlug } from '@/content/objects';
import { useTheme } from '@/lib/useTheme';
import { Hotspot } from './Hotspot';

type Props = {
  selected: SectionSlug | null;
  onOpen: (slug: SectionSlug) => void;
  onClose: () => void;
};

/** The site's portrait phone layout; the phone camera's square still is art-directed in. */
const PORTRAIT = '(max-width: 719px) and (orientation: portrait)';
const DESK_SIZES = '(min-width: 1024px) 66vw, 100vw';

const srcSet = (view: 'desk' | 'phone', mode: 'day' | 'lamp', widths: number[], ext: string) =>
  widths.map((w) => `/stills/${view}-${mode}-${w}.${ext} ${w}w`).join(', ');

/** The approved Cycles render (M3a): AVIF with a WebP fallback, the phone framing on portrait. */
function DeskPhoto({ mode }: { mode: 'day' | 'lamp' }) {
  return (
    <picture className={`desk-still__photo desk-still__photo--${mode}`}>
      {(['avif', 'webp'] as const).map((ext) => (
        <source
          key={`phone-${ext}`}
          media={PORTRAIT}
          type={`image/${ext}`}
          srcSet={srcSet('phone', mode, [540, 1080], ext)}
          sizes="100vw"
          width={1080}
          height={1080}
        />
      ))}
      <source
        type="image/avif"
        srcSet={srcSet('desk', mode, [1280, 2560], 'avif')}
        sizes={DESK_SIZES}
      />
      <img
        src={`/stills/desk-${mode}-1280.webp`}
        srcSet={srcSet('desk', mode, [1280, 2560], 'webp')}
        sizes={DESK_SIZES}
        width={2560}
        height={1440}
        alt=""
        // Day is the LCP. The lamp render is display: none until lamp mode, and lazy, so day
        // visitors never download it.
        fetchPriority={mode === 'day' ? 'high' : 'low'}
        loading={mode === 'day' ? 'eager' : 'lazy'}
      />
    </picture>
  );
}

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

  // Once the page is idle, fetch the lamp render (lazy until now, to keep it off the LCP path),
  // so the first switch to lamp mode cross-fades at once.
  useEffect(() => {
    const warm = () =>
      document
        .querySelectorAll<HTMLImageElement>('.desk-still__photo--lamp img')
        .forEach((img) => (img.loading = 'eager'));
    const idle = () =>
      'requestIdleCallback' in window ? requestIdleCallback(warm) : setTimeout(warm, 200);
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
    return () => window.removeEventListener('load', idle);
  }, []);

  // Clicking the desk away from any object goes back to the desk (spec §2).
  const onLayerClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target as Element).closest('button.hotspot')) onClose();
  };

  return (
    <div className="desk-still" data-tier="1">
      <p className="visually-hidden">{deskDescription()}</p>
      <div className="desk-still__mat">
        <div className="desk-still__layer" aria-hidden="true" onClick={onLayerClick}>
          <DeskPhoto mode="day" />
          <DeskPhoto mode="lamp" />
          {DESK_OBJECTS.map((o) => (
            <Hotspot
              key={o.id}
              item={o.id}
              slug={o.slug}
              label={o.label}
              pressed={selected === o.slug}
              onClick={() => onOpen(o.slug)}
            />
          ))}
          <Hotspot item="lightbar" label="Lamp" pressed={theme === 'lamp'} onClick={toggle} />
        </div>
      </div>
    </div>
  );
}
