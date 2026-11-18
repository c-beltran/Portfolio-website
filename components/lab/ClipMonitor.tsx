'use client';

import { useEffect, useRef } from 'react';
import type { Framing, View } from './transition';

type Dir = 'in' | 'out';

/**
 * The pre-rendered way: plays the Cycles transition clip for the move (in: overview → monitor,
 * out: the reverse), resting on its last frame. Both clips are preloaded in their own element so
 * a click starts playback at once. Swapping which one is shown is seamless: each clip's first frame
 * is the other's last. Reports each presented video frame's time.
 */
export default function ClipMonitor({
  view,
  framing,
  onMove,
  onFrame,
}: {
  view: View;
  framing: Framing;
  onMove: (moving: boolean) => void;
  onFrame: (t: number) => void;
}) {
  const inRef = useRef<HTMLVideoElement>(null);
  const outRef = useRef<HTMLVideoElement>(null);
  const last = useRef<View>(view);

  useEffect(() => {
    if (view === last.current) return;
    last.current = view;
    const dir: Dir = view === 'monitor' ? 'in' : 'out';
    const v = (dir === 'in' ? inRef : outRef).current;
    const other = (dir === 'in' ? outRef : inRef).current;
    if (!v || !other) return;
    v.currentTime = 0;
    v.style.visibility = 'visible';
    other.style.visibility = 'hidden';
    let handle = 0;
    const tick = (now: number) => {
      onFrame(now);
      handle = v.requestVideoFrameCallback(tick);
    };
    const done = () => {
      v.cancelVideoFrameCallback(handle);
      onMove(false);
    };
    onMove(true);
    v.addEventListener('ended', done, { once: true });
    handle = v.requestVideoFrameCallback(tick);
    void v.play();
    return () => {
      v.removeEventListener('ended', done);
      v.cancelVideoFrameCallback(handle);
    };
  }, [view, framing, onMove, onFrame]);

  return (['in', 'out'] as const).map((dir) => (
    <video
      key={dir}
      ref={dir === 'in' ? inRef : outRef}
      className="lab__media"
      style={{ visibility: 'hidden' }}
      src={`/lab/monitor-${framing}-${dir}.mp4`}
      muted
      playsInline
      preload="auto"
      aria-label={`Pre-rendered transition (${dir})`}
    />
  ));
}
