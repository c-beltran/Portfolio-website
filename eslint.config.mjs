import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'docs/private/**',
      'test-results/**',
      'playwright-report/**',
      '.lighthouseci/**',
      'next-env.d.ts',
    ],
  },
];

export default config;
