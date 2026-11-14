import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

if (!existsSync('out')) {
  console.error('out/ is missing: run `pnpm build` first.');
  process.exit(1);
}
mkdirSync('out/_vercel/insights', { recursive: true });
copyFileSync('scripts/local-serve/insights-stub.js', 'out/_vercel/insights/script.js');

// Mirror vercel.json's header rule for the local server (serve reads out/serve.json).
writeFileSync(
  'out/serve.json',
  JSON.stringify({
    headers: [
      { source: '**/opengraph-image', headers: [{ key: 'Content-Type', value: 'image/png' }] },
    ],
  }),
);
