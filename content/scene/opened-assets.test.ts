import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What an object that comes forward loads on demand (design 2026-11-19 §5.5, §6), never on the
 * first load: each object's Tier 2 opened bakes, day plus lamp, stay within 400 kB (my call,
 * plan M3c-forward).
 */
const BAKE = join(process.cwd(), 'public/opened/bake');
const CAP = 400 * 1024;

describe('on-demand opened assets', () => {
  for (const id of ['kit', 'phone']) {
    it(`the ${id}'s opened bakes fit 400 kB`, () => {
      expect(existsSync(BAKE)).toBe(true);
      const mine = readdirSync(BAKE).filter((f) => f.startsWith(`${id}-open-`));
      expect(mine.sort()).toEqual([`${id}-open-day.webp`, `${id}-open-lamp.webp`]);
      const total = mine.reduce((n, f) => n + statSync(join(BAKE, f)).size, 0);
      expect(total).toBeLessThanOrEqual(CAP);
    });
  }
});
