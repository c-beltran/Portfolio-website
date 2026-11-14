import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const STAT_WORD = String.raw`(?:commits?|PRs?|pull\s+requests?|specs?|plans?|directions?)`;
/** A number (not part of an identifier like Q21 or P05) directly before a stat word. */
const NUMBER_BEFORE = new RegExp(
  String.raw`(?<![\w.])\d[\d,]*\+?\s*(?:merged\s+)?${STAT_WORD}\b`,
  'gi',
);
/** A stat word directly before a number: "PR #247", "commits: 1450". */
const NUMBER_AFTER = new RegExp(String.raw`\b${STAT_WORD}\s*[:#]?\s*\d[\d,]*`, 'gi');

export type Finding = { line: number; match: string };

export function findHandTypedStats(text: string): Finding[] {
  return text.split('\n').flatMap((lineText, i) =>
    [...lineText.matchAll(NUMBER_BEFORE), ...lineText.matchAll(NUMBER_AFTER)].map((m) => ({
      line: i + 1,
      match: m[0],
    })),
  );
}

const SCANNED_DIRS = ['content', 'app', 'components'];
const SCANNED_EXT = /\.(ts|tsx|json|md|mdx)$/;
const EXCLUDED = (path: string) => path === 'content/stats.json' || path.endsWith('.test.ts');

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

/** Returns `path:line match` strings for every finding under the rendered-content folders. */
export function checkRepo(root: string): string[] {
  return SCANNED_DIRS.flatMap((d) => walk(join(root, d)))
    .map((full) => relative(root, full))
    .filter((path) => SCANNED_EXT.test(path) && !EXCLUDED(path))
    .flatMap((path) =>
      findHandTypedStats(readFileSync(join(root, path), 'utf8')).map(
        (f) => `${path}:${f.line} ${f.match}`,
      ),
    );
}
