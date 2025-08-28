/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      headless: true,
    },
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/test-utils/*.browser.test.{js,ts}'],
  },
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, './common'),
      '@ui': path.resolve(__dirname, './ui'),
      '@stubs': path.resolve(__dirname, './stubs'),
    },
  },
});
