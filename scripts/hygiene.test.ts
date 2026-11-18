import { execFileSync } from 'node:child_process';
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

  it.each([
    /hempstead/i,
    /vendor/i,
    /licensed (backflow|tester|to test)|-licensed/i,
    /AI review gate( checks|:)/i,
    /reviewed by me/i,
    /\b832\b/,
    /Templates used/i,
    /1,450|247\+|\d+ reviewers|mid-review|merges until I|Directions explored: \d|real tool of mine/i,
  ])('no public design file matches %s', (pattern) => {
    const hits = files(DESIGN)
      .filter((f) => /\.(md|html|txt|json)$/.test(f))
      .filter((f) => pattern.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});

describe('tracked files', () => {
  // Build byproducts can embed local paths (a .pyc records its source's absolute path).
  it('include no compiled Python', () => {
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
    expect(tracked.filter((f) => /(^|\/)__pycache__\/|\.pyc$/.test(f))).toEqual([]);
  });
});
