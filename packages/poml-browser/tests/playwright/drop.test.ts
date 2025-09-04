import { test } from './extension.spec';
import { expect } from '@playwright/test';

import config from '../../playwright.config';

const FIXTURE_ENDPOINT = config.use!.baseURL;

test.describe('processDropEvent function tests', () => {
  test('dropped files', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { processDropEventAndThrow } = window as any;

      // Create mock File objects
      const textFile = new File(['Hello World'], 'test.txt', { type: 'text/plain' });
      const imageFile = new File(['Hello World Again'], 'test2.txt', { type: 'text/plain' });

      // Create mock DragEvent with files
      const mockDataTransfer = {
        files: [textFile, imageFile],
        types: ['Files'],
        getData: () => '',
      };

      const mockEvent = {
        dataTransfer: mockDataTransfer,
      } as unknown as DragEvent;

      return await processDropEventAndThrow(mockEvent);
    });

    expect(result.errors).toEqual([]);
    expect(result.cards.length).toBe(2);
    expect(result.cards[0].content).toEqual({
      type: 'text',
      text: 'Hello World',
      caption: 'test.txt',
      container: 'CaptionedParagraph',
    });
    expect(result.cards[1].content).toEqual({
      type: 'text',
      text: 'Hello World Again',
      caption: 'test2.txt',
      container: 'CaptionedParagraph',
    });
    expect(result.cards[0].url).toBe('test.txt');
    expect(result.cards[0].source).toBe('drop');
    expect(result.cards[1].mimeType).toBe('text/plain');
  });

  test('dropped HTML content', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { processDropEventAndThrow } = window as any;

      const htmlContent = '<h1>Test</h1><p>Content</p>';

      // Create mock DragEvent with HTML
      const mockDataTransfer = {
        files: [],
        types: ['text/html'],
        getData: (type: string) => {
          if (type === 'text/html') {
            return htmlContent;
          }
          return '';
        },
      };

      const mockEvent = {
        dataTransfer: mockDataTransfer,
      } as unknown as DragEvent;

      return await processDropEventAndThrow(mockEvent);
    });

    expect(result.errors).toEqual([]);
    expect(result.cards.length).toBe(1);
    expect(result.cards[0].content).toEqual({ type: 'text', text: 'Content', caption: 'Test' });
    expect(result.cards[0].url).toBeUndefined();
    expect(result.cards[0].source).toBe('drop');
    expect(result.cards[0].mimeType).toBe('text/html');
  });

  test('text/uri-list with multiple URLs', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async (endpoint) => {
      const { processDropEventAndThrow } = window as any;

      const uriList = `# Comment line should be ignored
${endpoint}/plain/hello.txt
${endpoint}/plain/simple-functions.py

# Another comment
${endpoint}/image/wikipedia-example.svg`;

      // Create mock DragEvent with uri-list
      const mockDataTransfer = {
        files: [],
        types: ['text/uri-list'],
        getData: (type: string) => {
          if (type === 'text/uri-list') {
            return uriList;
          }
          return '';
        },
      };

      const mockEvent = {
        dataTransfer: mockDataTransfer,
      } as unknown as DragEvent;

      return await processDropEventAndThrow(mockEvent);
    }, FIXTURE_ENDPOINT);

    expect(result.errors).toEqual([]);
    expect(result.cards.length).toBe(3);
    expect(result.cards[0].mimeType).toBe('text/plain');
    expect(result.cards[0].url).toBe(`${FIXTURE_ENDPOINT}/plain/hello.txt`);
    expect(result.cards[0].content.text.trim()).toEqual('world'); // opt out of checking endlines
    expect(result.cards[0].content.caption).toBe('hello.txt');
    expect(result.cards[1].mimeType).toBe('text/x-python');
    expect(result.cards[1].url).toBe(`${FIXTURE_ENDPOINT}/plain/simple-functions.py`);
    expect(result.cards[1].content.text).toMatch(/^def greet\(name\)/);
    expect(result.cards[2].mimeType).toBe('image/png');
    expect(result.cards[2].url).toBe(`${FIXTURE_ENDPOINT}/image/wikipedia-example.svg`);
    expect(result.cards[2].content.base64.length).toBeGreaterThan(100);
    expect(result.cards[2].content.alt).toBe('wikipedia-example.svg');
  });

  test('avoids duplicate URL processing', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async (endpoint) => {
      const { processDropEventAndThrow } = window as any;

      const testUrl = `${endpoint}/plain/hello.txt`;

      // Create mock DragEvent with same URL in multiple types
      const mockDataTransfer = {
        files: [],
        types: ['URL', 'text/uri-list', 'text/plain'],
        getData: (type: string) => {
          if (type === 'URL') {
            return testUrl;
          }
          if (type === 'text/uri-list') {
            return testUrl;
          }
          if (type === 'text/plain') {
            return testUrl;
          }
          return '';
        },
      };

      const mockEvent = {
        dataTransfer: mockDataTransfer,
      } as unknown as DragEvent;

      return await processDropEventAndThrow(mockEvent);
    }, FIXTURE_ENDPOINT);

    // Should only process the URL once, not three times
    expect(result.cards.length).toBe(1);
    expect(result.errors.length).toBe(0);
  });

  test('handles missing dataTransfer gracefully', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { processDropEventAndThrow } = window as any;

      // Create mock DragEvent without dataTransfer
      const mockEvent = {} as DragEvent;

      return await processDropEventAndThrow(mockEvent);
    });

    expect(result.cards).toEqual([]);
    expect(result.errors.length).toBe(1);
  });

  test('handles empty drop event', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { processDropEventAndThrow } = window as any;

      // Create mock DragEvent with empty dataTransfer
      const mockDataTransfer = {
        files: [],
        types: [],
        getData: () => '',
      };

      const mockEvent = {
        dataTransfer: mockDataTransfer,
      } as unknown as DragEvent;

      return await processDropEventAndThrow(mockEvent);
    });

    expect(result.cards.length).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  test('mixed content types in order', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { processDropEventAndThrow } = window as any;

      const textFile = new File(['File content'], 'test.txt', { type: 'text/plain' });
      const htmlContent = '<h1>HTML</h1>';
      const plainText = 'Plain text';

      // Create mock DragEvent with multiple content types
      const mockDataTransfer = {
        files: [textFile],
        types: ['Files', 'text/html', 'text/plain'],
        getData: (type: string) => {
          if (type === 'text/html') {
            return htmlContent;
          }
          if (type === 'text/plain') {
            return plainText;
          }
          return '';
        },
      };

      const mockEvent = {
        dataTransfer: mockDataTransfer,
      } as unknown as DragEvent;

      return await processDropEventAndThrow(mockEvent);
    });
    expect(result.errors).toEqual([]);
    expect(result.cards.length).toBe(3);
    expect(result.cards[0].content).toEqual({
      type: 'text',
      text: 'File content',
      caption: 'test.txt',
      container: 'CaptionedParagraph',
    });
    expect(result.cards[1].content).toEqual({ type: 'text', text: '', caption: 'HTML' });
  });
});
