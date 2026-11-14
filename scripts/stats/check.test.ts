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
  ])('flags %s', (text) => {
    expect(findHandTypedStats(text)).toHaveLength(1);
  });

  it.each([
    "`${s.potaflow.commits.toLocaleString('en-US')} commits`",
    'since July 2019',
    '7+ years',
    'Directions',
    'width: 44',
    '[TODO: Q21 directions not exported yet]',
    '1 human + agents',
    "P05: 'Power Walk: built from specs and plans'",
  ])('does not flag %s', (text) => {
    expect(findHandTypedStats(text)).toEqual([]);
  });

  it('reports 1-based line numbers', () => {
    expect(findHandTypedStats('ok\nsee 12 commits')).toEqual([{ line: 2, match: '12 commits' }]);
  });
});
