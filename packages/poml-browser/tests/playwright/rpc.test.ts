import { expect } from '@playwright/test';

import { test } from './extension.spec';

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

  test('content -> background pingPong', async ({ contentPage }) => {
    // Click the background ping button
    const button = contentPage.locator('#pingPongBackground');
    await button.click();

    // Wait for the result to appear in the button text
    await contentPage.waitForFunction(
      () => {
        const btn = document.querySelector('#pingPongBackground') as HTMLButtonElement;
        return btn && btn.textContent !== 'Pinging...' && btn.textContent !== 'Ping Background';
      },
      { timeout: 5000 },
    );

    // Get the result from button text
    const buttonText = await button.textContent();
    expect(buttonText).toBe('Result: Background received: Hello from content');
  });

  test('content -> sidebar pingPong', async ({ contentPage, sidebarPage }) => {
    // Click the sidebar ping button
    const button = contentPage.locator('#pingPongSidebar');
    await button.click();

    // Wait for the result to appear in the button text
    await contentPage.waitForFunction(
      () => {
        const btn = document.querySelector('#pingPongSidebar') as HTMLButtonElement;
        return btn && btn.textContent !== 'Pinging...' && btn.textContent !== 'Ping Sidebar';
      },
      { timeout: 5000 },
    );

    // Get the result from button text
    const buttonText = await button.textContent();
    expect(buttonText).toBe('Result: Sidebar received: Hello from content');
  });

  test('sidebar -> sidebar self pingPong', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.sidebar('Hello from sidebar to self', 100);
    });
    expect(result).toBe('Sidebar received: Hello from sidebar to self');
  });

  test('background -> background self pingPong', async ({ serviceWorker, sidebarPage }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;
      return await pingPong.background('Hello from background to self', 100);
    });
    expect(result).toBe('Background received: Hello from background to self');
  });

  test('content -> content self pingPong', async ({ contentPage }) => {
    // Click the content ping button
    const button = contentPage.locator('#pingPongContent');
    await button.click();

    // Wait for the result to appear in the button text
    await contentPage.waitForFunction(
      () => {
        const btn = document.querySelector('#pingPongContent') as HTMLButtonElement;
        return btn && btn.textContent !== 'Pinging...' && btn.textContent !== 'Ping Content';
      },
      { timeout: 5000 },
    );

    // Get the result from button text
    const buttonText = await button.textContent();
    expect(buttonText).toBe('Result: Content received: Hello from content');
  });
});
