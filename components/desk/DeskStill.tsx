import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from 'react';
import { PORTRAIT, type DeskItemId } from '@/content/deskLayout';
import { deskDescription, DESK_OBJECTS, type SectionSlug } from '@/content/objects';
import { artOf, isMover, openedFor, patchSrc, type MoverId } from '@/content/opened';
import {
  band,
  bandCount,
  bandFor,
  bandMedia,
  isPortrait,
  master,
  portraitStrip,
  ratio,
  type Rect,
} from '@/content/scene/framing';
import framing from '@/content/scene/framing.json';
import { sizesFor } from '@/content/scene/framingCss';
import { useLight } from '@/lib/useLight';
import { LiveLayer } from '@/components/scene/LiveLayer';
import { Hotspot } from './Hotspot';
import { MonitorName } from './MonitorName';
import { prefetchArt } from './Opened';
import { ScreenLoop } from './ScreenLoop';
import { CENTRE_SCRIPT, panOf, setPan } from './pan';
import { Steam } from './Steam';
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
 * The Cycles render from the seat: the crop of the master this window shape shows
 * (framingCss places it), AVIF with a WebP fallback.
 */
/** Which crop a still's URL is (seat-<crop>-<mode>-<width>). */
const cropOf = (src: string) => /\/seat-(p|b\d+)-/.exec(src)?.[1];

/**
 * Runs as the page is parsed, right after the two renders: when the lamp render is on show (night,
 * lamp on), it is the first paint, so it loads at once and first; the hidden day render waits.
 */
const NIGHT_PAINT = `(function(){if(document.documentElement.dataset.theme!=='lamp')return;var l=document.querySelector('.desk-still__photo--lamp img'),d=document.querySelector('.desk-still__photo--day img');if(l){l.loading='eager';l.fetchPriority='high'}if(d){d.fetchPriority='low'}})();`;

function DeskPhoto({ mode }: { mode: 'day' | 'lamp' }) {
  const [w, h] = px(DEFAULT.rect, SAFE_PX[0]!);
  const img = useRef<HTMLImageElement>(null);
  // The image keeps the crop it is (framingCss: img[data-crop]) until the next one has loaded, so
  // a rotation or resize never stretches the old still into the new crop's box.
  useEffect(() => {
    const el = img.current;
    if (!el) return;
    const mark = () => {
      const c = cropOf(el.currentSrc);
      if (c) el.dataset.crop = c;
    };
    if (el.complete) mark();
    el.addEventListener('load', mark);
    return () => el.removeEventListener('load', mark);
  }, []);
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
            // Each crop's own shape, so the hidden lamp image is judged by the crop it will show.
            width={px(c.rect, SAFE_PX[0]!)[0]}
            height={px(c.rect, SAFE_PX[0]!)[1]}
          />
        )),
      )}
      <source
        type="image/avif"
        srcSet={srcSet(DEFAULT, mode, 'avif')}
        sizes={sizes(DEFAULT)}
        width={w}
        height={h}
      />
      <img
        ref={img}
        src={`/stills/seat-b0-${mode}-${w}.webp`}
        srcSet={srcSet(DEFAULT, mode, 'webp')}
        sizes={sizes(DEFAULT)}
        // No width/height: globals.css sizes it to its crop (so nothing shifts), and a hidden lamp
        // image would otherwise be judged by band 0's shape.
        alt=""
        // By day the day render is the LCP. The lamp render is display: none until the lamp is on
        // at night, and lazy, so day visitors never download it (NIGHT_PAINT turns this round).
        fetchPriority={mode === 'day' ? 'high' : 'low'}
        loading={mode === 'day' ? 'eager' : 'lazy'}
        // NIGHT_PAINT swaps these before hydration when the lamp render is the one on show.
        suppressHydrationWarning
      />
    </picture>
  );
}

/**
 * While an object is out, a render of its spot with the object gone covers it on the still, so it
 * isn't shown twice (scripts/scene/render_opened.py --patch). Placed in master percents like the
 * hotspots, its edges feathered into the still.
 */
function DeskPatch({ id, mode }: { id: MoverId; mode: 'day' | 'lamp' }) {
  const { patch: r, patchWidths } = artOf(id) as Required<ReturnType<typeof artOf>>;
  const set = (ext: 'avif' | 'webp') =>
    patchWidths.map((w) => `${patchSrc(id, mode, w, ext)} ${w}w`).join(', ');
  // Its share of the master's width at the window's scale, as the stills size theirs.
  const w = (r.x1 - r.x0) * M.w;
  const sizes = `${PORTRAIT} ${sizesFor(w, true)}, ${sizesFor(w)}`;
  const style = {
    '--px0': r.x0,
    '--py0': r.y0,
    '--pw': r.x1 - r.x0,
    '--ph': r.y1 - r.y0,
  } as CSSProperties;
  return (
    <picture>
      <source type="image/avif" srcSet={set('avif')} sizes={sizes} />
      <img
        className="desk-still__patch"
        data-item={id}
        src={patchSrc(id, mode, patchWidths[0]!, 'webp')}
        srcSet={set('webp')}
        sizes={sizes}
        alt=""
        style={style}
      />
    </picture>
  );
}

/**
 * The hover glow: a soft warm ring just outside the object's silhouette, never on the object,
 * from masks rendered from the seat (scripts/scene/render_masks.py, encode_glow.mjs). It sits just
 * before its hotspot, so CSS lights it from that hotspot's hover and open state (globals.css), and
 * follows the glance.
 */
function DeskGlow({ item }: { item: DeskItemId }) {
  const style = { '--ring': `url(/glow/${item}-ring.webp)` } as CSSProperties;
  return (
    <div className="desk-glow" data-item={item} style={style}>
      <i className="desk-glow__ring" />
    </div>
  );
}

/**
 * The still a touch device would need if it turned now (portrait ↔ landscape): its URL by the same
 * maths the <picture> uses, so the swap is instant after a turn (AVIF; every current phone has it).
 */
function turnedStill(mode: 'day' | 'lamp'): string {
  const [W, H] = [innerHeight, innerWidth];
  const a = W / H;
  const c = isPortrait(a) ? CROPS[0]! : (CROPS.find((k) => k.name === `b${bandFor(a)}`) ?? DEFAULT);
  const s = ratio(framing.safeAspect);
  const u = isPortrait(a) ? H : Math.max(Math.min(W / s, H), W / M.w, H / M.h);
  const need = (c.rect.x1 - c.rect.x0) * M.w * u * devicePixelRatio;
  const widths = SAFE_PX.map((safe) => px(c.rect, safe)[0]);
  const width = widths.find((x) => x >= need) ?? widths[widths.length - 1]!;
  return `/stills/seat-${c.name}-${mode}-${width}.avif`;
}

/** A narrow window pans with an ordinary (vertical) mouse wheel too, not only Shift+wheel. */
function useWheelPan(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || el.scrollWidth <= el.clientWidth) return; // pinch-zoom, or nothing to pan
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // already sideways (trackpads)
      e.preventDefault();
      el.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);
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
 * Tier 1: the still desk, seen from the seat. It fills the window; portrait
 * windows scroll sideways across it. First paint, the reduced-motion and no-WebGL experience, and
 * the layer the live scene swaps in over. Every state is CSS on aria-pressed and the theme, so a
 * statically rendered section route paints already selected.
 */
export function DeskStill({ selected, onOpen, onClose }: Props) {
  const { lamp, render, toggleLamp } = useLight();
  const opened = openedFor(selected);
  // The glow's masks load once the page is idle, like the lamp render: never on the first load.
  const [glow, setGlow] = useState(false);
  const still = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  useKeptPan(still);
  useWheelPan(still);
  useLabels(layer, selected);

  // Once the page is idle, fetch the lamp render (lazy until now, to keep it off the LCP path),
  // so the first switch to lamp mode cross-fades at once.
  useEffect(() => {
    const warm = () => {
      setGlow(true);
      document
        .querySelectorAll<HTMLImageElement>('.desk-still__photo--lamp img')
        .forEach((img) => (img.loading = 'eager'));
      // A touch device may turn (the hint asks it to): have that still ready.
      if (matchMedia('(pointer: coarse)').matches)
        new Image().src = turnedStill(
          document.documentElement.dataset.theme === 'lamp' ? 'lamp' : 'day',
        );
    };
    const idle = () =>
      'requestIdleCallback' in window ? requestIdleCallback(warm) : setTimeout(warm, 200);
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
    return () => window.removeEventListener('load', idle);
  }, []);

  // Clicking the desk away from any object goes back to the desk. While an object is out
  // the hotspots take no clicks (globals.css), so the whole dimmed desk closes it.
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
            <div className="desk-still__art">
              <DeskPhoto mode="day" />
              <DeskPhoto mode="lamp" />
              <script dangerouslySetInnerHTML={{ __html: NIGHT_PAINT }} />
              {opened && isMover(opened) && <DeskPatch id={opened} mode={render} />}
            </div>
            {DESK_OBJECTS.flatMap((o) => [
              glow && <DeskGlow key={`glow-${o.id}`} item={o.id} />,
              <Hotspot
                key={o.id}
                item={o.id}
                slug={o.slug}
                label={o.label}
                pressed={selected === o.slug}
                onClick={() => onOpen(o.slug)}
                onIntent={() => prefetchArt(o.id)}
              />,
            ])}
            {glow && <DeskGlow item="lightbar" />}
            <Hotspot item="lightbar" label="Lamp" pressed={lamp === 'on'} onClick={toggleLamp} />
          </div>
          <LiveLayer open={opened} />
          <div className="desk-still__overlay">
            {glow && <Steam />}
            <MonitorName />
            {glow && <ScreenLoop mode={render} />}
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: CENTRE_SCRIPT }} />
    </>
  );
}
