import { conditionFor } from './conditions';
import type { Condition, Place, Sky } from './types';

export const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
/** Past this, the window settles for a clear sky. */
export const TIMEOUT_MS = 4000;
/** One request per visit, more or less: an answer is kept this long. */
export const CACHE_MS = 30 * 60 * 1000;
export const CACHE_KEY = 'desk-weather';

export type Reading = Omit<Sky, 'dayness' | 'source'>;
type Cached = { at: number; place: [number, number]; reading: Reading };

export function weatherUrl(p: Place): string {
  const q = new URLSearchParams({
    latitude: String(p.lat),
    longitude: String(p.lon),
    current: 'weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
    wind_speed_unit: 'ms',
  });
  return `${WEATHER_URL}?${q}`;
}

/** The browser's sessionStorage, or null where there is none or even touching it throws. */
function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

/** A reading the window can draw: a known condition and finite numbers (a cache may hold junk). */
function valid(r: unknown): r is Reading {
  const o = r as Record<string, unknown> | null;
  return (
    !!o &&
    CONDITIONS.includes(o.condition as Condition) &&
    ['intensity', 'windMs', 'windDeg'].every((k) => Number.isFinite(o[k]))
  );
}

const samePlace = (a: [number, number], p: Place) => a[0] === p.lat && a[1] === p.lon;

function cached(storage: Storage | null, p: Place, now: number): Reading | null {
  try {
    const raw = storage?.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    const age = now - c.at;
    return age >= 0 &&
      age < CACHE_MS &&
      Array.isArray(c.place) &&
      samePlace(c.place, p) &&
      valid(c.reading)
      ? c.reading
      : null;
  } catch {
    return null;
  }
}

function keep(storage: Storage | null, p: Place, now: number, reading: Reading) {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify({ at: now, place: [p.lat, p.lon], reading }));
  } catch {
    // Storage blocked: ask again next visit.
  }
}

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * The current weather at a place, from Open-Meteo (no key), or null when it can't be had: no
 * answer within TIMEOUT_MS, an error, or a code the window has no picture for. Never throws.
 */
export async function fetchWeather(
  p: Place,
  o: { fetch?: typeof fetch; now?: number; storage?: Storage | null } = {},
): Promise<Reading | null> {
  const now = o.now ?? Date.now();
  const storage = o.storage !== undefined ? o.storage : sessionStore();
  const hit = cached(storage, p, now);
  if (hit) return hit;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await (o.fetch ?? fetch)(weatherUrl(p), { signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { current?: Record<string, unknown> };
    const c = body?.current;
    const read = c && typeof c.weather_code === 'number' ? conditionFor(c.weather_code) : null;
    if (!read) return null;
    const reading: Reading = {
      ...read,
      windMs: num(c!.wind_speed_10m, 0),
      windDeg: num(c!.wind_direction_10m, 0),
    };
    keep(storage, p, now, reading);
    return reading;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const CONDITIONS: Condition[] = ['clear', 'partly', 'overcast', 'fog', 'rain', 'snow', 'storm'];
const TIMES = ['day', 'twilight', 'night'] as const;

/** `?weather=<condition>&time=day|twilight|night`, for review shots and tests. Junk is ignored. */
export function overrideFrom(search: string): {
  condition?: Condition;
  time?: (typeof TIMES)[number];
} {
  const q = new URLSearchParams(search);
  const c = q.get('weather') as Condition | null;
  const t = q.get('time') as (typeof TIMES)[number] | null;
  return {
    ...(c && CONDITIONS.includes(c) ? { condition: c } : {}),
    ...(t && TIMES.includes(t) ? { time: t } : {}),
  };
}
