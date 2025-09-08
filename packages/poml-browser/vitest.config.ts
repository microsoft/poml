/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['**/tests/vitest/*.test.{js,ts,tsx}'],
  },
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, './common'),
      '@ui': path.resolve(__dirname, './ui'),
      '@background': path.resolve(__dirname, './background'),
      '@content': path.resolve(__dirname, './content'),
      'poml': path.resolve(__dirname, '../poml'),
    },
  },
});
