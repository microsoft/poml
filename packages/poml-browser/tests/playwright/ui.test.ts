import { test } from './extension.spec';
import { expect } from '@playwright/test';

import config from '../../playwright.config';
import { readFileSync } from 'fs';
import path from 'path';

const testFixturesPath = config.metadata!.testFixturesPath;

test.describe('ui tests', () => {
  test('comprehensive', async ({ sidebarPage }) => {
    test.setTimeout(3600000);
    await sidebarPage.waitForFunction(() => (window as any).__pomlUIReady === true);

    const sampleData = await readFileSync(path.join(testFixturesPath, 'document/card-sample.json'), 'utf-8');
    const sampleDataJson = JSON.parse(sampleData);

    await sidebarPage.evaluate(async (sampleData) => {
      const { injectTestCards } = window as any;

      // Inject the comprehensive test card
      injectTestCards([sampleData]);

      // Wait a bit for React to process the state update
      await new Promise((resolve) => setTimeout(resolve, 100));
    }, sampleDataJson);

    await sidebarPage.waitForTimeout(3600000);
  });
});
