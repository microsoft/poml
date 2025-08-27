import { expect, Page, BrowserContext, Worker } from '@playwright/test';

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

  test('background -> sidebar pingPong', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;
      return await pingPong.sidebar('Hello from background', 100);
    });
    expect(result).toBe('Sidebar received: Hello from background');
  });

  test('background -> content pingPong', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;
      return await pingPong.content('Hello from background', 100);
    });
    expect(result).toBe('Content received: Hello from background');
  });

  test('content -> background pingPong', async ({ contentPage }) => {
    await contentPage.waitForFunction(() => (window as any).__pomlContentScriptReady === true);
    const result = await contentPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.background('Hello from content', 100);
    });
    expect(result).toBe('Background received: Hello from content');
  });

  test('content -> sidebar pingPong', async ({ contentPage }) => {
    await contentPage.waitForFunction(() => (window as any).__pomlContentScriptReady === true);
    const result = await contentPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.sidebar('Hello from content', 100);
    });
    expect(result).toBe('Sidebar received: Hello from content');
  });

  test('RPC error handling', async () => {
    // Test error handling when calling non-existent function
    const errorResult = await sidebarPage!.evaluate(async () => {
      try {
        const { callInRole } = window as any;
        // Try to call a non-existent function
        await callInRole('background', 'nonExistentFunction', 'test');
        return { success: true };
      } catch (error) {
        return {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    });

    expect(errorResult.success).toBe(false);
    expect(errorResult.errorMessage).toContain('nonExistentFunction');
  });

  test('RPC timeout handling', async () => {
    // Test timeout by calling a function that takes longer than timeout
    const timeoutResult = await sidebarPage!.evaluate(async () => {
      const startTime = Date.now();
      try {
        const { pingPong } = window as any;
        // Use a very long delay that should trigger timeout
        await pingPong.background('timeout test', 35000); // Longer than 30s timeout
        return { timedOut: false };
      } catch (error) {
        const elapsed = Date.now() - startTime;
        return {
          timedOut: error instanceof Error && error.message.includes('timeout'),
          elapsed,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    });

    expect(timeoutResult.timedOut).toBe(true);
    expect(timeoutResult.elapsed).toBeGreaterThanOrEqual(30000); // Should timeout at 30s
  });
});
