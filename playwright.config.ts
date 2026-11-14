import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
  webServer: {
    command: `pnpm serve:out`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'desktop',
      testDir: 'tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        baseURL: `http://localhost:${PORT}`,
      },
    },
    {
      name: 'phone',
      testDir: 'tests/e2e',
      use: { ...devices['Pixel 7'], baseURL: `http://localhost:${PORT}` },
    },
    {
      name: 'preview',
      testDir: 'tests/preview',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.PREVIEW_URL,
        extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
          ? {
              'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
              'x-vercel-set-bypass-cookie': 'true',
            }
          : {},
      },
    },
  ],
});
