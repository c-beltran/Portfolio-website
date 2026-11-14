export type RepoStats = {
  /** Commits on GitHub: `git rev-list --remotes --count` after `git fetch --prune`. */
  commits: number;
  /** Author email noreply@anthropic.com, or author name containing "claude[bot]". */
  agentAuthoredCommits: number;
  /** commits − agentAuthoredCommits. */
  humanAuthoredCommits: number;
  /** Commits carrying a `Co-Authored-By: Claude` trailer. */
  coAuthoredCommits: number;
  /** floor(100 × coAuthoredCommits / commits). */
  coAuthoredPercent: number;
  coAuthoredDenominator: 'all commits pushed to GitHub, on every branch';
  mergedPRs: number;
  /** mergedPRs > 0 and every merged PR's mergedBy.login is 'c-beltran'. */
  allPRsMergedByCarlos: boolean;
  /** YYYY-MM-DD. */
  firstCommit: string;
};

export type Direction = { letter: string; status: 'chosen' | 'rejected'; file: string };

export type Stats = {
  /** YYYY-MM-DD. */
  asOf: string;
  potaflow: RepoStats;
  powerWalk: RepoStats & { specsAndPlans: number };
  thisSite: {
    commits: number;
    mergedPRs: number;
    allPRsMergedByCarlos: boolean;
    directions: Direction[];
  };
};
