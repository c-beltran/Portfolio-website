import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Direction, RepoStats } from '../../content/stats.types';
import {
  assertNotTruncated,
  countAgentAuthored,
  countCoAuthored,
  parseDirections,
  percentFloor,
  summarizeMergedPRs,
  validateDirectionFiles,
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

const PR_LIMIT = 5000;
/** GitHub's search API returns at most 1000 results, whatever --limit says. */
const SEARCH_LIMIT = 1000;

/**
 * Counts come from what's on GitHub, not from this clone: fetch first, then read only
 * remote-tracking refs. Local stashes and unpushed branches never change a published number.
 */
function fetchOrigin(dir: string): void {
  git(dir, 'fetch', '--prune', '--quiet', 'origin');
}

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
  const prs = JSON.parse(run('gh', args)) as PR[];
  assertNotTruncated(prs.length, search ? SEARCH_LIMIT : PR_LIMIT, `merged PRs in ${dir}`);
  return prs;
}

export function collectRepo(dir: string): RepoStats {
  fetchOrigin(dir);
  const commits = Number(git(dir, 'rev-list', '--remotes', '--count').trim());
  const authors = git(dir, 'log', '--remotes', '--format=%an%x09%ae').split('\n').filter(Boolean);
  const coAuthoredCommits = countCoAuthored(git(dir, 'log', '--remotes', '--format=%H%x00%B%x1e'));
  const agentAuthoredCommits = countAgentAuthored(authors);
  const firstCommit = git(dir, 'log', '--remotes', '--reverse', '--format=%cs').split('\n')[0]!;
  return {
    commits,
    agentAuthoredCommits,
    humanAuthoredCommits: commits - agentAuthoredCommits,
    coAuthoredCommits,
    coAuthoredPercent: percentFloor(coAuthoredCommits, commits),
    coAuthoredDenominator: 'all commits pushed to GitHub, on every branch',
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
  allPRsMergedByCarlos: boolean;
  directions: Direction[];
} {
  let files: string[] = [];
  try {
    files = readdirSync(join(dir, 'docs/design/directions'));
  } catch {
    files = [];
  }
  validateDirectionFiles(files);
  fetchOrigin(dir);
  return {
    commits: Number(
      git(dir, 'rev-list', '--remotes', '--count', '--not', OLD_SITE_LAST_COMMIT).trim(),
    ),
    ...summarizeMergedPRs(mergedPRs(dir, `merged:>=${REVAMP_START}`), CARLOS_LOGIN),
    directions: parseDirections(files),
  };
}
