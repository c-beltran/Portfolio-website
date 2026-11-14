import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Direction, RepoStats } from '../../content/stats.types';
import {
  countAgentAuthored,
  countCoAuthored,
  parseDirections,
  percentFloor,
  summarizeMergedPRs,
} from './derive';

export const CARLOS_LOGIN = 'c-beltran';

function run(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

const git = (dir: string, ...args: string[]) => run('git', ['-C', dir, ...args]);

/** owner/name from the repo's origin URL (https or ssh). */
export function ghRepoOf(dir: string): string {
  const url = git(dir, 'remote', 'get-url', 'origin').trim();
  const m = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
  if (!m) throw new Error(`Not a GitHub origin: ${url}`);
  return m[1]!;
}

type PR = { mergedBy: { login: string } | null };

function mergedPRs(dir: string, search?: string): PR[] {
  const args = [
    'pr',
    'list',
    '--repo',
    ghRepoOf(dir),
    '--state',
    'merged',
    '--limit',
    '5000',
    '--json',
    'mergedBy',
  ];
  if (search) args.push('--search', search);
  return JSON.parse(run('gh', args)) as PR[];
}

export function collectRepo(dir: string): RepoStats {
  const commits = Number(git(dir, 'rev-list', '--all', '--count').trim());
  const authors = git(dir, 'log', '--all', '--format=%an%x09%ae').split('\n').filter(Boolean);
  const coAuthoredCommits = countCoAuthored(git(dir, 'log', '--all', '--format=%H%x00%B%x1e'));
  const agentAuthoredCommits = countAgentAuthored(authors);
  const firstCommit = git(dir, 'log', '--all', '--reverse', '--format=%cs').split('\n')[0]!;
  return {
    commits,
    agentAuthoredCommits,
    humanAuthoredCommits: commits - agentAuthoredCommits,
    coAuthoredCommits,
    coAuthoredPercent: percentFloor(coAuthoredCommits, commits),
    coAuthoredDenominator: 'all commits on all branches',
    ...summarizeMergedPRs(mergedPRs(dir), CARLOS_LOGIN),
    firstCommit,
  };
}

export function countSpecsAndPlans(dir: string): number {
  return ['specs', 'plans']
    .map((sub) => {
      try {
        return readdirSync(join(dir, 'docs/superpowers', sub)).filter((f) => f.endsWith('.md'))
          .length;
      } catch {
        return 0;
      }
    })
    .reduce((a, b) => a + b, 0);
}

/**
 * This site's own work starts after the 2021 site's last commit; everything before it is the
 * old site. PRs count from the revamp's start date.
 */
export const OLD_SITE_LAST_COMMIT = '0a59141';
export const REVAMP_START = '2026-11-13';

export function collectThisSite(dir: string): {
  commits: number;
  mergedPRs: number;
  directions: Direction[];
} {
  let files: string[] = [];
  try {
    files = readdirSync(join(dir, 'docs/design/directions'));
  } catch {
    files = [];
  }
  return {
    commits: Number(git(dir, 'rev-list', '--all', '--count', '--not', OLD_SITE_LAST_COMMIT).trim()),
    mergedPRs: mergedPRs(dir, `merged:>=${REVAMP_START}`).length,
    directions: parseDirections(files),
  };
}
