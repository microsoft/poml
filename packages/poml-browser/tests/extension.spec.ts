import { test as base, chromium, BrowserContext, Page, Worker } from '@playwright/test';

import * as path from 'path';

process.env.PW_CHROMIUM_ATTACH_TO_OTHER = '1';

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

  sidebarPage: async ({ extContext, extensionId, contentPage }, use) => {
    // First click the button in content page to open sidebar
    await contentPage.waitForSelector('#openSidePanel', { timeout: 5000 });
    await contentPage.click('#openSidePanel');

    // Wait for sidebar to appear
    await contentPage.waitForTimeout(1000);

    // Find the sidebar page
    const pages = extContext.pages();
    const sidebar = pages.find((page) => page.url().includes(extensionId) && page.url().includes('ui/index.html'));

    if (!sidebar) {
      throw new Error('Sidebar page not found');
    }
    // const frame = sidebar.mainFrame();
    // await frame.waitForFunction(() => !!window.chrome?.runtime?.id, { timeout: 5000 });
    await sidebar.waitForTimeout(50000); // Wait for sidebar to load

    await use(sidebar);
    // Do not close between tests to keep state (MV3 workers can unload)
  },

  contentPage: async ({ extContext }, use) => {
    const page = await extContext.newPage();
    await page.goto(FIXTURE_ENDPOINT);
    await page.waitForLoadState('networkidle');
    await use(page);
  },
});
