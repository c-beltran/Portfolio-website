import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { INTERACTIVE } from '../deskLayout';

/**
 * The hover glow (Carlos, 2026-11-20: a slight glow instead of the rectangle; 2026-11-21: on the
 * edges, not the item): per clickable item, a soft ring just outside its silhouette, from the seat
 * at a quarter of the master (scripts/scene/render_masks.py, encode_glow.mjs). Alpha masks, loaded
 * after the page. glow.spec.ts checks the ring never lights the object.
 */
const DIR = join(process.cwd(), 'public/glow');
const KB = 1024;

describe('glow masks', () => {
  for (const id of INTERACTIVE)
    it(`${id}-ring.webp is a quarter-master alpha mask, ≤ 6 kB`, async () => {
      const p = join(DIR, `${id}-ring.webp`);
      expect(existsSync(p), p).toBe(true);
      const m = await sharp(p).metadata();
      expect([m.width, m.height]).toEqual([1422, 533]);
      expect(m.hasAlpha).toBe(true);
      expect(statSync(p).size).toBeLessThanOrEqual(6 * KB);
    });
});
