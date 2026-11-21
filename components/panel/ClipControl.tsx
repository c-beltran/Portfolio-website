'use client';

import { useEffect, useState } from 'react';
import { CLIP_ID } from '../desk/PhoneClip';

const clip = () => document.getElementById(CLIP_ID) as HTMLVideoElement | null;

/**
 * Pause and Play for the phone's clip (WCAG 2.2.2: it moves for more than 5 s). It lives in the
 * panel because the opened phone is decorative and hidden from assistive tech; the label follows
 * the video's own play and pause events.
 */
export function ClipControl() {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const sync = (e?: Event) => {
      if (e && (e.target as Element | null)?.id !== CLIP_ID) return;
      const v = clip();
      setPlaying(!!v && !v.paused);
    };
    sync();
    // Media events don't bubble, but a capturing listener on the document still sees them.
    document.addEventListener('play', sync, true);
    document.addEventListener('pause', sync, true);
    return () => {
      document.removeEventListener('play', sync, true);
      document.removeEventListener('pause', sync, true);
    };
  }, []);
  const toggle = () => {
    const v = clip();
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };
  return (
    <p className="panel__clip">
      <button type="button" className="panel__clip-button" onClick={toggle}>
        {playing ? 'Pause the clip' : 'Play the clip'}
      </button>
    </p>
  );
}
