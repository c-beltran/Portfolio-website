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
 * Power Walk on the opened phone's screen (design 2026-11-19 §4.2): muted, looped, laid onto the
 * screen quad of the render (opened-art.json) by an affine fit, near exact because the screen faces
 * the eye. Its source is set only while it's mounted and never autoplays under reduced motion;
 * going back pauses it at once and drops the source, so nothing keeps downloading or decoding.
 */
export function PhoneClip({ leaving }: { leaving?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.src = SRC;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) void v.play().catch(() => {});
    return () => {
      v.pause();
      v.removeAttribute('src');
      v.load();
    };
  }, []);
  useEffect(() => {
    if (leaving) ref.current?.pause();
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
    <video
      id={CLIP_ID}
      ref={ref}
      className="phone-clip"
      muted
      playsInline
      loop
      preload="none"
      poster={CLIP_POSTER}
      style={style}
    />
  );
}
