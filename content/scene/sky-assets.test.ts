import { existsSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import seat from './bounds-seat.json';
import rect from './sky-mask.json';
import { master } from './framing';

type Pt = [number, number];
const quad = (seat as unknown as { quads: { sky: Pt[] } }).quads.sky;
const uv = (seat as unknown as { skyUv: Record<'u0' | 'v0' | 'u1' | 'v1', number> }).skyUv;

function inside([px, py]: Pt, q: Pt[]) {
  let sign = 0;
  for (let i = 0; i < q.length; i++) {
    const [ax, ay] = q[i]!;
    const [bx, by] = q[(i + 1) % q.length]!;
    const c = Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax));
    if (c && sign && c !== sign) return false;
    sign ||= c;
  }
  return true;
}

describe("the window's patch of sky", () => {
  it('is four corners, top-left round to bottom-left, reaching at most a little past the frame', () => {
    expect(quad).toHaveLength(4);
    for (const [x, y] of quad) {
      expect(x).toBeGreaterThan(-2);
      expect(x).toBeLessThan(3);
      expect(y).toBeGreaterThan(-2);
      expect(y).toBeLessThan(3);
    }
    const [tl, tr, br, bl] = quad;
    expect(tl![0]).toBeLessThan(tr![0]);
    expect(bl![0]).toBeLessThan(br![0]);
    expect(Math.max(tl![1], tr![1])).toBeLessThan(Math.min(bl![1], br![1]));
  });

  it('holds the whole glass mask', () => {
    for (const p of [
      [rect.x0 + 0.001, rect.y0 + 0.001],
      [rect.x1 - 0.001, rect.y0 + 0.001],
      [(rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2],
    ] as Pt[])
      expect(inside(p, quad), String(p)).toBe(true);
  });

  it('has its place on the sky plane', () => {
    expect(0).toBeLessThanOrEqual(uv.u0);
    expect(uv.u0).toBeLessThan(uv.u1);
    expect(uv.u1).toBeLessThanOrEqual(1);
    expect(0).toBeLessThanOrEqual(uv.v0);
    expect(uv.v0).toBeLessThan(uv.v1);
    expect(uv.v1).toBeLessThanOrEqual(1);
  });
});

describe('the glass mask', () => {
  const file = 'public/weather/sky-mask.webp';

  it('is small', () => {
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThanOrEqual(20_000);
  });

  it('has the shape of its place on the master', async () => {
    const { width, height } = await sharp(file).metadata();
    const { w: mw, h: mh } = master();
    const want = ((rect.x1 - rect.x0) * mw) / ((rect.y1 - rect.y0) * mh);
    expect(Math.abs(width! / height! / want - 1)).toBeLessThan(0.02);
  });
});
