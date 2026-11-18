import type { Direction } from '../../content/stats.types';

const CO_AUTHOR_TRAILER = /^co-authored-by:\s*claude\b/im;
const DIRECTION_FILE = /^([A-Z])-(chosen|rejected)\.png$/;

/** Lines are `name\temail`, one per commit. */
export function countAgentAuthored(authorLines: string[]): number {
  return authorLines.filter((line) => {
    const [name = '', email = ''] = line.split('\t');
    return email.trim().toLowerCase() === 'noreply@anthropic.com' || name.includes('claude[bot]');
  }).length;
}

/** `rawLog` is `git log --format=%H%x00%B%x1e`: one record per commit, separated by \x1e. */
export function countCoAuthored(rawLog: string): number {
  return rawLog.split('\x1e').filter((record) => CO_AUTHOR_TRAILER.test(record)).length;
}

export function summarizeMergedPRs(
  prs: { mergedBy: { login: string } | null }[],
  login: string,
): { mergedPRs: number; allPRsMergedByCarlos: boolean } {
  return {
    mergedPRs: prs.length,
    allPRsMergedByCarlos: prs.length > 0 && prs.every((pr) => pr.mergedBy?.login === login),
  };
}

/** Branches whose PRs only promote already-merged work into the release branch (Q23). */
const PROMOTION_HEADS = new Set(['development', 'develop']);
const RELEASE_BASES = new Set(['main', 'master']);

/** A PR that only promotes the development branch into main carries no new work of its own. */
export function isPromotionPR(pr: { headRefName?: string; baseRefName?: string }): boolean {
  return PROMOTION_HEADS.has(pr.headRefName ?? '') && RELEASE_BASES.has(pr.baseRefName ?? '');
}

export function parseDirections(filenames: string[]): Direction[] {
  return filenames
    .flatMap((file) => {
      const m = DIRECTION_FILE.exec(file);
      return m ? [{ letter: m[1]!, status: m[2] as Direction['status'], file }] : [];
    })
    .sort((a, b) => a.letter.localeCompare(b.letter));
}

export function percentFloor(n: number, d: number): number {
  return d === 0 ? 0 : Math.floor((100 * n) / d);
}

/**
 * Every non-dotfile in docs/design/directions/ must be LETTER-chosen.png or LETTER-rejected.png,
 * letters must be unique, and a non-empty set has exactly one chosen direction. Throws otherwise,
 * so a misnamed export can never silently change the published count.
 */
export function validateDirectionFiles(filenames: string[]): void {
  const files = filenames.filter((f) => !f.startsWith('.'));
  const bad = files.filter((f) => !DIRECTION_FILE.test(f));
  if (bad.length > 0) {
    throw new Error(
      `Unexpected file(s) in docs/design/directions/: ${bad.join(', ')} (expected LETTER-chosen.png or LETTER-rejected.png)`,
    );
  }
  const dirs = parseDirections(files);
  const seen = new Set<string>();
  for (const d of dirs) {
    if (seen.has(d.letter)) throw new Error(`Duplicate direction letter ${d.letter}`);
    seen.add(d.letter);
  }
  const chosen = dirs.filter((d) => d.status === 'chosen').length;
  if (dirs.length > 0 && chosen !== 1) {
    throw new Error(`Expected exactly one chosen direction, found ${chosen}`);
  }
}

/** gh caps list results; a result at the cap may be truncated, so refuse to undercount. */
export function assertNotTruncated(count: number, limit: number, what: string): void {
  if (count >= limit) {
    throw new Error(`${what}: got ${count}, at the fetch limit ${limit}; results may be truncated`);
  }
}
