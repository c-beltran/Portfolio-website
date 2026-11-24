'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { forcedTier } from '@/lib/tier';
import { useLight } from '@/lib/useLight';
import type { Sky } from '@/lib/weather/types';
import type { OpenedId } from '@/content/opened';

// Client-only, and only fetched once LiveLayer decides to mount it.
const LiveScene = dynamic(() => import('./LiveScene'), { ssr: false });

/**
 * Any failure inside the scene (no context after all, a missing GLB or texture, a shader error)
 * unmounts it and leaves the still (any 3D failure falls back to Tier 1).
 */
class Fallback extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const hasWebGL2 = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

/**
 * The live seat over the still and under the hotspots (`?tier=2`), the size of the window: in a
 * portrait window it stays put while the desk scrolls under it (globals.css). It mounts on
 * browser idle, fades in once its first frame is ready, and steps aside on context loss, so the
 * still is always there underneath. It never takes a pointer event.
 */
export function LiveLayer({
  open = null,
  sky = null,
}: {
  open?: OpenedId | null;
  sky?: Sky | null;
}) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const { render, lamp, time } = useLight();
  const ref = useRef<HTMLDivElement>(null);
  // ?tier=2&capture=master: the residual's capture (scripts/scene/measure/residual.mjs).
  const [capture] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(location.search).get('capture') === 'master',
  );

  useEffect(() => {
    if (forcedTier(location.search) !== 2 || !hasWebGL2()) return;
    const mount = () => setOn(true);
    // Safari has no requestIdleCallback.
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(mount);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(mount, 200);
    return () => clearTimeout(id);
  }, []);

  const lost = useCallback(() => {
    setOn(false);
    setReady(false);
  }, []);

  // Context loss: unmount and leave the still. Capture, since the event doesn't bubble.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('webglcontextlost', lost, true);
    return () => el.removeEventListener('webglcontextlost', lost, true);
  }, [on, lost]);

  const onReady = useCallback(() => setReady(true), []);

  if (!on) return null;
  return (
    <div ref={ref} className="desk-still__live" data-ready={ready} data-lamp={render === 'lamp'}>
      <Fallback onError={lost}>
        <LiveScene
          lamp={render === 'lamp'}
          light={{ lamp, time }}
          sky={sky}
          onReady={onReady}
          capture={capture}
          open={open}
        />
      </Fallback>
    </div>
  );
}
