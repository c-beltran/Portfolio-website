'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PORTRAIT } from '@/content/deskLayout';
import { forcedTier } from '@/lib/tier';
import { useTheme } from '@/lib/useTheme';
import type { Framing } from './transition';

// Client-only, and only fetched once LiveLayer decides to mount it (spec §4).
const LiveScene = dynamic(() => import('./LiveScene'), { ssr: false });

function subscribe(onChange: () => void) {
  const mq = matchMedia(PORTRAIT);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
const framing = (): Framing => (matchMedia(PORTRAIT).matches ? 'phone' : 'desktop');

const hasWebGL2 = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

/**
 * The live scene over the still and under the hotspots (M3b preview, `?tier=2`). It mounts on
 * browser idle, fades in once its first frame is ready, and steps aside on context loss, so the
 * still is always there underneath. It never takes a pointer event.
 */
export function LiveLayer() {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const { theme } = useTheme();
  const view = useSyncExternalStore(subscribe, framing, () => 'desktop' as Framing);
  const ref = useRef<HTMLDivElement>(null);

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

  // Context loss: unmount and leave the still. Capture, since the event doesn't bubble.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lost = () => {
      setOn(false);
      setReady(false);
    };
    el.addEventListener('webglcontextlost', lost, true);
    return () => el.removeEventListener('webglcontextlost', lost, true);
  }, [on]);

  const onReady = useCallback(() => setReady(true), []);

  if (!on) return null;
  return (
    <div ref={ref} className="desk-still__live" data-ready={ready} data-lamp={theme === 'lamp'}>
      <LiveScene view="overview" framing={view} lamp={theme === 'lamp'} onReady={onReady} />
    </div>
  );
}
