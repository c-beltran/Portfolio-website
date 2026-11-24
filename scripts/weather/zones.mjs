// Each time zone's main city, for the weather window's rough place (lib/weather/zones.ts): the
// coordinates tzdata gives every zone (public domain), plus the legacy names browsers may still
// report, mapped to their canonical zone.
//
//   node scripts/weather/zones.mjs [zone.tab]   (default /usr/share/zoneinfo/zone.tab)
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2] ?? '/usr/share/zoneinfo/zone.tab';
const OUT = 'content/weather/zones.json';

/** Legacy name → canonical zone. */
const ALIASES = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Pacific/Truk': 'Pacific/Chuuk',
  'US/Eastern': 'America/New_York',
  'US/Central': 'America/Chicago',
  'US/Mountain': 'America/Denver',
  'US/Pacific': 'America/Los_Angeles',
  'Canada/Eastern': 'America/Toronto',
};

/** ISO 6709 ±DDMM[SS]±DDDMM[SS] → [lat, lon], 2 decimals. */
function coords(s) {
  const m = /^([+-]\d{4}(?:\d{2})?)([+-]\d{5}(?:\d{2})?)$/.exec(s);
  if (!m) throw new Error(`bad coordinates ${s}`);
  const deg = (v, d) => {
    const sign = v[0] === '-' ? -1 : 1;
    const n = v.slice(1);
    const [D, M, S] = [n.slice(0, d), n.slice(d, d + 2), n.slice(d + 2) || '0'];
    return Math.round(sign * (Number(D) + Number(M) / 60 + Number(S) / 3600) * 100) / 100;
  };
  return [deg(m[1], 2), deg(m[2], 3)];
}

const zones = {};
for (const line of readFileSync(SRC, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [, at, zone] = line.split('\t');
  zones[zone] ??= coords(at);
}
for (const [legacy, canonical] of Object.entries(ALIASES)) {
  if (!zones[canonical]) throw new Error(`no ${canonical} for ${legacy}`);
  zones[legacy] = zones[canonical];
}
const sorted = Object.fromEntries(Object.entries(zones).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify(sorted) + '\n');
console.log(`${Object.keys(sorted).length} zones → ${OUT}`);
