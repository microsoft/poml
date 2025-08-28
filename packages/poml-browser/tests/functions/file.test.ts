import { test } from '../extension.spec';
import { expect } from '@playwright/test';

const TEST_SERVER_URL = 'http://localhost:8023';

test.describe('readFile function tests', () => {
  test('reads text file with UTF-8', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const content = await readFile(url, { encoding: 'utf-8' });
      return content;
    }, `${TEST_SERVER_URL}/plain/hello.txt`);

    expect(result).toContain('world');
  });

  test('reads file without encoding returns ArrayBuffer', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const buffer = await readFile(url);
      const decoder = new TextDecoder();
      return decoder.decode(buffer);
    }, `${TEST_SERVER_URL}/plain/hello.txt`);

    expect(result).toContain('world');
  });

  test('reads Python file', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const content = await readFile(url, { encoding: 'utf-8' });
      return content;
    }, `${TEST_SERVER_URL}/plain/simple-functions.py`);

    expect(result).toContain('def');
  });

  test('encodes to base64', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const base64 = await readFile(url, { encoding: 'base64' });
      const decoded = atob(base64);
      return { base64, decoded };
    }, `${TEST_SERVER_URL}/plain/hello.txt`);

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
    }, `${TEST_SERVER_URL}/image/gpt-5-random-image.png`);

    expect(result).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG header
  });

  test('handles utf8 encoding variant', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const content = await readFile(url, { encoding: 'utf8' });
      return content;
    }, `${TEST_SERVER_URL}/plain/hello.txt`);

    expect(result).toContain('world');
  });

  test('returns ArrayBuffer with undefined encoding', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const buffer = await readFile(url, { encoding: undefined });
      return buffer instanceof ArrayBuffer;
    }, `${TEST_SERVER_URL}/plain/hello.txt`);

    expect(result).toBe(true);
  });

  test('reads PDF as base64', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const base64 = await readFile(url, { encoding: 'base64' });
      const decoded = atob(base64.slice(0, 100));
      return decoded.startsWith('%PDF');
    }, `${TEST_SERVER_URL}/pdf/trivial-libre-office-writer.pdf`);

    expect(result).toBe(true);
  });

  test('reads File object', async ({ contentPage }) => {
    const result = await contentPage.evaluate(async () => {
      const text = 'File object test content';
      const file = new File([text], 'test.txt', { type: 'text/plain' });
      const { readFile } = window as any;
      const content = await readFile(file, { encoding: 'utf-8' });
      return content;
    });

    expect(result).toBe('File object test content');
  });

  test('reads Blob object', async ({ contentPage }) => {
    const result = await contentPage.evaluate(async () => {
      const text = 'Blob object test content';
      const blob = new Blob([text], { type: 'text/plain' });
      const { readFile } = window as any;
      const content = await readFile(blob, { encoding: 'utf-8' });
      return content;
    });

    expect(result).toBe('Blob object test content');
  });

  test('reads binary Blob as ArrayBuffer', async ({ contentPage }) => {
    const result = await contentPage.evaluate(async () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const blob = new Blob([bytes]);
      const { readFile } = window as any;
      const buffer = await readFile(blob);
      const decoder = new TextDecoder();
      return decoder.decode(buffer);
    });

    expect(result).toBe('Hello');
  });

  test('encodes File to base64', async ({ contentPage }) => {
    const result = await contentPage.evaluate(async () => {
      const text = 'Base64 file test';
      const file = new File([text], 'test.txt', { type: 'text/plain' });
      const { readFile } = window as any;
      const base64 = await readFile(file, { encoding: 'base64' });
      const decoded = atob(base64);
      return { base64, decoded };
    });

    expect(result.decoded).toBe('Base64 file test');
  });

  test('throws on non-existent URL', async ({ serviceWorker }) => {
    const error = await serviceWorker.evaluate(async (url) => {
      try {
        const { readFile } = self as any;
        await readFile(url, { encoding: 'utf-8' });
        return null;
      } catch (e: any) {
        return e.message;
      }
    }, `${TEST_SERVER_URL}/non-existent-file.txt`);

    expect(error).toContain('Failed to fetch file');
  });

  test('throws on unsupported encoding', async ({ serviceWorker }) => {
    const error = await serviceWorker.evaluate(async (url) => {
      try {
        const { readFile } = self as any;
        await readFile(url, { encoding: 'unsupported' as any });
        return null;
      } catch (e: any) {
        return e.message;
      }
    }, `${TEST_SERVER_URL}/plain/hello.txt`);

    expect(error).toContain('Unsupported encoding');
  });

  test('throws on invalid source type', async ({ serviceWorker }) => {
    const error = await serviceWorker.evaluate(async () => {
      try {
        const { readFile } = self as any;
        await readFile(123 as any, { encoding: 'utf-8' });
        return null;
      } catch (e: any) {
        return e.message;
      }
    });

    expect(error).toContain('Source must be a string path, File, or Blob object');
  });

  test('throws on home directory path', async ({ serviceWorker }) => {
    const error = await serviceWorker.evaluate(async () => {
      try {
        const { readFile } = self as any;
        await readFile('~/test.txt', { encoding: 'utf-8' });
        return null;
      } catch (e: any) {
        return e.message;
      }
    });

    expect(error).toContain('Home directory paths (~/) require platform-specific implementation');
  });

  test('handles relative paths', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      try {
        const { readFile } = self as any;
        await readFile('plain/hello.txt', { encoding: 'utf-8' });
        return 'success';
      } catch (e: any) {
        return e.message;
      }
    });

    expect(result).toBeTruthy();
  });

  test('handles CORS errors', async ({ serviceWorker }) => {
    const error = await serviceWorker.evaluate(async () => {
      try {
        const { readFile } = self as any;
        await readFile('https://example.com/file.txt', { encoding: 'utf-8' });
        return null;
      } catch (e: any) {
        return 'error occurred';
      }
    });

    expect(error).toBe('error occurred');
  });
});
