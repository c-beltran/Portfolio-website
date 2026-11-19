import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    include: [
      'content/**/*.test.ts',
      'lib/**/*.test.ts',
      'scripts/**/*.test.ts',
      'scripts/**/*.test.mjs',
      'components/**/*.test.ts',
    ],
    environment: 'node',
  },
});
