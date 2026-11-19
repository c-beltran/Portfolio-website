import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/**
 * The live scene's assets (spec §7: the 3D payload — three's JS, the GLB, the textures — is
 * ≤ 3 MB gzipped). The assets get half, leaving room for the three chunk (~270 kB) and M4's
 * screen content.
 */
const DIR = join(process.cwd(), 'public/scene');
const CAP = 1.5 * 1024 * 1024;

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

describe('live scene assets', () => {
  it('fit 1.5 MB gzipped', () => {
    const total = files(DIR).reduce(
      (n, f) => n + gzipSync(readFileSync(f), { level: 9 }).length,
      0,
    );
    expect(total).toBeLessThanOrEqual(CAP);
  });

  it('are only the GLB and WebP lightmaps', () => {
    const bad = files(DIR)
      .map((f) => relative(DIR, f))
      .filter((f) => !/\.(glb|webp)$/.test(f));
    expect(bad).toEqual([]);
  });
});
