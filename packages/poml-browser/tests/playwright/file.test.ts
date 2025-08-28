import { test } from './extension.spec';
import { expect } from '@playwright/test';

import config from '../../playwright.config';

const FIXTURE_ENDPOINT = config.use!.baseURL;
const testFixturesPath = config.metadata!.testFixturesPath;

test.describe('readFile function tests', () => {
  test('reads text file with UTF-8', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const content = await readFile(url, { encoding: 'utf-8' });
      return content;
    }, `${FIXTURE_ENDPOINT}/plain/hello.txt`);

    expect(result).toContain('world');
  });

  test('reads file without encoding returns ArrayBuffer', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const buffer = await readFile(url);
      const decoder = new TextDecoder();
      return decoder.decode(buffer);
    }, `${FIXTURE_ENDPOINT}/plain/hello.txt`);

    expect(result).toContain('world');
  });

  test('reads Python file', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const content = await readFile(url, { encoding: 'utf-8' });
      return content;
    }, `${FIXTURE_ENDPOINT}/plain/simple-functions.py`);

    expect(result).toContain('def');
  });

  test('encodes to base64', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const base64 = await readFile(url, { encoding: 'base64' });
      const decoded = atob(base64);
      return { base64, decoded };
    }, `${FIXTURE_ENDPOINT}/plain/hello.txt`);

    expect(result.decoded).toContain('world');
    expect(result.base64).toBeTruthy();
  });

  test('reads binary image data', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const buffer = await readFile(url, { encoding: 'binary' });
      const bytes = new Uint8Array(buffer);
      // Check PNG header bytes
      return [bytes[0], bytes[1], bytes[2], bytes[3]];
    }, `${FIXTURE_ENDPOINT}/image/gpt-5-random-image.png`);

    expect(result).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG header
  });

  test('handles utf8 encoding variant', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const content = await readFile(url, { encoding: 'utf8' });
      return content;
    }, `${FIXTURE_ENDPOINT}/plain/hello.txt`);

    expect(result).toContain('world');
  });

  test('returns ArrayBuffer with undefined encoding', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const buffer = await readFile(url, { encoding: undefined });
      return buffer instanceof ArrayBuffer;
    }, `${FIXTURE_ENDPOINT}/plain/hello.txt`);

    expect(result).toBe(true);
  });

  test('reads PDF as base64', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const base64 = await readFile(url, { encoding: 'base64' });
      const decoded = atob(base64.slice(0, 100));
      return decoded.startsWith('%PDF');
    }, `${FIXTURE_ENDPOINT}/pdf/trivial-libre-office-writer.pdf`);

    expect(result).toBe(true);
  });

  test('reads file in memory', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { readFile } = self as any;
      const text = 'File object test content';
      const file = new File([text], 'test.txt', { type: 'text/plain' });
      const content = await readFile(file, { encoding: 'utf-8' });
      return content;
    });

    expect(result).toBe('File object test content');
  });

  test('reads blob in memory', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { readFile } = self as any;
      const text = 'Blob object test content';
      const blob = new Blob([text], { type: 'text/plain' });
      const content = await readFile(blob, { encoding: 'utf-8' });
      return content;
    });
    expect(result).toBe('Blob object test content');
  });

  test('reads file from path', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const content = await readFile(url, { encoding: 'utf-8' });
      return content;
    }, `${testFixturesPath}/plain/hello.txt`);

    expect(result).toContain('world');
  });

  test('reads binary file from sidebar', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async (url) => {
      const { readFile } = window as any;
      const buffer = await readFile(url, { encoding: 'binary' });
      const bytes = new Uint8Array(buffer);
      // Check PNG header bytes
      return [bytes[0], bytes[1], bytes[2], bytes[3]];
    }, `${testFixturesPath}/image/gpt-5-random-image.png`);
    expect(result).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG header
  });

  test('reads PDF file from sidebar', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async (url) => {
      const { readFile } = window as any;
      const base64 = await readFile(url, { encoding: 'base64' });
      return base64;
    }, `${FIXTURE_ENDPOINT}/pdf/trivial-libre-office-writer.pdf`);
    expect(result.startsWith('JVBERi0xLjUK')).toBe(true); // PDF file base64 start
  });
});
