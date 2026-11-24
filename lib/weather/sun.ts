import type { Place } from './types';

const RAD = Math.PI / 180;

/**
 * The sun's elevation above the horizon, in degrees, at a place and moment (NOAA's simplified
 * solar position: good to well under a degree, plenty for day, twilight and night).
 */
export function sunElevation(place: Place, date: Date): number {
  const jd = date.getTime() / 86_400_000 + 2_440_587.5;
  const t = (jd - 2_451_545) / 36_525;
  const L0 = (280.46646 + t * (36_000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35_999.05029 - 0.0001537 * t);
  const C =
    Math.sin(M * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * M * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  // The equation of time, in minutes.
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const eot =
    (4 / RAD) *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const solar = (((minutes + eot + 4 * place.lon) % 1440) + 1440) % 1440;
  const hour = (solar / 4 - 180) * RAD;
  const lat = place.lat * RAD;
  const cosZenith =
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hour);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cosZenith))) / RAD;
}

/** How much day it is: 1 with the sun up, 0 once it is 6° below the horizon, a blend between. */
export function dayness(elevationDeg: number): number {
  return Math.max(0, Math.min(1, (elevationDeg + 6) / 6));
}
