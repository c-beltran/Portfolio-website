import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESIGN = 'docs/design';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('docs/design hygiene', () => {
  it('has the reference mock', () => {
    expect(existsSync(join(DESIGN, 'desk-mock.dc.html'))).toBe(true);
  });

  it.each(['Hempstead', 'vendor', 'licensed backflow'])('no public design file mentions %s', (word) => {
    const hits = files(DESIGN)
      .filter((f) => /\.(md|html|txt|json)$/.test(f))
      .filter((f) => readFileSync(f, 'utf8').toLowerCase().includes(word.toLowerCase()));
    expect(hits).toEqual([]);
  });
});
