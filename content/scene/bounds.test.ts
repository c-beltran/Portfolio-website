import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collidingPairs, minCollisionFreeWidth, type Box, type SceneBounds } from './bounds';

const OBJECTS = [
  'obj_monitor',
  'obj_kit',
  'obj_phone',
  'obj_badge',
  'obj_photo',
  'obj_notepad',
  'obj_card',
  'obj_lightbar',
] as const;

const ASPECT = 1440 / 2560;

describe('minCollisionFreeWidth', () => {
  it('is small for two small boxes far apart', () => {
    const boxes: Record<string, Box> = {
      a: { x0: 0.1, y0: 0.1, x1: 0.12, y1: 0.12 },
      b: { x0: 0.8, y0: 0.8, x1: 0.82, y1: 0.82 },
    };
    // The 44 px hotspots meet when 44 px > 0.68 W (x gap plus one box), i.e. below ~65 px.
    const w = minCollisionFreeWidth(boxes, ASPECT);
    expect(w).not.toBeNull();
    expect(w!).toBeLessThan(120);
    expect(collidingPairs(boxes, w!, ASPECT)).toEqual([]);
    expect(collidingPairs(boxes, w! - 1, ASPECT)).not.toEqual([]);
  });

  it('is null when two objects overlap on screen at every width', () => {
    const boxes: Record<string, Box> = {
      a: { x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.5 },
      b: { x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.6 },
    };
    expect(minCollisionFreeWidth(boxes, ASPECT)).toBeNull();
    expect(collidingPairs(boxes, 4000, ASPECT)).toEqual([['a', 'b']]);
  });

  it('grows a 2 px-wide box to 44 px around its centre', () => {
    const boxes: Record<string, Box> = {
      a: { x0: 0.5, y0: 0.5, x1: 0.502, y1: 0.502 },
      b: { x0: 0.54, y0: 0.49, x1: 0.56, y1: 0.51 },
    };
    // At 1000 px: a is 2 px wide at x 500, grows to 479..523; b starts at 540. Free.
    expect(collidingPairs(boxes, 1000, ASPECT)).toEqual([]);
    // At 500 px: a grows to 228.5..272.5; b is 270..280. They touch.
    expect(collidingPairs(boxes, 500, ASPECT)).toEqual([['a', 'b']]);
  });
});

describe('content/scene/bounds.json', () => {
  const path = new URL('./bounds.json', import.meta.url);

  it('exists (written by scripts/scene/export_bounds.py)', () => {
    expect(existsSync(path)).toBe(true);
  });

  const data = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as SceneBounds) : null;

  it('has a box for every interactive object, inside the frame', () => {
    expect(Object.keys(data!.objects).sort()).toEqual([...OBJECTS].sort());
    for (const [name, b] of Object.entries(data!.objects)) {
      for (const v of [b.x0, b.y0, b.x1, b.y1]) {
        expect(v, name).toBeGreaterThanOrEqual(0);
        expect(v, name).toBeLessThanOrEqual(1);
      }
      expect(b.x1, name).toBeGreaterThan(b.x0);
      expect(b.y1, name).toBeGreaterThan(b.y0);
    }
  });

  it('records the minCollisionFreeWidth its boxes give', () => {
    expect(data!.camera).toBe('cam_overview');
    expect(data!.aspect).toBeCloseTo(ASPECT, 6);
    expect(data!.minCollisionFreeWidth).toBe(minCollisionFreeWidth(data!.objects, data!.aspect));
  });
});
