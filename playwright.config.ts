import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

const PREVIEW_URL = process.env.PREVIEW_URL;
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const local = `http://localhost:${PORT}`;

/**
 * Two modes. Locally and in CI's gate job: desktop + phone against the static export on a local
 * server. With PREVIEW_URL set (preview workflow): only the `preview` project, against Vercel,
 * and no local server.
 */
export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
  webServer: PREVIEW_URL
    ? undefined
    : { command: 'pnpm serve:out', port: PORT, reuseExistingServer: false },
  projects: PREVIEW_URL
    ? [
        {
          name: 'preview',
          testDir: 'tests/preview',
          use: {
            ...devices['Desktop Chrome'],
            baseURL: PREVIEW_URL,
            extraHTTPHeaders: BYPASS
              ? { 'x-vercel-protection-bypass': BYPASS, 'x-vercel-set-bypass-cookie': 'true' }
              : {},
          },
        },
      ]
    : [
        {
          name: 'desktop',
          testDir: 'tests/e2e',
          use: {
            ...devices['Desktop Chrome'],
            viewport: { width: 1280, height: 800 },
            baseURL: local,
          },
        },
        { name: 'phone', testDir: 'tests/e2e', use: { ...devices['Pixel 7'], baseURL: local } },
      ],
});
