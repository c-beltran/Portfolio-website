import { describe, expect, it } from 'vitest';
import { findHandTypedStats } from './check';

describe('findHandTypedStats', () => {
  it.each([
    '1,501 commits',
    '217 merged PRs',
    'PR #247',
    'built from 91 specs and plans',
    '5 directions',
    'commits: 1450',
    // realistic forms of a hand-typed stat
    '<strong>1,532</strong> commits',
    '{1532} commits',
    '"commits": 1532',
    'mergedPRs: 218',
    'totalCommits: 1532',
    'specsAndPlans: 88',
    'const commits = 1532',
    '5 design directions',
    '218 reviewed PRs',
    '1,532 git commits',
    'five directions',
    '1.5k commits',
    '61% of commits co-authored',
  ])('flags %s', (text) => {
    expect(findHandTypedStats(text).length).toBeGreaterThanOrEqual(1);
  });

  it('flags a stat split across lines by a formatter', () => {
    expect(findHandTypedStats('Potaflow has 1,532\n  commits').length).toBeGreaterThanOrEqual(1);
  });

  it.each([
    "`${s.potaflow.commits.toLocaleString('en-US')} commits`",
    'since July 2019',
    '7+ years',
    'Directions',
    'width: 44',
    '[TODO: directions not exported yet]',
    '1 human + agents',
    "P05: 'Power Walk: built from specs and plans'",
    "{ label: 'Commits', value: (s) => s.potaflow.commits }",
    // a stat word inside a longer word is not a stat key
    '"aspect": 0.5625',
    'aspect: 1',
    'inspection = 3',
  ])('does not flag %s', (text) => {
    expect(findHandTypedStats(text)).toEqual([]);
  });

  it('reports 1-based line numbers', () => {
    expect(findHandTypedStats('ok\nsee 12 commits')).toEqual([{ line: 2, match: '12 commits' }]);
  });
});
