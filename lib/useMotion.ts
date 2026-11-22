'use client';

import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'desk-motion-paused';
const listeners = new Set<() => void>();
let paused: boolean | null = null;

function read(): boolean {
  if (paused !== null) return paused;
  try {
    paused = sessionStorage.getItem(KEY) === '1';
  } catch {
    paused = false; // storage blocked: the choice lasts for this page only
  }
  return paused;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/**
 * The one pause for motion that starts by itself and doesn't end (WCAG 2.2.2): the mug's steam,
 * and any looping screen. The choice lasts the visit. `ready` is false on the server and until
 * hydration, so a page without JavaScript gets no dead control.
 */
export function useMotion(): { ready: boolean; paused: boolean; toggle: () => void } {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const value = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => {
    paused = !read();
    try {
      sessionStorage.setItem(KEY, paused ? '1' : '0');
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    listeners.forEach((f) => f());
  }, []);
  return { ready, paused: value, toggle };
}
