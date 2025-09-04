import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const testFixturesPath = path.resolve(__dirname, '../../test-fixtures');
const extensionPath = path.resolve(__dirname, 'dist');

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  webServer: {
    command: `npx serve ${testFixturesPath} -p 8023`,
    port: 8023,
    reuseExistingServer: !process.env.CI,
  },
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  projects: [
    {
      name: 'Chrome Extension',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        deviceScaleFactor: undefined,
        viewport: null,
      },
    },
  ],
  use: {
    baseURL: 'http://localhost:8023',
  },
  metadata: {
    testFixturesPath,
    extensionPath,
  },
});
