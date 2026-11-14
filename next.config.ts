import { existsSync } from 'node:fs';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // The résumé button only links to a PDF that exists (no dead link on previews).
  env: { NEXT_PUBLIC_RESUME_AVAILABLE: String(existsSync('public/carlos-beltran-resume.pdf')) },
};

export default config;
