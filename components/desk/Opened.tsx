'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { artOf, artSrc, isLean, OPENED_IDS, sideOf, type OpenedId } from '@/content/opened';
import { OpenedFace } from './OpenedFace';
import { PhoneClip } from './PhoneClip';
import { Steam } from './Steam';

type Mode = 'day' | 'lamp';

// A 1×1 AVIF: whether this browser decodes AVIF (once per page).
const AVIF_PROBE =
  'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAAB0AAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAlbWRhdBIACgc4AAaQENBpMhAZQmMEwAA0AACQQM6Xt10S';
let avif: Promise<boolean> | null = null;
export function avifOk(): Promise<boolean> {
  avif ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth === 1);
    img.onerror = () => resolve(false);
    img.src = AVIF_PROBE;
  });
  return avif;
}

/** The smallest of the art's widths that covers the box in device pixels. */
function widthFor(id: OpenedId, cssWidth: number): number {
  const ws = artOf(id).widths;
  return ws.find((w) => w >= cssWidth * devicePixelRatio) ?? ws[ws.length - 1]!;
}

async function urlFor(id: OpenedId, mode: Mode, cssWidth: number) {
  return artSrc(id, mode, widthFor(id, cssWidth), (await avifOk()) ? 'avif' : 'webp');
}

/**
 * Warms the art an object would show if it opened now (pointer over its hotspot, or focus on its
 * Sections button), so it is drawn as it comes out. Never on the first load.
 */
const warmed = new Set<string>();
export function prefetchArt(id: string) {
  if (!(OPENED_IDS as readonly string[]).includes(id)) return;
  const mode: Mode = document.documentElement.dataset.theme === 'lamp' ? 'lamp' : 'day';
  // The slot is the window less the panel (wide) or the full width (portrait): near enough to pick.
  const box = innerWidth / innerHeight <= 1.2 ? innerWidth : innerWidth - 460;
  void urlFor(id as OpenedId, mode, box * 0.88).then((url) => {
    if (warmed.has(url)) return;
    warmed.add(url);
    new Image().src = url;
  });
}

/**
 * Draws the opened render into a canvas sized to its box, so it is never the
 * page's largest element (an <img> would be, on a section route). Picks 800 or 1600 px by
 * the box and the pixel ratio, AVIF where it decodes; redraws on resize and on a mode change.
 */
function useArtCanvas(id: OpenedId, mode: Mode) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let img: HTMLImageElement | null = null;
    let want = '';
    let gone = false;
    const draw = () => {
      if (!img) return;
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.round(r.height * devicePixelRatio));
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.dataset.drawn = 'true';
    };
    const load = async () => {
      const url = await urlFor(id, mode, canvas.getBoundingClientRect().width);
      if (gone || url === want) return draw();
      want = url;
      const next = new Image();
      next.src = url;
      try {
        await next.decode();
      } catch {
        return; // the desk stays dimmed with its panel; the art just doesn't show
      }
      if (gone || want !== url) return;
      img = next;
      draw();
    };
    void load();
    const ro = new ResizeObserver(() => void load());
    ro.observe(canvas);
    return () => {
      gone = true;
      ro.disconnect();
    };
  }, [id, mode]);
  return ref;
}

type Props = { id: OpenedId; mode: Mode; leaving?: boolean };

/**
 * The object that came forward, or the face the view leaned in to: its render in a slot on its own
 * side of the window, the panel on the other (in portrait, above the panel). A lean-in's edge
 * feathers into the dimmed desk. Decorative: the
 * panel carries the words, so it is hidden from assistive tech. A click on it keeps it out.
 */
export function Opened({ id, mode, leaving }: Props) {
  const ref = useArtCanvas(id, mode);
  return (
    // Its own side, not the desk's: the desk drops data-side the moment it closes, while this art
    // fades out for 300 ms where it was.
    <div
      className="opened"
      aria-hidden="true"
      data-id={id}
      data-kind={isLean(id) ? 'lean' : 'mover'}
      data-side={sideOf(id)}
      data-leaving={leaving || undefined}
    >
      <div className="opened__slot">
        <div className="opened__art" style={{ '--aspect': artOf(id).aspect } as CSSProperties}>
          <canvas ref={ref} className="opened__canvas" />
          <OpenedFace id={id} />
          {id === 'phone' && <PhoneClip leaving={leaving} />}
          {id === 'mug' && <Steam at={artOf('mug').steam} />}
        </div>
      </div>
    </div>
  );
}
