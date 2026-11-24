/**
 * The preview flag: `?tier=2` forces the live scene over the still. Until capability
 * detection replaces it, no visitor loads three.js without asking.
 */
export function forcedTier(search: string): 2 | null {
  return new URLSearchParams(search).get('tier') === '2' ? 2 : null;
}
