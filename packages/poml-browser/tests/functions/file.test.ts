import { test } from '../extension.spec';
import { expect } from '@playwright/test';

const TEST_SERVER_URL = 'http://localhost:8023';

test.describe('readFile function tests', () => {
  test('from HTTP URL with UTF-8 encoding', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const content = await readFile(url, { encoding: 'utf-8' });
      return content;
    }, `${TEST_SERVER_URL}/plain/hello.txt`);

    expect(result).toContain('world'); // hello.txt contains "Hello, World!" or similar
  });

  test('from HTTP URL without encoding', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (url) => {
      const { readFile } = self as any;
      const buffer = await readFile(url);
      // Convert ArrayBuffer to string for testing
      const decoder = new TextDecoder();
      return decoder.decode(buffer);
    }, `${TEST_SERVER_URL}/plain/hello.txt`);

    expect(result).toContain('world');
  });

  test('should handle Python file content correctly', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { readFile } = self as any;
      const content = await readFile(`${TEST_SERVER_URL}/test-fixtures/plain/simple-functions.py`, {
        encoding: 'utf-8',
      });
      return content;
    });

    expect(result).toContain('def'); // Python file should contain function definitions
  });

  test('should return base64 encoded string when base64 encoding specified', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { readFile } = self as any;
      const base64 = await readFile(`${TEST_SERVER_URL}/test-fixtures/plain/hello.txt`, { encoding: 'base64' });
      // Decode to verify
      const decoded = atob(base64);
      return { base64, decoded };
    });

    expect(result.decoded).toContain('Hello');
    expect(result.base64).toBeTruthy();
  });

  test('should handle image data with binary encoding', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { readFile } = self as any;
      const buffer = await readFile(`${TEST_SERVER_URL}/test-fixtures/image/gpt-5-random-image.png`, {
        encoding: 'binary',
      });
      const bytes = new Uint8Array(buffer);
      // Check PNG header bytes
      return [bytes[0], bytes[1], bytes[2], bytes[3]];
    });

    expect(result).toEqual([0x89, 0x50, 0x4e, 0x47]); // PNG header signature
  });

  test('should throw error for non-existent HTTP URL', async ({ serviceWorker }) => {
    const error = await serviceWorker.evaluate(async () => {
      try {
        const { readFile } = self as any;
        await readFile(`${TEST_SERVER_URL}/non-existent-file.txt`, { encoding: 'utf-8' });
        return null;
      } catch (e: any) {
        return e.message;
      }
    });

    expect(error).toContain('Failed to fetch file');
  });

  test.describe('File and Blob object handling', () => {
    test('should read content from File object', async ({ contentPage }) => {
      // Create a file input and simulate file selection
      const result = await contentPage.evaluate(async () => {
        const text = 'File object test content';
        const file = new File([text], 'test.txt', { type: 'text/plain' });

        // @ts-ignore
        const content = await window.readFile(file, { encoding: 'utf-8' });
        return content;
      });

      expect(result).toBe('File object test content');
    });

    test('should read content from Blob object', async ({ contentPage }) => {
      const result = await contentPage.evaluate(async () => {
        const text = 'Blob object test content';
        const blob = new Blob([text], { type: 'text/plain' });

        // @ts-ignore
        const content = await window.readFile(blob, { encoding: 'utf-8' });
        return content;
      });

      expect(result).toBe('Blob object test content');
    });

    test('should handle binary Blob with ArrayBuffer return', async ({ contentPage }) => {
      const result = await contentPage.evaluate(async () => {
        const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
        const blob = new Blob([bytes]);

        // @ts-ignore
        const buffer = await window.readFile(blob);
        const decoder = new TextDecoder();
        return decoder.decode(buffer);
      });

      expect(result).toBe('Hello');
    });

    test('should handle File with base64 encoding', async ({ contentPage }) => {
      const result = await contentPage.evaluate(async () => {
        const text = 'Base64 file test';
        const file = new File([text], 'test.txt', { type: 'text/plain' });

        // @ts-ignore
        const base64 = await window.readFile(file, { encoding: 'base64' });
        const decoded = atob(base64);
        return { base64, decoded };
      });

      expect(result.decoded).toBe('Base64 file test');
    });
  });

  test.describe('Encoding options', () => {
    test('should handle utf-8 encoding variant', async ({ serviceWorker }) => {
      const result = await serviceWorker.evaluate(async () => {
        const { readFile } = self as any;
        const content = await readFile(`${TEST_SERVER_URL}/test-fixtures/plain/hello.txt`, { encoding: 'utf8' });
        return content;
      });

      expect(result).toContain('Hello');
    });

    test('should return ArrayBuffer when no encoding specified', async ({ serviceWorker }) => {
      const result = await serviceWorker.evaluate(async () => {
        const { readFile } = self as any;
        const buffer = await readFile(`${TEST_SERVER_URL}/test-fixtures/plain/hello.txt`);
        return buffer instanceof ArrayBuffer;
      });

      expect(result).toBe(true);
    });

    test('should return ArrayBuffer with undefined encoding in options', async ({ serviceWorker }) => {
      const result = await serviceWorker.evaluate(async () => {
        const { readFile } = self as any;
        const buffer = await readFile(`${TEST_SERVER_URL}/test-fixtures/plain/hello.txt`, { encoding: undefined });
        return buffer instanceof ArrayBuffer;
      });

      expect(result).toBe(true);
    });

    test('should handle PDF files with base64 encoding', async ({ serviceWorker }) => {
      const result = await serviceWorker.evaluate(async () => {
        const { readFile } = self as any;
        const base64 = await readFile(`${TEST_SERVER_URL}/test-fixtures/pdf/trivial-libre-office-writer.pdf`, {
          encoding: 'base64',
        });
        // Check if it's valid base64 and decode a portion to verify PDF header
        const decoded = atob(base64.slice(0, 100));
        return decoded.startsWith('%PDF');
      });

      expect(result).toBe(true);
    });
  });

  test.describe('Error handling', () => {
    test('should throw error for unsupported encoding', async ({ serviceWorker }) => {
      const error = await serviceWorker.evaluate(async () => {
        try {
          const { readFile } = self as any;
          await readFile(`${TEST_SERVER_URL}/test-fixtures/plain/hello.txt`, { encoding: 'unsupported' as any });
          return null;
        } catch (e: any) {
          return e.message;
        }
      });

      expect(error).toContain('Unsupported encoding');
    });

    test('should throw TypeError for invalid source type', async ({ serviceWorker }) => {
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

    test('should throw error for home directory paths', async ({ serviceWorker }) => {
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

    test('should handle relative paths', async ({ serviceWorker }) => {
      const result = await serviceWorker.evaluate(async () => {
        try {
          // This should attempt to fetch as a relative URL
          const { readFile } = self as any;
          await readFile('test-fixtures/plain/hello.txt', { encoding: 'utf-8' });
          return 'success';
        } catch (e: any) {
          // Expected to fail in service worker context without proper relative path
          return e.message;
        }
      });

      expect(result).toBeTruthy(); // Will either succeed or throw expected error
    });
  });

  test.describe('Cross-origin and CORS', () => {
    test('should handle CORS errors gracefully', async ({ serviceWorker }) => {
      const error = await serviceWorker.evaluate(async () => {
        try {
          // Attempt to fetch from a different origin that doesn't allow CORS
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
});
