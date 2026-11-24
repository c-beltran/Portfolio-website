'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { LAMP_STORAGE_KEY, renderFor, type Lamp, type Render, type Time } from './light';

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-time', 'data-lamp', 'data-theme'],
  });
  return () => observer.disconnect();
}

const time = (): Time => (document.documentElement.dataset.time === 'night' ? 'night' : 'day');
const lamp = (): Lamp => (document.documentElement.dataset.lamp === 'on' ? 'on' : 'off');
const render = (): Render => (document.documentElement.dataset.theme === 'lamp' ? 'lamp' : 'day');

/**
 * The room's light lives on <html> (set before first paint by LIGHT_SCRIPT). Every lamp control
 * reads it here, so the header button and the desk lamp can never disagree.
 */
export function useLight(): { time: Time; lamp: Lamp; render: Render; toggleLamp: () => void } {
  const t = useSyncExternalStore(subscribe, time, () => 'day' as Time);
  const l = useSyncExternalStore(subscribe, lamp, () => 'off' as Lamp);
  const r = useSyncExternalStore(subscribe, render, () => 'day' as Render);
  const toggleLamp = useCallback(() => {
    const next: Lamp = lamp() === 'on' ? 'off' : 'on';
    const el = document.documentElement;
    el.dataset.lamp = next;
    el.dataset.theme = renderFor(time(), next);
    try {
      sessionStorage.setItem(LAMP_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode): the choice lasts for this page only.
    }
  }, []);
  return { time: t, lamp: l, render: r, toggleLamp };
}
