'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { artOf } from '@/content/opened';
import { screenAffine, type Pt } from '@/content/scene/screenAffine';

/** The clip's element id: the panel's Pause/Play button (ClipControl) finds it by this. */
export const CLIP_ID = 'power-walk-clip';
// A placeholder until Carlos's screen recording (scripts/scene/placeholder_clip.sh).
const SRC = '/clips/power-walk.mp4';
export const CLIP_POSTER = '/clips/power-walk-poster.webp';

/**
 * Power Walk on the opened phone's screen: muted, looped, laid onto the
 * screen quad of the render (opened-art.json) by an affine fit, near exact because the screen faces
 * the eye. Like the opened art, it is drawn on a canvas: a <video> or its poster would become the
 * page's largest paint on /power-walk. The <video> stays in the page at 1 px as the source (the
 * panel's button and the live scene's texture use it). Its source is set only while it's mounted
 * and it never autoplays under reduced motion; going back pauses it at once and drops the source.
 */
export function PhoneClip({ leaving }: { leaving?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const v = video.current;
    const c = screen.current;
    if (!v || !c) return;
    let gone = false;
    let frame: HTMLVideoElement | HTMLImageElement | null = null;
    const draw = () => {
      if (!frame) return;
      const r = c.getBoundingClientRect();
      const [w, h] = [
        Math.round(r.width * devicePixelRatio),
        Math.round(r.height * devicePixelRatio),
      ];
      if (w > 0 && h > 0 && (c.width !== w || c.height !== h)) [c.width, c.height] = [w, h];
      c.getContext('2d')?.drawImage(frame, 0, 0, c.width, c.height);
    };
    // the poster first, then each new video frame while it plays
    const poster = new Image();
    poster.src = CLIP_POSTER;
    void poster.decode().then(
      () => {
        if (gone || frame === v) return;
        frame = poster;
        draw();
      },
      () => {},
    );
    const onFrame = () => {
      if (gone) return;
      frame = v;
      draw();
      if (!v.paused) schedule();
    };
    const schedule = () => {
      if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(onFrame);
      else requestAnimationFrame(onFrame);
    };
    v.addEventListener('play', schedule);
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    v.muted = true;
    v.src = SRC;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) void v.play().catch(() => {});
    return () => {
      gone = true;
      ro.disconnect();
      v.removeEventListener('play', schedule);
      v.pause();
      v.removeAttribute('src');
      v.load();
    };
  }, []);
  useEffect(() => {
    if (leaving) video.current?.pause();
  }, [leaving]);
  const a = artOf('phone');
  const f = screenAffine(a.screen as Pt[], { w: a.aspect, h: 1 });
  // Art-height units → percents of the art box (its width is aspect × its height).
  const style = {
    left: `${(f.x / a.aspect) * 100}%`,
    top: `${f.y * 100}%`,
    width: `${(f.w / a.aspect) * 100}%`,
    height: `${f.h * 100}%`,
    transform: `matrix(${f.matrix.join(', ')}, 0, 0)`,
  } as CSSProperties;
  return (
    <>
      <canvas ref={screen} className="phone-clip" style={style} />
      <video
        id={CLIP_ID}
        ref={video}
        className="phone-clip__source"
        muted
        playsInline
        loop
        preload="none"
        poster={CLIP_POSTER}
      />
    </>
  );
}
