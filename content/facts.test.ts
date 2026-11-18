import { describe, expect, it } from 'vitest';
import type { Direction, RepoStats, Stats } from './stats.types';
import { facts, renderFact, statsFootnote, tenSecondFacts, yearsSince, type FactId } from './facts';

const repo = (o: Partial<RepoStats> = {}): RepoStats => ({
  commits: 1000,
  agentAuthoredCommits: 10,
  humanAuthoredCommits: 990,
  coAuthoredCommits: 600,
  coAuthoredPercent: 60,
  coAuthoredDenominator: 'all commits pushed to GitHub, on every branch',
  mergedPRs: 200,
  allPRsMergedByCarlos: true,
  firstCommit: '2025-12-09',
  ...o,
});

const dirs = (n: number): Direction[] =>
  Array.from({ length: n }, (_, i) => ({
    letter: String.fromCharCode(65 + i),
    status: i === n - 1 ? 'chosen' : 'rejected',
    file: `${String.fromCharCode(65 + i)}.png`,
  }));

function makeStats(
  o: {
    potaflow?: Partial<RepoStats>;
    powerWalk?: Partial<RepoStats & { specsAndPlans: number }>;
    thisSite?: Partial<Stats['thisSite']>;
  } = {},
): Stats {
  return {
    asOf: '2026-11-13',
    potaflow: repo(o.potaflow),
    powerWalk: { ...repo({ coAuthoredPercent: 100 }), specsAndPlans: 80, ...o.powerWalk },
    thisSite: {
      commits: 10,
      mergedPRs: 2,
      allPRsMergedByCarlos: true,
      directions: [],
      ...o.thisSite,
    },
  };
}

const ids = Object.keys(facts) as FactId[];
const renderAll = (s: Stats) => ids.map((id) => renderFact(id, s));

describe('facts', () => {
  it('never contains the retired F05', () => {
    expect(ids).not.toContain('F05');
  });

  it('P02 claims "every one merged by Carlos" only when verified', () => {
    expect(renderFact('P02', makeStats())).toContain('every one merged by Carlos');
    expect(
      renderFact('P02', makeStats({ potaflow: { allPRsMergedByCarlos: false } })),
    ).not.toContain('every one merged');
  });

  it('P05 says "every commit" only at 100%, else the floored percentage', () => {
    expect(renderFact('P05', makeStats({ powerWalk: { coAuthoredPercent: 99 } }))).toContain(
      '99% of commits co-authored with Claude',
    );
    expect(renderFact('P05', makeStats({ powerWalk: { coAuthoredPercent: 100 } }))).toContain(
      'every commit co-authored with Claude',
    );
  });

  it('P06 shows a TODO with no directions, never a zero count', () => {
    const empty = renderFact('P06', makeStats());
    expect(empty).toContain('[TODO: Q21');
    expect(empty).not.toContain('across');
    expect(empty).not.toContain('0 directions');
  });

  it('P06 counts directions with correct plurals', () => {
    expect(renderFact('P06', makeStats({ thisSite: { directions: dirs(5) } }))).toContain(
      'across 5 directions,',
    );
    expect(renderFact('P06', makeStats({ thisSite: { directions: dirs(1) } }))).toContain(
      'across 1 direction,',
    );
  });

  it('P06 claims only what GitHub records: "every PR merged by Carlos", never "reviewed"', () => {
    expect(renderFact('P06', makeStats())).toContain('every PR merged by Carlos');
    expect(renderFact('P06', makeStats())).not.toContain('reviewed');
    expect(
      renderFact('P06', makeStats({ thisSite: { allPRsMergedByCarlos: false } })),
    ).not.toContain('merged by Carlos');
  });

  it('never claims "merged by Carlos" over zero PRs, even if the flag says true', () => {
    expect(
      renderFact('P02', makeStats({ potaflow: { mergedPRs: 0, allPRsMergedByCarlos: true } })),
    ).not.toContain('merged by Carlos');
    expect(
      renderFact('P06', makeStats({ thisSite: { mergedPRs: 0, allPRsMergedByCarlos: true } })),
    ).not.toContain('merged by Carlos');
  });

  it('never says "written by AI" and never names a town', () => {
    for (const text of renderAll(makeStats())) {
      expect(text).not.toContain('written by AI');
      expect(text).not.toContain('Hempstead');
    }
  });

  it('renders every fact from the real stats.json without throwing', () => {
    for (const id of ids) expect(renderFact(id).length).toBeGreaterThan(0);
  });
});

describe('dates', () => {
  it('yearsSince floors whole years', () => {
    expect(yearsSince(new Date('2019-07-01'), new Date('2026-06-30'))).toBe(6);
    expect(yearsSince(new Date('2019-07-01'), new Date('2026-07-01'))).toBe(7);
  });

  it('tenSecondFacts ends with New York and derives the years', () => {
    expect(tenSecondFacts(new Date('2026-11-13'))).toEqual([
      'Go',
      'backend & performance',
      '7+ years',
      'AI-native',
      'New York',
    ]);
  });
});

describe('statsFootnote', () => {
  it('states the denominator and the date', () => {
    const note = statsFootnote(makeStats());
    expect(note).toContain('all commits pushed to GitHub, on every branch');
    expect(note).toContain('2026-11-13');
  });

  it('defines co-authored as a message that credits Claude (Q22)', () => {
    expect(statsFootnote(makeStats())).toContain('credits Claude as co-author');
  });
});

describe('FACT_IDS', () => {
  it('lists exactly the keys of facts, so tests can import IDs without stats.json', async () => {
    const { FACT_IDS } = await import('./factIds');
    expect([...FACT_IDS].sort()).toEqual(Object.keys(facts).sort());
  });
});
