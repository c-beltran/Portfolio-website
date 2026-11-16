import { existsSync } from 'node:fs';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // CSS inline in the HTML: the desk paints as soon as the HTML arrives, before any script runs
  // (no render-blocking stylesheet request on the LCP path).
  experimental: { inlineCss: true },
  // The résumé button only links to a PDF that exists (no dead link on previews).
  env: { NEXT_PUBLIC_RESUME_AVAILABLE: String(existsSync('public/carlos-beltran-resume.pdf')) },
};

export default config;
