import statsJson from './stats.json';
import { CAREER_START, yearsSince } from '../lib/dates';
import type { FactId } from './factIds';
import type { Stats } from './stats.types';
import { PLACES } from './places';

export { CAREER_START, yearsSince };

/**
 * The only place claims about Carlos live. Project numbers are never typed here:
 * facts that carry numbers are functions of `Stats`, read from content/stats.json, which only
 * scripts/stats writes.
 */
export type { FactId };

/** Retired IDs are never reused or rendered. */
export const RETIRED_FACT_IDS = ['F05'] as const;

const STATS = statsJson as Stats;

// The places Carlos has traveled to, in Carlos's order.
export { PLACES };
const listed = (items: readonly string[]) =>
  `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
const n = (value: number) => value.toLocaleString('en-US');

/**
 * "Merged by Carlos" is the only review claim GitHub can back (merges, not reviews). It's made
 * only over a non-zero PR count, even if a stale or hand-edited stats.json says otherwise.
 */
const verifiedMerges = (r: { mergedPRs: number; allPRsMergedByCarlos: boolean }) =>
  r.mergedPRs > 0 && r.allPRsMergedByCarlos;

export const facts: Record<FactId, string | ((s: Stats) => string)> = {
  F01: 'At the same company since July 2019: Meredith, then Dotdash Meredith, now People Inc.',
  F02: 'Senior Software Engineer, Performance Engineering on the Ad Platform',
  F03: 'Integrated new retailers into Go-based importer systems and optimized the importer processes',
  F04: 'Migrated the creative builder tool from PostgreSQL to a graph database',
  F06: 'Carried platform migrations through the merger',
  F07: 'Ad performance, latency and infrastructure cost reduction',
  F08: 'Mentors engineers and leads projects',
  F09: 'Wrote Claude skills that are now widely shared across his team',
  F10: 'Ships internal tools for product managers fast with AI; drives AI adoption on his team',
  F11: 'Uses Claude Code, Codex, Cursor and Claude Design daily, with agents that plan, build and review in parallel',
  F12: 'Based in New York',
  P01: 'Potaflow: multi-tenant SaaS that removes the paper trail from backflow testing compliance for water districts in Nassau County, NY',
  P02: ({ potaflow: p }) =>
    `Potaflow: Nuxt, tRPC, Prisma, Postgres, S3, Sentry; ${n(p.commits)} commits (${p.coAuthoredPercent}% co-authored with Claude) and ${n(p.mergedPRs)} merged PRs` +
    (verifiedMerges(p) ? ', every one merged by Carlos' : '') +
    '; 1 human + agents',
  P03: 'Potaflow: custom AI skills encode NY DOH-1013 rules and physical testing procedures',
  P04: 'Power Walk: iPhone game where every real step (Apple Health) is a footstep through a blacked-out New York landmark; find the fuse and turn the lights back on',
  P05: ({ powerWalk: w }) =>
    `Power Walk: React Native and Expo; built from ${n(w.specsAndPlans)} specs and plans; ` +
    (w.coAuthoredPercent === 100
      ? 'every commit co-authored with Claude'
      : `${w.coAuthoredPercent}% of commits co-authored with Claude`) +
    '; Claude Design produced parts of the art',
  P06: ({ thisSite: t }) =>
    'This website: designed on a Claude Design canvas ' +
    (t.directions.length === 0
      ? '[TODO: directions not exported yet]'
      : `across ${n(t.directions.length)} ${t.directions.length === 1 ? 'direction' : 'directions'}`) +
    ', built with AI agents' +
    (verifiedMerges(t) ? ', every PR merged by Carlos' : ''),
  ABOUT: '[TODO: Carlos writes this in his own voice]',
  // the room, in Carlos's words
  H01: 'Likes to work on cars; diagnosing them is one of his hobbies',
  H02: 'Worked as a technician at Start Toyota of Bayside',
  H03: 'Soccer is his favorite sport: he played on his high school team and still plays with friends',
  H04: `Has traveled to ${listed(PLACES)}`,
  // the board's middle magnet
  H05: 'From El Salvador: his native roots',
  H06: 'Coffee addict',
};

export function renderFact(id: FactId, s: Stats = STATS): string {
  const fact = facts[id];
  return typeof fact === 'function' ? fact(s) : fact;
}

/** The header's 10-second facts. */
export function tenSecondFacts(now: Date = new Date()): string[] {
  return [
    'Go',
    'backend & performance',
    `${yearsSince(CAREER_START, now)}+ years`,
    'AI-native',
    'New York',
  ];
}

export function statsFootnote(s: Stats = STATS): string {
  return `Co-authored share: commits whose message credits Claude as co-author (a "Co-Authored-By: Claude" line), out of ${s.potaflow.coAuthoredDenominator}. Counts as of ${s.asOf}.`;
}
