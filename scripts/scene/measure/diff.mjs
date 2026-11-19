/**
 * How far apart two images are, from raw RGB buffers of the same size (8-bit, 3 channels).
 * meanAbs: the mean absolute channel difference (0–255). over40: the share of channels off by
 * more than 40, i.e. clearly visible.
 */
export function diff(a, b) {
  if (a.length !== b.length) throw new Error(`size mismatch: ${a.length} vs ${b.length}`);
  let sum = 0;
  let over = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > 40) over++;
  }
  return { meanAbs: sum / a.length, over40: over / a.length };
}
