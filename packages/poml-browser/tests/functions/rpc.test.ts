import { expect } from '@playwright/test';

import { test } from '../extension.spec';

test.describe('RPC System Tests', () => {
  test('sidebar -> background pingPong', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.background('Hello from sidebar', 100);
    });
    expect(result).toBe('Background received: Hello from sidebar');
  });

  test('sidebar -> content pingPong', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.content('Hello from sidebar', 100);
    });
    expect(result).toBe('Content received: Hello from sidebar');
  });

  test('background -> sidebar pingPong', async ({ serviceWorker, sidebarPage }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;
      return await pingPong.sidebar('Hello from background', 100);
    });
    expect(result).toBe('Sidebar received: Hello from background');
  });

  test('background -> content pingPong', async ({ serviceWorker, sidebarPage }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;
      return await pingPong.content('Hello from background', 100);
    });
    expect(result).toBe('Content received: Hello from background');
  });

  test('content -> background pingPong', async ({ contentPage, sidebarPage }) => {
    await contentPage.waitForFunction(() => (window as any).__pomlContentScriptReady === true);
    const result = await contentPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.background('Hello from content', 100);
    });
    expect(result).toBe('Background received: Hello from content');
  });

  test('content -> sidebar pingPong', async ({ contentPage, sidebarPage }) => {
    await contentPage.waitForFunction(() => (window as any).__pomlContentScriptReady === true);
    const result = await contentPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.sidebar('Hello from content', 100);
    });
    expect(result).toBe('Sidebar received: Hello from content');
  });
});
