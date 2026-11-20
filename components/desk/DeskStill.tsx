import { useEffect, useLayoutEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { PORTRAIT } from '@/content/deskLayout';
import { deskDescription, DESK_OBJECTS, type SectionSlug } from '@/content/objects';
import {
  band,
  bandCount,
  bandMedia,
  master,
  portraitStrip,
  type Rect,
} from '@/content/scene/framing';
import { sizesFor } from '@/content/scene/framingCss';
import { useTheme } from '@/lib/useTheme';
import { LiveLayer } from '@/components/scene/LiveLayer';
import { Hotspot } from './Hotspot';
import { MonitorName } from './MonitorName';
import { CENTRE_SCRIPT, panOf, setPan } from './pan';
import { useLabels } from './useLabels';

type Props = {
  selected: SectionSlug | null;
  onOpen: (slug: SectionSlug) => void;
  onClose: () => void;
};

/** The seat stills (scripts/scene/encode_stills.mjs): a 900 px and a 1600 px safe height. */
const SAFE_PX = [900, 1600];
const M = master();
const px = (r: Rect, safe: number) =>
  [Math.round((r.x1 - r.x0) * M.w * safe), Math.round((r.y1 - r.y0) * M.h * safe)] as const;

type Crop = { name: string; rect: Rect; media?: string; portrait?: boolean };
/** <source> order: the portrait strip, then the wide bands from widest; band 0 is the <img>. */
const CROPS: Crop[] = [
  { name: 'p', rect: portraitStrip(), media: PORTRAIT, portrait: true },
  ...Array.from({ length: bandCount() - 1 }, (_, k) => {
    const i = bandCount() - 1 - k;
    return { name: `b${i}`, rect: band(i), media: bandMedia(i) };
  }),
];
const DEFAULT: Crop = { name: 'b0', rect: band(0) };

const srcSet = (c: Crop, mode: string, ext: string) =>
  SAFE_PX.map((safe) => {
    const [w] = px(c.rect, safe);
    return `/stills/seat-${c.name}-${mode}-${w}.${ext} ${w}w`;
  }).join(', ');
const sizes = (c: Crop) => sizesFor((c.rect.x1 - c.rect.x0) * M.w, c.portrait);

/**
 * The approved Cycles render from the seat: the crop of the master this window shape shows
 * (framingCss places it), AVIF with a WebP fallback.
 */
function DeskPhoto({ mode }: { mode: 'day' | 'lamp' }) {
  const [w, h] = px(DEFAULT.rect, SAFE_PX[0]!);
  return (
    <picture className={`desk-still__photo desk-still__photo--${mode}`}>
      {CROPS.flatMap((c) =>
        (['avif', 'webp'] as const).map((ext) => (
          <source
            key={`${c.name}-${ext}`}
            media={c.media}
            type={`image/${ext}`}
            srcSet={srcSet(c, mode, ext)}
            sizes={sizes(c)}
          />
        )),
      )}
      <source type="image/avif" srcSet={srcSet(DEFAULT, mode, 'avif')} sizes={sizes(DEFAULT)} />
      <img
        src={`/stills/seat-b0-${mode}-${w}.webp`}
        srcSet={srcSet(DEFAULT, mode, 'webp')}
        sizes={sizes(DEFAULT)}
        width={w}
        height={h}
        alt=""
        // Day is the LCP. The lamp render is display: none until lamp mode, and lazy, so day
        // visitors never download it.
        fetchPriority={mode === 'day' ? 'high' : 'low'}
        loading={mode === 'day' ? 'eager' : 'lazy'}
      />
    </picture>
  );
}

/** Keeps the portrait pan where it was through size changes (toolbars, rotation, resizing). */
function useKeptPan(ref: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A client-side mount has no inline script behind it: centre here (a server-rendered page is
    // already centred, unless the visitor has scrolled).
    if (el.scrollLeft === 0) setPan(el, 0);
    let pan = panOf(el);
    let size = [el.scrollWidth, el.clientWidth];
    const onScroll = () => {
      // A scroll the browser makes while resizing (clamping) isn't the visitor's.
      if (el.scrollWidth !== size[0] || el.clientWidth !== size[1]) return;
      pan = panOf(el);
    };
    const ro = new ResizeObserver(() => {
      // Unless the browser clamped it, the scroll position is still the visitor's latest (its
      // scroll event may not have arrived yet): read the pan from it against the old size.
      const [oldMax, newMax] = [size[0]! - size[1]!, el.scrollWidth - el.clientWidth];
      if (oldMax > 0 && el.scrollLeft < newMax) pan = (el.scrollLeft / oldMax) * 2 - 1;
      size = [el.scrollWidth, el.clientWidth];
      setPan(el, pan);
    });
    el.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [ref]);
}

/**
 * Tier 1: the still desk, seen from the seat (design 2026-11-19 §3). It fills the window; portrait
 * windows scroll sideways across it. First paint, the reduced-motion and no-WebGL experience, and
 * the layer the live scene swaps in over. Every state is CSS on aria-pressed and the theme, so a
 * statically rendered section route paints already selected.
 */
export function DeskStill({ selected, onOpen, onClose }: Props) {
  const { theme, toggle } = useTheme();
  const still = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  useKeptPan(still);
  useLabels(layer, selected);

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
    <>
      {/* tabIndex -1: a portrait window makes this a scroller, which browsers would otherwise add
          to the Tab order; the Sections list is the keyboard path (and pans to what it focuses). */}
      <div className="desk-still" data-tier="1" ref={still} tabIndex={-1}>
        <p className="visually-hidden">{deskDescription()}</p>
        <div className="desk-stage">
          <div
            ref={layer}
            className="desk-still__layer"
            aria-hidden="true"
            onClick={onLayerClick}
            // A click on the desk never moves focus (into the aria-hidden layer or onto the scroller).
            onMouseDown={(e) => e.preventDefault()}
          >
            <DeskPhoto mode="day" />
            <DeskPhoto mode="lamp" />
            <LiveLayer />
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
          <div className="desk-still__overlay">
            <MonitorName />
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: CENTRE_SCRIPT }} />
    </>
  );
}
