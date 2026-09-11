import { defineConfig, devices } from '@playwright/test';

/**
 * End to end tests run against a production build, because that is what the
 * service worker and the model paths behave like.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    // The session screen asks for the camera; grant it. The stream itself is
    // stubbed per test, so the suite does not depend on the machine having one.
    permissions: ['camera'],
    ...(process.env.CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } }
      : {}),
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        permissions: ['camera'],
        // Honour a preinstalled browser when the environment provides one.
        ...(process.env.CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'pnpm --filter @kinetrace/web preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
