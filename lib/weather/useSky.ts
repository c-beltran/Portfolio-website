'use client';

import { useEffect, useState } from 'react';
import { fetchWeather, overrideFrom, type Reading } from './fetchWeather';
import { dayness, sunElevation } from './sun';
import type { Place, Sky } from './types';

const CLEAR: Reading = { condition: 'clear', intensity: 0, windMs: 0, windDeg: 0 };
const OVERRIDE_DAYNESS = { day: 1, twilight: 0.5, night: 0 } as const;
const TICK_MS = 60_000;

function timeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** How much day it is now: from the sun at the place, else from the local hour. */
function daynessNow(place: Place | null): number {
  const now = new Date();
  if (place) return dayness(sunElevation(place, now));
  const h = now.getHours();
  return h >= 6 && h < 18 ? 1 : 0;
}

/**
 * The sky outside the window, once `enabled` (the page is idle): the visitor's current weather at
 * their time zone's main city, or a clear sky when that can't be had. Day and night follow the sun
 * there, rechecked every minute. `?weather=…&time=…` forces either. Null until it is known. Mirrors
 * itself on <html> (data-sky, data-sky-source, data-dayness).
 */
export function useSky(enabled: boolean): Sky | null {
  const [sky, setSky] = useState<Sky | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const forced = overrideFrom(location.search);
      let place: Place | null = null;
      try {
        place = (await import('./zones')).placeFor(timeZone());
      } catch {
        place = null;
      }
      const reading = forced.condition
        ? { ...CLEAR, condition: forced.condition, intensity: 0.75 }
        : place
          ? await fetchWeather(place)
          : null;
      if (!live) return;
      const source: Sky['source'] = forced.condition ? 'override' : reading ? 'live' : 'fallback';
      const day = () =>
        forced.time !== undefined ? OVERRIDE_DAYNESS[forced.time] : daynessNow(place);
      const base = reading ?? CLEAR;
      setSky({ ...base, dayness: day(), source });
      timer = setInterval(() => setSky((s) => (s ? { ...s, dayness: day() } : s)), TICK_MS);
    })();
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [enabled]);

  useEffect(() => {
    if (!sky) return;
    const d = document.documentElement.dataset;
    d.sky = sky.condition;
    d.skySource = sky.source;
    d.dayness = sky.dayness.toFixed(2);
  }, [sky]);

  return sky;
}
