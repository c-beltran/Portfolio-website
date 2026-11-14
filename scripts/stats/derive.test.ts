import { describe, expect, it } from 'vitest';
import {
  countAgentAuthored,
  countCoAuthored,
  parseDirections,
  percentFloor,
  summarizeMergedPRs,
  validateDirectionFiles,
  assertNotTruncated,
} from './derive';

describe('countCoAuthored', () => {
  it('counts records with a Claude co-author trailer, case-insensitively', () => {
    const raw = [
      'abc\0feat: one\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n',
      'def\0fix: two\n\nco-authored-by: claude <noreply@anthropic.com>\n',
      'ghi\0docs: three\n\nCo-Authored-By: Jane <jane@example.com>\n',
    ].join('\x1e');
    expect(countCoAuthored(raw)).toBe(2);
  });

  it('does not count a mention of Claude outside a trailer line', () => {
    expect(countCoAuthored('abc\0asked Claude to co-author this\n')).toBe(0);
  });
});

describe('countAgentAuthored', () => {
  it('counts Claude and claude[bot] authors only', () => {
    expect(
      countAgentAuthored([
        'Claude\tnoreply@anthropic.com',
        'claude[bot]\t4189+claude[bot]@users.noreply.github.com',
        'Carlos A Beltran\tx@y.z',
      ]),
    ).toBe(2);
  });
});

describe('summarizeMergedPRs', () => {
  it('makes no claim when there are no merged PRs', () => {
    expect(summarizeMergedPRs([], 'c-beltran')).toEqual({
      mergedPRs: 0,
      allPRsMergedByCarlos: false,
    });
  });

  it('is true only when every PR was merged by the login', () => {
    const mine = { mergedBy: { login: 'c-beltran' } };
    expect(summarizeMergedPRs([mine, mine], 'c-beltran')).toEqual({
      mergedPRs: 2,
      allPRsMergedByCarlos: true,
    });
    expect(
      summarizeMergedPRs([mine, { mergedBy: { login: 'someone' } }], 'c-beltran')
        .allPRsMergedByCarlos,
    ).toBe(false);
    expect(summarizeMergedPRs([mine, { mergedBy: null }], 'c-beltran').allPRsMergedByCarlos).toBe(
      false,
    );
  });
});

describe('parseDirections', () => {
  it('keeps only LETTER-status.png files, sorted by letter', () => {
    const dirs = parseDirections([
      'B-rejected.png',
      'E-chosen.png',
      'A-rejected.png',
      'art-direction.png',
      'notes.txt',
    ]);
    expect(dirs.map((d) => d.letter)).toEqual(['A', 'B', 'E']);
    expect(dirs.find((d) => d.letter === 'E')).toEqual({
      letter: 'E',
      status: 'chosen',
      file: 'E-chosen.png',
    });
  });
});

describe('percentFloor', () => {
  it('floors and guards a zero denominator', () => {
    expect(percentFloor(936, 1523)).toBe(61);
    expect(percentFloor(837, 837)).toBe(100);
    expect(percentFloor(1, 0)).toBe(0);
  });
});

describe('validateDirectionFiles', () => {
  it('accepts an empty folder and a well-formed set', () => {
    expect(() => validateDirectionFiles([])).not.toThrow();
    expect(() =>
      validateDirectionFiles(['A-rejected.png', 'B-rejected.png', 'E-chosen.png', '.DS_Store']),
    ).not.toThrow();
  });

  it.each([
    [['A-rejected.png', 'E-Chosen.png'], /E-Chosen\.png/],
    [['A-rejected.png', 'e-chosen.png'], /e-chosen\.png/],
    [['A-rejected.png', 'E-chosen.PNG'], /E-chosen\.PNG/],
    [['A-chosen.png', 'A-rejected.png'], /letter A/],
    [['A-chosen.png', 'B-chosen.png'], /exactly one chosen/],
    [['A-rejected.png', 'B-rejected.png'], /exactly one chosen/],
  ])('rejects %j', (files, message) => {
    expect(() => validateDirectionFiles(files)).toThrow(message);
  });
});

describe('assertNotTruncated', () => {
  it('throws when a list reaches its fetch limit, since it may be cut off', () => {
    expect(() => assertNotTruncated(4999, 5000, 'PRs')).not.toThrow();
    expect(() => assertNotTruncated(5000, 5000, 'PRs')).toThrow(/limit/);
  });
});
