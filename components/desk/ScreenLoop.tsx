'use client';

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import loop from '@/content/scene/screen-loop.json';
import seat from '@/content/scene/bounds-seat.json';
import { useMotion } from '@/lib/useMotion';
import { avifOk } from './Opened';

/** How long each terminal frame holds. */
export const LOOP_STEP_MS = 1500;

type Mode = 'day' | 'lamp';
const R = loop.rect;
// The frames carry a margin of the still around the terminal; draw only the part on the
// monitor's left half (its margin is the still itself, so nothing shows the cut).
const MON = seat.objects.obj_monitor;
const C = {
  x0: Math.max(R.x0, MON.x0),
  y0: Math.max(R.y0, MON.y0),
  x1: Math.min(R.x1, MON.x1),
  y1: Math.min(R.y1, MON.y1),
};
/** The kept part of each frame, as fractions of it. */
const CROP = {
  x: (C.x0 - R.x0) / (R.x1 - R.x0),
  y: (C.y0 - R.y0) / (R.y1 - R.y0),
  w: (C.x1 - C.x0) / (R.x1 - R.x0),
  h: (C.y1 - C.y0) / (R.y1 - R.y0),
};
const STYLE = {
  '--px0': C.x0,
  '--py0': C.y0,
  '--pw': C.x1 - C.x0,
  '--ph': C.y1 - C.y0,
} as CSSProperties;

const QUERY = '(prefers-reduced-motion: no-preference)';
const onMotionPref = (f: () => void) => {
  const q = matchMedia(QUERY);
  q.addEventListener('change', f);
  return () => q.removeEventListener('change', f);
};

const src = (k: number, mode: Mode, w: number, ext: string) =>
  `/screens/terminal-${k}-${mode}-${w}.${ext}`;

/**
 * The terminal on the resting monitor, a few new lines at a time: three rendered frames drawn on
 * a canvas over the still (an <img> arriving after idle could become the page's largest paint),
 * one step every LOOP_STEP_MS, for ever. It holds while paused (the steam's pause, useMotion),
 * while an object is out and while the tab is hidden, and resumes where it was.
 */
export function ScreenLoop({ mode }: { mode: Mode }) {
  const moving = useSyncExternalStore(
    onMotionPref,
    () => matchMedia(QUERY).matches,
    () => false,
  );
  return moving ? <Loop mode={mode} /> : null;
}

function Loop({ mode }: { mode: Mode }) {
  const { paused } = useMotion();
  // the frame it's on survives a mode change (the lamp's frames take over where day's were)
  const at = useRef(0);
  const ref = useRef<HTMLCanvasElement>(null);
  const held = useRef(paused);
  useEffect(() => {
    held.current = paused;
  }, [paused]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let gone = false;
    let frames: HTMLImageElement[] = [];
    let timer = 0;
    const draw = () => {
      const img = frames[at.current];
      if (!img) return;
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.round(r.height * devicePixelRatio));
      const [iw, ih] = [img.naturalWidth, img.naturalHeight];
      canvas
        .getContext('2d')
        ?.drawImage(
          img,
          CROP.x * iw,
          CROP.y * ih,
          CROP.w * iw,
          CROP.h * ih,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      canvas.dataset.frame = String(at.current + 1);
    };
    const still = () =>
      held.current || document.hidden || !!canvas.closest('.desk')?.hasAttribute('data-open');
    const step = () => {
      if (!still()) {
        at.current = (at.current + 1) % frames.length;
        draw();
      }
      timer = window.setTimeout(step, LOOP_STEP_MS);
    };
    void (async () => {
      const css = canvas.getBoundingClientRect().width / CROP.w;
      const w = loop.widths.find((x) => x >= css * devicePixelRatio) ?? loop.widths.at(-1)!;
      const ext = (await avifOk()) ? 'avif' : 'webp';
      const imgs = Array.from({ length: loop.frames }, (_, i) => {
        const img = new Image();
        img.src = src(i + 1, mode, w, ext);
        return img;
      });
      try {
        await Promise.all(imgs.map((i) => i.decode()));
      } catch {
        return; // the still's own terminal stays
      }
      if (gone) return;
      frames = imgs;
      draw();
      timer = window.setTimeout(step, LOOP_STEP_MS);
    })();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => {
      gone = true;
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [mode]);
  return <canvas ref={ref} className="screen-loop" aria-hidden="true" style={STYLE} />;
}
