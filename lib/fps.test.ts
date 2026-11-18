import { describe, expect, it } from 'vitest';
import { summarize } from './fps';

describe('summarize', () => {
  it('reads 60 fps from steady 16.67 ms frames', () => {
    const s = summarize(Array(60).fill(1000 / 60));
    expect(s.frames).toBe(60);
    expect(s.avgFps).toBeCloseTo(60, 1);
    expect(s.minFps).toBeCloseTo(60, 1);
  });

  it('takes the minimum from the worst single frame', () => {
    const s = summarize([...Array(59).fill(1000 / 60), 50]);
    expect(s.minFps).toBeCloseTo(20, 1);
    expect(s.avgFps).toBeLessThan(60);
    expect(s.avgFps).toBeGreaterThan(55);
  });

  it('is all zeros with no frames', () => {
    expect(summarize([])).toEqual({ avgFps: 0, minFps: 0, frames: 0 });
  });
});
