import { describe, expect, it } from 'vitest';
import { simplify, trace } from './trace.mjs';

const grid = (rows) => ({
  data: Uint8Array.from(
    rows
      .join('')
      .split('')
      .map((c) => (c === '#' ? 1 : 0)),
  ),
  w: rows[0].length,
  h: rows.length,
});
const area = (loop) =>
  Math.abs(
    loop.reduce((s, [x, y], i) => {
      const [nx, ny] = loop[(i + 1) % loop.length];
      return s + x * ny - nx * y;
    }, 0),
  ) / 2;

describe('trace (the outline of a mask, as closed loops)', () => {
  it('outlines a filled square', () => {
    const loops = trace(grid(['......', '.####.', '.####.', '.####.', '.####.', '......']));
    expect(loops).toHaveLength(1);
    // through the pixel edges' midpoints: a 4×4 block outlines to a little under 16
    expect(area(loops[0])).toBeGreaterThan(12);
    expect(area(loops[0])).toBeLessThan(16);
  });

  it('gives a hole its own loop', () => {
    const loops = trace(
      grid(['.......', '.#####.', '.#####.', '.##.##.', '.#####.', '.#####.', '.......']),
    );
    expect(loops).toHaveLength(2);
  });

  it('keeps separate pieces apart, touching the edge included', () => {
    expect(trace(grid(['##..##', '##..##', '......'])).length).toBe(2);
  });
});

describe('simplify', () => {
  it('drops points on a straight run, keeps the corners', () => {
    const square = [];
    for (let i = 0; i < 10; i++) square.push([i, 0]);
    for (let i = 0; i < 10; i++) square.push([10, i]);
    for (let i = 10; i > 0; i--) square.push([i, 10]);
    for (let i = 10; i > 0; i--) square.push([0, i]);
    const s = simplify(square, 0.5);
    expect(s.length).toBeLessThanOrEqual(5);
    expect(area(s)).toBeCloseTo(100, 0);
  });
});
