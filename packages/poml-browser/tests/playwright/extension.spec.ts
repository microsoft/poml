import { test as base, chromium, BrowserContext, Page, Worker, expect } from '@playwright/test';

import * as path from 'path';
import * as fs from 'fs';

process.env.PW_CHROMIUM_ATTACH_TO_OTHER = '1';

const FIXTURE_ENDPOINT = 'http://localhost:8023';
const EXTENTION_PATH = path.resolve(process.cwd(), 'dist');
const EXTENSION_ID = 'acelbeblkcnjkojlhcljeldpoifcjoil';
const RETRY_CONFIG = {
  timeout: 180_000,
  intervals: [100, 200, 500, 1000, 2000, 10_000, 60_000], // Retry intervals
};

// Custom fixtures: persistent context + sw + id + pages
type Fixtures = {
  extContext: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  sidebarPage: Page;
  contentPage: Page;
  rootPage: Page;
};

// Create unique artifact folder for this test run
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

export function createArtifactDir() {
  const artifactDir = path.resolve(process.cwd(), 'test-artifacts', timestamp);

  // Ensure artifact directory exists
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  return artifactDir;
}

export async function waitForStableDom(
  page: Page,
  timeout: number = 10000,
  checkInterval: number = 1000,
): Promise<void> {
  // https://stackoverflow.com/questions/71937343/playwright-how-to-wait-until-there-is-no-animation-on-the-page
  let markupPrevious = '';
  const timerStart = new Date();
  while (true) {
    const markupCurrent = await page.evaluate(() => document.body.innerHTML);
    if (markupCurrent === markupPrevious) {
      break;
    } else {
      const elapsed = new Date().getTime() - timerStart.getTime();
      if (elapsed >= timeout) {
        throw new Error(`Timeout waiting for stable DOM: ${timeout}ms`);
      }
      markupPrevious = markupCurrent;
    }
    // Sleep before next check
    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }
}

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
    const worker =
      extContext.serviceWorkers().find((w) => w.url().includes(EXTENSION_ID)) ||
      (await extContext.waitForEvent('serviceworker', { timeout: 10_000 }));

    // Wait for pingPong to be defined
    await expect(async () => {
      const hasPingPong = await worker.evaluate(() => {
        return typeof (self as any).pingPong !== 'undefined';
      });
      expect(hasPingPong).toBeTruthy();
    }).toPass(RETRY_CONFIG);
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    const url = serviceWorker.url(); // e.g. chrome-extension://<ID>/background.js
    const extensionId = new URL(url).host;
    await use(extensionId);
  },

  contentPage: async ({ extContext }, use) => {
    const page = await extContext.newPage();
    await page.goto(FIXTURE_ENDPOINT);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#openSidePanel', { timeout: 10_000 });
    await use(page);
  },

  sidebarPage: async ({ extContext, extensionId, contentPage }, use) => {
    // First click the button in content page to open sidebar
    await contentPage.click('#openSidePanel');

    // Wait for sidebar to appear
    await contentPage.waitForTimeout(500);
    let sidebar: Page | undefined;
    await expect(async () => {
      const pages = extContext.pages();
      sidebar = pages.find((page) => page.url().includes(extensionId) && page.url().includes('ui/index.html'));
      expect(sidebar).toBeTruthy();
    }).toPass(RETRY_CONFIG);

    if (!sidebar) {
      throw new Error('Sidebar page not found');
    }

    // The internal page opened by the service worker does not work.
    // We have to reload it here. Don't ask me why.
    await sidebar.goto(`chrome-extension://${extensionId}/ui/index.html`, { timeout: 180_000 });
    await sidebar.waitForTimeout(100); // Wait for sidebar to load
    await expect(async () => {
      const isReady = await sidebar!.evaluate(() => {
        return (window as any).__pomlUIReady === true;
      });
      expect(isReady).toBe(true);
    }).toPass(RETRY_CONFIG);

    await use(sidebar);
  },
});
