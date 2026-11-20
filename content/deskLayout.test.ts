import { describe, expect, it } from 'vitest';
import {
  HOTSPOT_STACK,
  hotspotVars,
  INTERACTIVE,
  LAYOUT,
  PORTRAIT,
  type DeskItemId,
} from './deskLayout';
import { collidingPairs, type SceneBounds } from './scene/bounds';
import seat from './scene/bounds-seat.json';
import { master, PORTRAIT as FRAMING_PORTRAIT, visible } from './scene/framing';

const BOUNDS = seat as SceneBounds;
const ITEMS: DeskItemId[] = [
  'photo',
  'badge',
  'monitor',
  'kit',
  'phone',
  'notepad',
  'card',
  'lightbar',
];
/** Front object first: the smaller, nearer one stacks over the one behind it. */
const IN_FRONT: [DeskItemId, DeskItemId][] = [
  ['lightbar', 'monitor'],
  ['badge', 'kit'],
];
/** Pixels per safe height in a W×H window. */
const uFor = (W: number, H: number) => H / ((visible(W / H).y1 - visible(W / H).y0) * master().h);

describe('the seat layout', () => {
  it.each(ITEMS)('puts %s on its projected box (percent of the master)', (id) => {
    const b = BOUNDS.objects[`obj_${id}`]!;
    const box = LAYOUT[id];
    expect(box.x).toBeCloseTo(b.x0 * 100, 2);
    expect(box.y).toBeCloseTo(b.y0 * 100, 2);
    expect(box.w).toBeCloseTo((b.x1 - b.x0) * 100, 2);
    expect(box.h).toBeCloseTo((b.y1 - b.y0) * 100, 2);
  });

  it('stacks the front object over the back one in every overlap, narrowest window to 4K', () => {
    const boxes = Object.fromEntries(ITEMS.map((id) => [id, BOUNDS.objects[`obj_${id}`]!]));
    const [lo, hi] = [master().w * uFor(500, 416), master().w * uFor(3840, 2160)];
    for (let w = Math.floor(lo); w <= hi; w += 4) {
      for (const [a, b] of collidingPairs(boxes, w, BOUNDS.aspect)) {
        const pair = IN_FRONT.find(([f, k]) => (f === a && k === b) || (f === b && k === a));
        expect(pair, `${a}×${b} at ${w}px has no stacking rule`).toBeDefined();
      }
    }
  });

  it('uses the framing model’s portrait query', () => {
    expect(PORTRAIT).toBe(FRAMING_PORTRAIT);
  });
});

describe('stacking', () => {
  it.each(IN_FRONT)('%s stacks over %s', (front, back) => {
    expect(HOTSPOT_STACK[front]).toBeGreaterThan(HOTSPOT_STACK[back]);
  });
});

describe('the clickable items', () => {
  it('are the seven section objects plus the light bar', () => {
    expect([...INTERACTIVE].sort()).toEqual([...ITEMS].sort());
  });
});

describe('hotspotVars', () => {
  it('places with transform variables only, never left or top', () => {
    const vars = hotspotVars('kit');
    expect(Object.keys(vars).sort()).toEqual(['--cx', '--cy', '--h', '--w', '--z']);
  });

  it.each(ITEMS)('centres %s on its box', (id) => {
    const v = hotspotVars(id);
    const b = LAYOUT[id];
    const num = (k: string) => parseFloat(v[`--${k}` as `--${string}`]!);
    expect(num('cx')).toBeCloseTo(b.x + b.w / 2, 2);
    expect(num('cy')).toBeCloseTo(b.y + b.h / 2, 2);
    expect(num('w')).toBeCloseTo(b.w, 2);
    expect(num('h')).toBeCloseTo(b.h, 2);
    expect(v['--z']).toBe(String(HOTSPOT_STACK[id]));
  });
});
