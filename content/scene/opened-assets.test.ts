import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOVER_IDS } from '../opened';

/**
 * What an object that comes forward loads on demand, never on the
 * first load: the phone's clip (≤ 1 MB), and each object's Tier 2 opened bakes, day plus
 * lamp, within 400 kB.
 */
const BAKE = join(process.cwd(), 'public/opened/bake');
const CAP = 400 * 1024;

const CLIPS = join(process.cwd(), 'public/clips');

describe('the phone clip', () => {
  it('is an MP4 of at most 1 MB, with its poster', () => {
    const clip = join(CLIPS, 'power-walk.mp4');
    expect(existsSync(clip)).toBe(true);
    expect(statSync(clip).size).toBeLessThanOrEqual(1024 * 1024);
    expect(existsSync(join(CLIPS, 'power-walk-poster.webp'))).toBe(true);
  });
});

describe('on-demand opened assets', () => {
  it('covers all nine movers', () => {
    expect(MOVER_IDS).toHaveLength(9);
  });
  for (const id of MOVER_IDS ?? []) {
    it(`the ${id}'s opened bakes fit 400 kB`, () => {
      expect(existsSync(BAKE)).toBe(true);
      const mine = readdirSync(BAKE).filter((f) => f.startsWith(`${id}-open-`));
      expect(mine.sort()).toEqual([`${id}-open-day.webp`, `${id}-open-lamp.webp`]);
      const total = mine.reduce((n, f) => n + statSync(join(BAKE, f)).size, 0);
      expect(total).toBeLessThanOrEqual(CAP);
    });
  }
});
