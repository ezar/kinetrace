import { defineConfig, devices } from '@playwright/test';

/**
 * End to end tests run against a production build, because that is what the
 * service worker and the model paths behave like.
 */
/**
 * The app is served from the root on Vercel and from a subdirectory on GitHub
 * Pages, so the suite runs against whichever base the build used.
 */
const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:4173${basePath}`,
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
    // Build here rather than relying on whatever is in `dist`. The base path is
    // a build input, so a server left over from a run at a different base looks
    // healthy, answers every request, and fails every asset — which is a whole
    // evening of chasing a bug that is not in the app. For the same reason the
    // server is never reused: `--strictPort` then says so out loud instead.
    command:
      'pnpm --filter @kinetrace/web build && pnpm --filter @kinetrace/web preview --port 4173 --strictPort',
    url: `http://127.0.0.1:4173${basePath}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
