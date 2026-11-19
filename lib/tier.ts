/**
 * The M3b preview flag: `?tier=2` forces the live scene over the still. M3c replaces it with
 * capability detection (spec §3.2); until then no visitor loads three.js without asking.
 */
export function forcedTier(search: string): 2 | null {
  return new URLSearchParams(search).get('tier') === '2' ? 2 : null;
}
