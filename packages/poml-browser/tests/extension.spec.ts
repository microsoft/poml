import { test as base, chromium, BrowserContext, Page, Worker } from '@playwright/test';

import * as path from 'path';

const FIXTURE_ENDPOINT = 'http://localhost:8023';
const EXTENTION_PATH = path.resolve(process.cwd(), 'dist');
const EXTENSION_ID = 'acelbeblkcnjkojlhcljeldpoifcjoil';

// Custom fixtures: persistent context + sw + id + pages
type Fixtures = {
  extContext: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  sidebarPage: Page;
  contentPage: Page;
  rootPage: Page;
};

export const test = base.extend<Fixtures>({
  // Launch persistent context once for the worker
  extContext: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENTION_PATH}`,
        `--load-extension=${EXTENTION_PATH}`,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
    });
    await use(context);
    await context.close();
  },

  rootPage: async ({ extContext }, use) => {
    const page = await extContext.newPage();
    await page.goto(FIXTURE_ENDPOINT);
    await page.waitForLoadState('networkidle');
    await use(page);
  },

  serviceWorker: async ({ extContext }, use) => {
    const worker = extContext.serviceWorkers().find((w) => w.url().includes(EXTENSION_ID));
    if (worker) {
      await use(worker);
    } else {
      const sw = await extContext.waitForEvent('serviceworker', { timeout: 10000 });
      await use(sw);
    }
  },

  extensionId: async ({ serviceWorker }, use) => {
    const url = serviceWorker.url(); // e.g. chrome-extension://<ID>/background.js
    const extensionId = new URL(url).host;
    await use(extensionId);
  },

  sidebarPage: async ({ extContext, extensionId }, use) => {
    // Either ask SW to open a tab OR just open it directly—direct open is simpler and wakes SW too.
    const page = await extContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/ui/index.html`);
    await page.waitForTimeout(1000); // wait for the sidebar to initialize
    await use(page);
    // Do not close between tests to keep state (MV3 workers can unload)
  },

  contentPage: async ({ extContext }, use) => {
    const page = await extContext.newPage();
    await page.goto(FIXTURE_ENDPOINT);
    await page.waitForLoadState('networkidle');
    await use(page);
  },
});
