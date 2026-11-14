import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

if (!existsSync('out')) {
  console.error('out/ is missing: run `pnpm build` first.');
  process.exit(1);
}
mkdirSync('out/_vercel/insights', { recursive: true });
copyFileSync('scripts/local-serve/insights-stub.js', 'out/_vercel/insights/script.js');
