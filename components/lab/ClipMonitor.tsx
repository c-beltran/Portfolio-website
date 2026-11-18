'use client';

import { useEffect, useRef } from 'react';
import type { Framing, View } from './transition';

/**
 * The pre-rendered way: plays the Cycles transition clip for the move (in: overview → monitor,
 * out: the reverse), resting on its last frame. Reports each presented video frame's time.
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
  const video = useRef<HTMLVideoElement>(null);
  const last = useRef<View>(view);

  useEffect(() => {
    const v = video.current;
    if (!v || view === last.current) return;
    last.current = view;
    v.src = `/lab/monitor-${framing}-${view === 'monitor' ? 'in' : 'out'}.mp4`;
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

  return (
    <video
      ref={video}
      className="lab__media"
      muted
      playsInline
      preload="auto"
      poster={`/lab/still-${framing}.webp`}
      aria-label="Pre-rendered transition"
    />
  );
}
