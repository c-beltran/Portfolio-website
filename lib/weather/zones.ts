import table from '@/content/weather/zones.json';
import type { Place } from './types';

const ZONES = table as unknown as Record<string, [number, number]>;

/**
 * The visitor's time zone's main city (tzdata's coordinates for the zone), or null for a zone with
 * no place (UTC, Etc/*) or one the table doesn't know. Loaded with the weather, never up front.
 */
export function placeFor(timeZone: string | undefined): Place | null {
  const at = timeZone ? ZONES[timeZone] : undefined;
  return at ? { lat: at[0], lon: at[1] } : null;
}
