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
