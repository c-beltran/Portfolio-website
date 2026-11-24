import type { Condition } from './types';

type Reading = { condition: Condition; intensity: number };

/** WMO weather codes (as Open-Meteo reports them) → what the window shows, and how much of it. */
const CODES: Record<number, Reading> = {
  0: { condition: 'clear', intensity: 0 },
  1: { condition: 'clear', intensity: 0.2 },
  2: { condition: 'partly', intensity: 0.5 },
  3: { condition: 'overcast', intensity: 1 },
  45: { condition: 'fog', intensity: 1 },
  48: { condition: 'fog', intensity: 1 },
  // Drizzle, light to dense, and freezing drizzle: light rain.
  ...Object.fromEntries(
    [51, 53, 55, 56, 57].map((c) => [c, { condition: 'rain', intensity: 0.35 }]),
  ),
  61: { condition: 'rain', intensity: 0.5 },
  63: { condition: 'rain', intensity: 0.75 },
  65: { condition: 'rain', intensity: 1 },
  66: { condition: 'rain', intensity: 0.75 },
  67: { condition: 'rain', intensity: 1 },
  80: { condition: 'rain', intensity: 0.5 },
  81: { condition: 'rain', intensity: 0.75 },
  82: { condition: 'rain', intensity: 1 },
  71: { condition: 'snow', intensity: 0.4 },
  73: { condition: 'snow', intensity: 0.7 },
  75: { condition: 'snow', intensity: 1 },
  77: { condition: 'snow', intensity: 0.3 },
  85: { condition: 'snow', intensity: 0.4 },
  86: { condition: 'snow', intensity: 1 },
  95: { condition: 'storm', intensity: 0.8 },
  96: { condition: 'storm', intensity: 1 },
  99: { condition: 'storm', intensity: 1 },
};

export function conditionFor(code: number): Reading | null {
  return Object.hasOwn(CODES, code) ? { ...CODES[code]! } : null;
}
