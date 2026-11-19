import { describe, expect, it } from 'vitest';
import {
  DESK_ASPECT,
  HOTSPOT_STACK,
  hotspotVars,
  INTERACTIVE,
  LAYOUT,
  MIN_RENDER_WIDTH,
  type DeskItemId,
  type LayoutName,
} from './deskLayout';
import { collidingPairs, type SceneBounds } from './scene/bounds';
import wideBounds from './scene/bounds.json';
import phoneBounds from './scene/bounds-phone.json';

const LAYOUTS: LayoutName[] = ['wide', 'phone'];
const BOUNDS: Record<LayoutName, SceneBounds> = {
  wide: wideBounds as SceneBounds,
  phone: phoneBounds as SceneBounds,
};
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
  ['kit', 'monitor'],
  ['photo', 'monitor'],
];

describe.each(LAYOUTS)('%s layout', (name) => {
  it.each(ITEMS)('puts %s on its projected box', (id) => {
    const b = BOUNDS[name].objects[`obj_${id}`]!;
    const box = LAYOUT[name][id];
    expect(box.x).toBeCloseTo(b.x0 * 100, 2);
    expect(box.y).toBeCloseTo(b.y0 * 100, 2);
    expect(box.w).toBeCloseTo((b.x1 - b.x0) * 100, 2);
    expect(box.h).toBeCloseTo((b.y1 - b.y0) * 100, 2);
  });

  it('has the still aspect', () => {
    expect(DESK_ASPECT[name]).toBeCloseTo(1 / BOUNDS[name].aspect, 6);
  });

  it('stacks the front object over the back one in every overlap', () => {
    const boxes = Object.fromEntries(ITEMS.map((id) => [id, BOUNDS[name].objects[`obj_${id}`]!]));
    for (let w = MIN_RENDER_WIDTH[name]; w <= 2560; w += 4) {
      for (const [a, b] of collidingPairs(boxes, w, BOUNDS[name].aspect)) {
        const pair = IN_FRONT.find(([f, k]) => (f === a && k === b) || (f === b && k === a));
        expect(pair, `${a}×${b} at ${w}px has no stacking rule`).toBeDefined();
      }
    }
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
    expect(Object.keys(vars).some((k) => /left|top/.test(k))).toBe(false);
    expect(Object.keys(vars).sort()).toEqual(
      [...['cx', 'cy', 'w', 'h'].flatMap((k) => [`--${k}`, `--p-${k}`]), '--z'].sort(),
    );
  });

  it.each(ITEMS)('centres %s on its box in both layouts', (id) => {
    const v = hotspotVars(id);
    for (const [n, pre] of [
      ['wide', '--'],
      ['phone', '--p-'],
    ] as const) {
      const b = LAYOUT[n][id];
      const num = (k: string) => parseFloat(v[`${pre}${k}` as `--${string}`]!);
      expect(num('cx')).toBeCloseTo(b.x + b.w / 2, 2);
      expect(num('cy')).toBeCloseTo(b.y + b.h / 2, 2);
      expect(num('w')).toBeCloseTo(b.w, 2);
      expect(num('h')).toBeCloseTo(b.h, 2);
    }
    expect(v['--z']).toBe(String(HOTSPOT_STACK[id]));
  });
});
