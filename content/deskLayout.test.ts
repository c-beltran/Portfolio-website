import { describe, expect, it } from 'vitest';
import {
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
  'laptop',
  'gauge',
  'phone',
  'note',
  'card',
  'lamp',
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
  it.each(ALL_ITEMS)('keep the pixel aspect of %s within 2%%', (id) => {
    const aspect = (n: LayoutName) => (LAYOUT[n][id].w * DESK_ASPECT[n]) / LAYOUT[n][id].h;
    expect(Math.abs(aspect('wide') / aspect('phone') - 1)).toBeLessThanOrEqual(0.02);
  });

  it('excludes the decorative mug from interaction', () => {
    expect(INTERACTIVE).not.toContain('mug');
    expect(INTERACTIVE).toContain('lamp');
    expect(INTERACTIVE).toHaveLength(8);
  });
});

describe('hotspotVars', () => {
  it('places with transform variables only, never left or top', () => {
    const vars = hotspotVars('gauge');
    expect(Object.keys(vars).some((k) => /left|top/.test(k))).toBe(false);
    const g = LAYOUT.wide.gauge;
    expect(vars['--tx']).toBe(`${((g.x / g.w) * 100).toFixed(3)}%`);
    expect(vars['--w']).toBe(`${g.w}%`);
    expect(vars['--rot']).toBe(`${g.rot}deg`);
    const p = LAYOUT.phone.gauge;
    expect(vars['--p-ty']).toBe(`${((p.y / p.h) * 100).toFixed(3)}%`);
  });

  it('starts the wide gauge where the mock put it', () => {
    expect(LAYOUT.wide.gauge).toMatchObject({ x: 72, y: 5, w: 21, rot: 4 });
  });
});
