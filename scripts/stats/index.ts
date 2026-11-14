import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Stats } from '../../content/stats.types';
import { checkRepo } from './check';
import { collectRepo, collectThisSite, countSpecsAndPlans } from './collect';

function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const root = process.cwd();

if (process.argv.includes('--check')) {
  const { scanned, findings } = checkRepo(root);
  if (scanned === 0) {
    console.error('stats:check scanned 0 files; run it from the repo root.');
    process.exit(1);
  }
  if (findings.length > 0) {
    console.error('Hand-typed project stats found (read them from content/stats.json):');
    for (const f of findings) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`stats:check: ${scanned} files scanned, no hand-typed project stats`);
} else {
  const potaflowDir = resolve(root, process.env.POTAFLOW_REPO ?? '../potaflow-core');
  const powerWalkDir = resolve(root, process.env.POWERWALK_REPO ?? '../outapower');
  const stats: Stats = {
    asOf: localDate(),
    potaflow: collectRepo(potaflowDir),
    powerWalk: { ...collectRepo(powerWalkDir), specsAndPlans: countSpecsAndPlans(powerWalkDir) },
    thisSite: collectThisSite(root),
  };
  writeFileSync(resolve(root, 'content/stats.json'), JSON.stringify(stats, null, 2) + '\n');
  console.log(`Wrote content/stats.json (as of ${stats.asOf})`);
}
