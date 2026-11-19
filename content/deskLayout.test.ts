import { describe, expect, it } from 'vitest';
import {
  ART_ASPECT,
  DESK_ASPECT,
  hotspotVars,
  INTERACTIVE,
  LAYOUT,
  MIN_RENDER_WIDTH,
  type Box,
  type DeskItemId,
  type LayoutName,
} from './deskLayout';

const LAYOUTS: LayoutName[] = ['wide', 'phone'];
const ALL_ITEMS: DeskItemId[] = [
  'photo',
  'badge',
  'monitor',
  'kit',
  'phone',
  'notepad',
  'card',
  'lightbar',
  'mug',
];

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe.each(LAYOUTS)('%s layout', (name) => {
  const layout = LAYOUT[name];

  it('places every desk item', () => {
    expect(Object.keys(layout).sort()).toEqual([...ALL_ITEMS].sort());
  });

  it.each(ALL_ITEMS)('keeps %s inside the desk', (id) => {
    const b = layout[id];
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(100);
    expect(b.y + b.h).toBeLessThanOrEqual(100);
  });

  it('never overlaps two interactive items', () => {
    const clashes: string[] = [];
    INTERACTIVE.forEach((a, i) =>
      INTERACTIVE.slice(i + 1).forEach((b) => {
        if (overlaps(layout[a], layout[b])) clashes.push(`${a}/${b}`);
      }),
    );
    expect(clashes).toEqual([]);
  });

  it.each([...INTERACTIVE])('gives %s a touch target of at least 44px', (id) => {
    const W = MIN_RENDER_WIDTH[name];
    const b = layout[id];
    expect((b.w / 100) * W).toBeGreaterThanOrEqual(44);
    expect(((b.h / 100) * W) / DESK_ASPECT[name]).toBeGreaterThanOrEqual(44);
  });
});

describe('both layouts', () => {
  it.each(ALL_ITEMS)('size %s to its art aspect (no stretching)', (id) => {
    for (const n of LAYOUTS) {
      const W = 1000;
      const b = LAYOUT[n][id];
      const pxAspect = ((b.w / 100) * W) / ((b.h / 100) * (W / DESK_ASPECT[n]));
      expect(Math.abs(pxAspect / ART_ASPECT[id] - 1), `${n}/${id}`).toBeLessThanOrEqual(0.01);
    }
  });

  it('excludes the decorative mug from interaction', () => {
    expect(INTERACTIVE).not.toContain('mug');
    expect(INTERACTIVE).toContain('lightbar');
    expect(INTERACTIVE).toHaveLength(8);
  });
});

describe('hotspotVars', () => {
  it('places with transform variables only, never left or top', () => {
    const vars = hotspotVars('kit');
    expect(Object.keys(vars).some((k) => /left|top/.test(k))).toBe(false);
    expect(vars['--tx']).toBe('342.857%'); // 72 / 21 × 100
    expect(vars['--w']).toBe('21%');
    expect(vars['--rot']).toBe('4deg');
    expect(Object.keys(vars).sort()).toEqual(
      ['w', 'h', 'tx', 'ty', 'rot'].flatMap((k) => [`--${k}`, `--p-${k}`]).sort(),
    );
  });

  it.each(ALL_ITEMS)('round-trips %s to its box in both layouts', (id) => {
    const v = hotspotVars(id);
    for (const [n, pre] of [
      ['wide', '--'],
      ['phone', '--p-'],
    ] as const) {
      const b = LAYOUT[n][id];
      const num = (k: string) => parseFloat(v[`${pre}${k}` as `--${string}`]!);
      expect((num('tx') * num('w')) / 100).toBeCloseTo(b.x, 2);
      expect((num('ty') * num('h')) / 100).toBeCloseTo(b.y, 2);
      expect(num('rot')).toBe(b.rot);
    }
  });

  it('starts the wide gauge where the mock put it', () => {
    expect(LAYOUT.wide.kit).toMatchObject({ x: 72, y: 5, w: 21, rot: 4 });
  });
});
