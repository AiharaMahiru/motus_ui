import { defineConfig, devices } from '@playwright/test'

const useExternalServers = process.env.PLAYWRIGHT_EXTERNAL_SERVERS === '1'
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: useExternalServers
    ? undefined
    : [
        {
          command: 'uv run python -m apps.server',
          cwd: '..',
          env: {
            ...process.env,
            APP_HOST: '127.0.0.1',
            APP_PORT: '18000',
          },
          url: 'http://127.0.0.1:18000/health',
          reuseExistingServer: true,
          timeout: 120_000,
        },
        {
          command: 'npm run dev -- --host 127.0.0.1 --port 4173',
          cwd: '.',
          env: {
            ...process.env,
            APP_HOST: '127.0.0.1',
            APP_PORT: '18000',
          },
          url: 'http://127.0.0.1:4173',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
