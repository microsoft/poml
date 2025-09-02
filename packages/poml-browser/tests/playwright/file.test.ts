import { test } from './extension.spec';
import { expect } from '@playwright/test';

import config from '../../playwright.config';

const FIXTURE_ENDPOINT = config.use!.baseURL;
const testFixturesPath = config.metadata!.testFixturesPath;

test.describe('readFile function tests with TextFile/BinaryFile interface', () => {
  test('reads text file with UTF-8 and returns TextFile interface', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: 'utf-8' });
      return {
        content: file.content,
        mimeType: file.mimeType,
        size: file.size,
        isTextFile: typeof file.content === 'string',
      };
    }, `${FIXTURE_ENDPOINT}/plain/hello.txt`);

    expect(result.content).toContain('world');
    expect(result.mimeType).toBe('text/plain');
    expect(result.size).toBeGreaterThan(0);
    expect(result.isTextFile).toBe(true);
  });

  test('reads file without encoding returns BinaryFile interface', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url);
      const decoder = new TextDecoder();
      return {
        decodedContent: decoder.decode(file.content),
        mimeType: file.mimeType,
        size: file.size,
        isBinaryFile: file.content instanceof ArrayBuffer,
      };
    }, `${FIXTURE_ENDPOINT}/plain/hello.txt`);

    expect(result.decodedContent).toContain('world');
    expect(result.mimeType).toBe('text/plain');
    expect(result.size).toBeGreaterThan(0);
    expect(result.isBinaryFile).toBe(true);
  });

  test('reads Python file with correct MIME type', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: 'utf-8' });
      return {
        content: file.content,
        mimeType: file.mimeType,
        size: file.size,
      };
    }, `${FIXTURE_ENDPOINT}/plain/simple-functions.py`);

    expect(result.content).toContain('def');
    expect(result.mimeType).toMatch(/python|x-python|plain/); // Python files may have different MIME types
    expect(result.size).toBeGreaterThan(0);
  });

  test('encodes to base64 and returns TextFile', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: 'base64' });
      const decoded = atob(file.content);
      return {
        base64: file.content,
        decoded,
        mimeType: file.mimeType,
        size: file.size,
        isString: typeof file.content === 'string',
      };
    }, `${FIXTURE_ENDPOINT}/plain/hello.txt`);

    expect(result.decoded).toContain('world');
    expect(result.base64).toBeTruthy();
    expect(result.mimeType).toBe('text/plain');
    expect(result.size).toBeGreaterThan(0);
    expect(result.isString).toBe(true);
  });

  test('reads binary image data with correct MIME type', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: 'binary' });
      const bytes = new Uint8Array(file.content);
      // Check PNG header bytes
      return {
        headerBytes: [bytes[0], bytes[1], bytes[2], bytes[3]],
        mimeType: file.mimeType,
        size: file.size,
        isArrayBuffer: file.content instanceof ArrayBuffer,
      };
    }, `${FIXTURE_ENDPOINT}/image/gpt-5-random-image.png`);

    expect(result.headerBytes).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG header
    expect(result.mimeType).toBe('image/png');
    expect(result.size).toBeGreaterThan(0);
    expect(result.isArrayBuffer).toBe(true);
  });

  test('handles utf8 encoding variant', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: 'utf8' });
      return {
        content: file.content,
        mimeType: file.mimeType,
        size: file.size,
      };
    }, `${FIXTURE_ENDPOINT}/plain/hello.txt`);

    expect(result.content).toContain('world');
    expect(result.mimeType).toBe('text/plain');
    expect(result.size).toBeGreaterThan(0);
  });

  test('returns BinaryFile with undefined encoding', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: undefined });
      return {
        isArrayBuffer: file.content instanceof ArrayBuffer,
        mimeType: file.mimeType,
        size: file.size,
      };
    }, `${FIXTURE_ENDPOINT}/plain/hello.txt`);

    expect(result.isArrayBuffer).toBe(true);
    expect(result.mimeType).toBe('text/plain');
    expect(result.size).toBeGreaterThan(0);
  });

  test('reads PDF as base64 with correct MIME type', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: 'base64' });
      const decoded = atob(file.content.slice(0, 100));
      return {
        isPDF: decoded.startsWith('%PDF'),
        mimeType: file.mimeType,
        size: file.size,
      };
    }, `${FIXTURE_ENDPOINT}/pdf/trivial-libre-office-writer.pdf`);

    expect(result.isPDF).toBe(true);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.size).toBeGreaterThan(0);
  });

  test('reads File object in memory with metadata', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { readFile } = self as any;
      const text = 'File object test content';
      const file = new File([text], 'test.txt', { type: 'text/plain' });
      const readResult = await readFile(file, { encoding: 'utf-8' });
      return {
        content: readResult.content,
        mimeType: readResult.mimeType,
        size: readResult.size,
      };
    });

    expect(result.content).toBe('File object test content');
    expect(result.mimeType).toBe('text/plain');
    expect(result.size).toBe(24); // Length of 'File object test content'
  });

  test('reads Blob object in memory with metadata', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { readFile } = self as any;
      const text = 'Blob object test content';
      const blob = new Blob([text], { type: 'text/markdown' });
      const readResult = await readFile(blob, { encoding: 'utf-8' });
      return {
        content: readResult.content,
        mimeType: readResult.mimeType,
        size: readResult.size,
      };
    });

    expect(result.content).toBe('Blob object test content');
    expect(result.mimeType).toBe('text/markdown');
    expect(result.size).toBe(24); // Length of 'Blob object test content'
  });

  test('reads file from path with proper MIME type detection', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: 'utf-8' });
      return {
        content: file.content,
        mimeType: file.mimeType,
        size: file.size,
      };
    }, `${testFixturesPath}/plain/hello.txt`);

    expect(result.content).toContain('world');
    expect(result.mimeType).toBe('text/plain');
    expect(result.size).toBeGreaterThan(0);
  });

  test('reads binary file from sidebar', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async (url) => {
      const { readFile } = window as any;
      const file = await readFile(url, { encoding: 'binary' });
      const bytes = new Uint8Array(file.content);
      // Check PNG header bytes
      return {
        headerBytes: [bytes[0], bytes[1], bytes[2], bytes[3]],
        mimeType: file.mimeType,
        size: file.size,
      };
    }, `${testFixturesPath}/image/gpt-5-random-image.png`);

    expect(result.headerBytes).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG header
    expect(result.mimeType).toBe('image/png');
    expect(result.size).toBeGreaterThan(0);
  });

  test('reads PDF file from sidebar with metadata', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async (url) => {
      const { readFile } = window as any;
      const file = await readFile(url, { encoding: 'base64' });
      return {
        base64Start: file.content.substring(0, 12),
        mimeType: file.mimeType,
        size: file.size,
      };
    }, `${FIXTURE_ENDPOINT}/pdf/trivial-libre-office-writer.pdf`);

    expect(result.base64Start).toBe('JVBERi0xLjUK'); // PDF file base64 start
    expect(result.mimeType).toBe('application/pdf');
    expect(result.size).toBeGreaterThan(0);
  });

  test('file size is calculated correctly for different encodings', async ({ serviceWorker }) => {
    const url = `${FIXTURE_ENDPOINT}/plain/hello.txt`;

    // Read as binary to get actual byte size
    const binaryResult = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: 'binary' });
      return file.size;
    }, url);

    // Read as UTF-8 - size should be the same (byte count)
    const utf8Result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: 'utf-8' });
      return file.size;
    }, url);

    // Read as base64 - size should be the byte count of the original content
    const base64Result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const file = await readFile(url, { encoding: 'base64' });
      return file.size;
    }, url);

    // All should report the same size (original file size in bytes)
    expect(binaryResult).toBeGreaterThan(0);
    expect(utf8Result).toBe(binaryResult);
    expect(base64Result).toBe(binaryResult);
  });
});
