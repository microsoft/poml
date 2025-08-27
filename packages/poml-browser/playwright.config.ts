import { defineConfig } from '@playwright/test';
import * as path from 'path';

const testFixturesPath = path.resolve(__dirname, '../../test-fixtures');
const extensionPath = path.resolve(__dirname, 'dist');

export default defineConfig({
  webServer: {
    command: `npx serve ${testFixturesPath} -p 8023`,
    port: 8023,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'Chrome Extension',
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
        headless: false,
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
