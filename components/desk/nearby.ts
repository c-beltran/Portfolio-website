/**
 * The object whose centre is nearest the point, within the radius (design 2026-11-19 §3.3, labels
 * where you look); null when none is that close. Ties go to the first key.
 */
export function nearby(
  centres: Record<string, [number, number]>,
  p: [number, number],
  radius: number,
): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const [key, [x, y]] of Object.entries(centres)) {
    const d = Math.hypot(x - p[0], y - p[1]);
    if (d <= radius && (best === null || d < bestD)) {
      best = key;
      bestD = d;
    }
  }
  return best;
}
