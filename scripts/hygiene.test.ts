import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SELF = 'scripts/hygiene.test.ts';
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
// The working tree's copy; a file deleted but not yet committed has nothing to check.
const text = tracked
  .filter((f) => f !== SELF && f !== 'pnpm-lock.yaml' && existsSync(f))
  .filter((f) => /\.(md|html|txt|tsx?|mjs|css|py|sh|ya?ml)$/.test(f))
  .map((file) => ({ file, body: readFileSync(file, 'utf8') }));

describe('public docs hygiene', () => {
  const docs = text.filter(({ file }) => /\.(md|html|txt)$/.test(file));

  it('has the README to check', () => {
    expect(docs.map((d) => d.file)).toContain('README.md');
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
  ])('no public doc matches %s', (pattern) => {
    expect(docs.filter((d) => pattern.test(d.body)).map((d) => d.file)).toEqual([]);
  });
});

// The repo says what the code does. Who decided it, when and in which plan is in the private notes.
describe('working notes stay out of the public tree', () => {
  it.each([
    ['dated quotes', /Carlos,? \(?20\d\d-\d\d-\d\d/],
    ['private section numbers', /§/],
    ['question and ruling numbers', /\bQ\d{1,2}\b|\bruling \d/],
    [
      'plans, phases and tasks',
      /\bplan M\d|\b[Pp]hase \d|\bTask \d|\bM[0-5][a-c]\b|\(2b\)|Review Focus|checkpoint \d/,
    ],
    ['the private spec', /DESK_SPEC|\bmy call\b/],
  ])('no tracked file carries %s', (_name, pattern) => {
    expect(text.filter((t) => pattern.test(t.body)).map((t) => t.file)).toEqual([]);
  });
});

describe('tracked files', () => {
  // Build byproducts can embed local paths (a .pyc records its source's absolute path).
  it('include no compiled Python', () => {
    expect(tracked.filter((f) => /(^|\/)__pycache__\/|\.pyc$/.test(f))).toEqual([]);
  });
});
