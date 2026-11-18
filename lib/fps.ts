/** Frame-rate summary of a run of frame intervals (ms), e.g. during one camera move. */
export function summarize(frameTimesMs: number[]): {
  avgFps: number;
  minFps: number;
  frames: number;
} {
  const n = frameTimesMs.length;
  if (n === 0) return { avgFps: 0, minFps: 0, frames: 0 };
  const total = frameTimesMs.reduce((a, b) => a + b, 0);
  return { avgFps: (1000 * n) / total, minFps: 1000 / Math.max(...frameTimesMs), frames: n };
}
