import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const STAT = String.raw`(?:commits?|PRs?|pull\s+requests?|specs?|plans?|directions?)`;
const NUMBER = String.raw`\d[\d,]*(?:\.\d+)?k?\+?%?`;
const NUMBER_WORD = String.raw`(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)`;

/**
 * A number (not glued to an identifier like P05, not a year) before a stat word, with up to
 * two words between: "5 design directions", "61% of commits", "1.5k commits", "five directions".
 */
const NUMBER_BEFORE = new RegExp(
  String.raw`(?<![\w.])(?!(?:19|20)\d\d\b)(?:${NUMBER}|\b${NUMBER_WORD})\s+(?:of\s+)?(?:[A-Za-z-]+\s+){0,2}${STAT}\b`,
  'gi',
);
/**
 * A stat-named key or identifier assigned a number: "mergedPRs: 218", "commits = 1532", "PR #247".
 * The stat word starts the key or a camelCase part of it, so "aspect: 1" (a-spec-t) is not a stat.
 */
const STAT_KEY_START = String.raw`(?:[Cc]ommits?|PRs?|[Pp]rs?|[Pp]ull[Rr]equests?|[Ss]pecs?|[Pp]lans?|[Dd]irections?)`;
const STAT_KEY_PART = String.raw`(?:Commits?|PRs?|Prs?|PullRequests?|Specs?|Plans?|Directions?)`;
const NUMBER_AFTER = new RegExp(
  String.raw`\b(?:${STAT_KEY_START}|[a-z][A-Za-z]*?${STAT_KEY_PART})[A-Za-z]*\s*[:=#]\s*\d`,
  'g',
);

/** Blank out markup and quoting (keeping offsets and newlines) so styled stats still match. */
function normalize(text: string): string {
  return text.replace(/<[^>]*>/g, (tag) => tag.replace(/[^\n]/g, ' ')).replace(/[{}"'`]/g, ' ');
}

export type Finding = { line: number; match: string };

export function findHandTypedStats(text: string): Finding[] {
  const clean = normalize(text);
  const lineAt = (index: number) => clean.slice(0, index).split('\n').length;
  return [...clean.matchAll(NUMBER_BEFORE), ...clean.matchAll(NUMBER_AFTER)]
    .sort((a, b) => a.index - b.index)
    .map((m) => ({ line: lineAt(m.index), match: m[0].replace(/\s+/g, ' ').trim() }));
}

const SCANNED_DIRS = ['content', 'app', 'components', 'lib'];
const SCANNED_EXT = /\.(ts|tsx|json|md|mdx)$/;
const EXCLUDED = (path: string) =>
  path === 'content/stats.json' || /\.(test|spec)\.tsx?$/.test(path);

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Scans the rendered-content folders. `scanned` is the file count, so callers can fail on 0. */
export function checkRepo(root: string): { scanned: number; findings: string[] } {
  const files = SCANNED_DIRS.flatMap((d) => walk(join(root, d)))
    .map((full) => relative(root, full))
    .filter((path) => SCANNED_EXT.test(path) && !EXCLUDED(path));
  return {
    scanned: files.length,
    findings: files.flatMap((path) =>
      findHandTypedStats(readFileSync(join(root, path), 'utf8')).map(
        (f) => `${path}:${f.line} ${f.match}`,
      ),
    ),
  };
}
