'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import clip from '@/content/scene/sky-clip.json';
import mask from '@/content/scene/sky-mask.json';
import { quadMatrix3d, type Pt } from '@/content/scene/screenAffine';
import { useMotion } from '@/lib/useMotion';
import { createPainter, motionFps, PAINT_MAX_W } from '@/lib/weather/painter';
import { liveOver, reducedMotion, weatherHeld } from '@/lib/weather/hold';
import { PATCH_ASPECT, SKY_QUAD } from '@/lib/weather/patch';
import type { Sky } from '@/lib/weather/types';

const QUAD = SKY_QUAD;
/** A frame drawn under reduced motion: a moment with nothing half-crossing. */
const STILL_T = 4000;

const STYLE = {
  '--px0': mask.x0,
  '--py0': mask.y0,
  '--pw': mask.x1 - mask.x0,
  '--ph': mask.y1 - mask.y0,
} as CSSProperties;

/**
 * The visitor's weather in the window: drawn in the space of the window's patch of sky, laid onto
 * the still by that patch's corners (quads.sky) and seen only through the glass (a clip traced
 * from the rendered mask: a clip, never an image, so it can't become the page's largest paint), so the frame, the monitor, the light bar and the plant stay in front. It fades in once
 * drawn. It draws only as often as the sky moves (none while nothing does). Under reduced motion or
 * the motion pause, while the tab is hidden, while a lean-in on the monitor covers the window, or
 * once the live desk is up over the still, it holds a still frame.
 */
export function WeatherWindow({ sky }: { sky: Sky | null }) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const { paused } = useMotion();
  const live = useRef({ sky, paused });
  useEffect(() => {
    live.current = { sky, paused };
  }, [sky, paused]);

  useEffect(() => {
    const canvas = ref.current;
    const wrap = box.current;
    if (!canvas || !wrap || !sky) return;
    let painter: ReturnType<typeof createPainter> | null = null;
    let raf = 0;
    let last = -Infinity;
    let t = 0;
    let prev = performance.now();
    let drewStill = '';

    // Size the canvas to its share of the window and lay it on the patch's corners.
    const place = () => {
      const art = wrap.parentElement!.getBoundingClientRect();
      const [W, H] = [art.width, art.height];
      const quad = QUAD.map(([x, y]) => [x * W, y * H] as Pt);
      const top = Math.hypot(quad[1]![0] - quad[0]![0], quad[1]![1] - quad[0]![1]);
      const w = Math.max(
        1,
        Math.round(Math.min(PAINT_MAX_W, top * Math.min(devicePixelRatio, 1.5))),
      );
      const h = Math.max(1, Math.round(w / PATCH_ASPECT));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        painter = createPainter(canvas.getContext('2d')!, w, h);
        drewStill = '';
      }
      const [ox, oy] = [mask.x0 * W, mask.y0 * H];
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.transform = quadMatrix3d(
        w,
        h,
        quad.map(([x, y]) => [x - ox, y - oy] as Pt),
      );
    };

    // Held, or hidden under the live desk (which draws its own window).
    const still = () => weatherHeld(wrap, live.current.paused) || liveOver(wrap);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = live.current.sky;
      if (!painter || !s) return;
      const holding = still();
      const dt = Math.min(now - prev, 100);
      prev = now;
      if (holding) {
        const key = `${s.condition}|${s.dayness.toFixed(2)}|${canvas.width}`;
        if (drewStill === key) return;
        drewStill = key;
        painter.draw(s, reducedMotion() ? STILL_T : t, { still: true });
        canvas.dataset.still = 'true';
      } else {
        t += dt;
        const fps = motionFps(s, t);
        if (fps === 0) {
          // Nothing moves (a clear day between birds, fog): the last frame stands.
          const key = `rest|${s.condition}|${s.dayness.toFixed(2)}|${canvas.width}`;
          if (drewStill === key) return;
          drewStill = key;
        } else {
          if (now - last < 1000 / fps) return;
          last = now;
          drewStill = '';
        }
        painter.draw(s, t, { still: false });
        delete canvas.dataset.still;
      }
      canvas.dataset.condition = s.condition;
      canvas.dataset.dayness = s.dayness.toFixed(2);
      wrap.dataset.drawn = 'true';
    };

    place();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(place);
    ro.observe(wrap.parentElement!);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // the sky's changes reach the loop through `live`; it starts once a sky is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sky === null]);

  return (
    <div ref={box} className="weather-window" aria-hidden="true" style={STYLE}>
      <svg className="weather-window__glass" aria-hidden="true">
        <clipPath id="weather-glass" clipPathUnits="objectBoundingBox">
          <path d={clip.d} clipRule="evenodd" />
        </clipPath>
      </svg>
      <canvas ref={ref} />
    </div>
  );
}
