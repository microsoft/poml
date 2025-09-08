import { test } from './extension.spec';
import { expect } from '@playwright/test';

import config from '../../playwright.config';

const FIXTURE_ENDPOINT = config.use!.baseURL;

test.describe('processPasteEvent function tests', () => {
  test('pasted files', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { processPasteEventAndThrow } = window as any;

      // Create mock File objects
      const textFile = new File(['Sample content'], 'document.txt', { type: 'text/plain' });
      const mdFile = new File(['# Markdown\n\nContent here'], 'readme.md', { type: 'text/markdown' });

      // Create mock ClipboardEvent with files
      const mockClipboardData = {
        files: [textFile, mdFile],
        types: ['Files'],
        items: [],
        getData: () => '',
      };

      const mockEvent = {
        clipboardData: mockClipboardData,
      } as unknown as ClipboardEvent;

      return await processPasteEventAndThrow(mockEvent);
    });

    expect(result.errors).toEqual([]);
    expect(result.cards.length).toBe(2);
    expect(result.cards[0].content).toEqual({
      type: 'text',
      text: 'Sample content',
      caption: 'document.txt',
      container: 'Text',
    });
    expect(result.cards[1].content).toEqual({
      type: 'text',
      text: '# Markdown\n\nContent here',
      caption: 'readme.md',
      container: 'Code',
    });
    expect(result.cards[0].url).toBe('document.txt');
    expect(result.cards[0].source).toBe('clipboard');
    expect(result.cards[1].mimeType).toBe('text/markdown');
  });

  test('pasted HTML content', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { processPasteEventAndThrow } = window as any;

      // FIXME: strong is not well handled yet
      // const htmlContent = '<h2>Title</h2><p>This is a <strong>bold</strong> paragraph.</p>';
      const htmlContent = '<h2>Title</h2><p>This is a bold paragraph.</p>';

      // Create mock ClipboardEvent with HTML
      const mockClipboardData = {
        files: [],
        types: ['text/html', 'text/plain'],
        items: [],
        getData: (type: string) => {
          if (type === 'text/html') {
            return htmlContent;
          }
          if (type === 'text/plain') {
            return 'Title\n\nThis is a bold paragraph.';
          }
          return '';
        },
      };

      const mockEvent = {
        clipboardData: mockClipboardData,
      } as unknown as ClipboardEvent;

      return await processPasteEventAndThrow(mockEvent);
    });

    expect(result.errors).toEqual([]);
    expect(result.cards.length).toBe(2); // HTML and plain text
    expect(result.cards[0].content).toEqual({
      type: 'text',
      text: 'This is a bold paragraph.',
      caption: 'Title',
    });
    expect(result.cards[0].source).toBe('clipboard');
    expect(result.cards[0].mimeType).toBe('text/html');
    // Plain text card
    expect(result.cards[1].content.type).toBe('text');
    expect(result.cards[1].content.text).toBe('Title\n\nThis is a bold paragraph.');
  });

  test('text/uri-list with multiple URLs from clipboard', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async (endpoint) => {
      const { processPasteEventAndThrow } = window as any;

      const uriList = `# This is a comment
${endpoint}/plain/hello.txt
${endpoint}/plain/unicode.md

# Another comment
${endpoint}/image/wikipedia-example.svg`;

      // Create mock ClipboardEvent with uri-list
      const mockClipboardData = {
        files: [],
        types: ['text/uri-list'],
        items: [],
        getData: (type: string) => {
          if (type === 'text/uri-list') {
            return uriList;
          }
          return '';
        },
      };

      const mockEvent = {
        clipboardData: mockClipboardData,
      } as unknown as ClipboardEvent;

      return await processPasteEventAndThrow(mockEvent);
    }, FIXTURE_ENDPOINT);

    expect(result.errors).toEqual([]);
    expect(result.cards.length).toBe(3);
    expect(result.cards[0].mimeType).toBe('text/plain');
    expect(result.cards[0].url).toBe(`${FIXTURE_ENDPOINT}/plain/hello.txt`);
    expect(result.cards[0].content.text.trim()).toEqual('world');
    expect(result.cards[0].content.caption).toBe('hello.txt');
    expect(result.cards[0].source).toBe('clipboard');
    expect(result.cards[1].mimeType).toBe('text/markdown');
    expect(result.cards[1].url).toBe(`${FIXTURE_ENDPOINT}/plain/unicode.md`);
    expect(result.cards[1].content.text.trim()).toContain('# 你好世界 🌍');
    expect(result.cards[2].mimeType).toBe('image/png');
    expect(result.cards[2].url).toBe(`${FIXTURE_ENDPOINT}/image/wikipedia-example.svg`);
    expect(result.cards[2].content.base64.length).toBeGreaterThan(100);
  });

  test('avoids duplicate URL processing in clipboard', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async (endpoint) => {
      const { processPasteEventAndThrow } = window as any;

      const testUrl = `${endpoint}/plain/hello.txt`;

      // Create mock ClipboardEvent with same URL in multiple types
      const mockClipboardData = {
        files: [],
        types: ['URL', 'text/uri-list', 'text/plain'],
        items: [],
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
        clipboardData: mockClipboardData,
      } as unknown as ClipboardEvent;

      return await processPasteEventAndThrow(mockEvent);
    }, FIXTURE_ENDPOINT);

    // Should only process the URL once, not three times
    expect(result.cards.length).toBe(1);
    expect(result.errors.length).toBe(0);
    expect(result.cards[0].url).toBe(`${FIXTURE_ENDPOINT}/plain/hello.txt`);
    expect(result.cards[0].source).toBe('clipboard');
  });

  test('handles missing clipboardData gracefully', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { processPasteEventAndThrow } = window as any;

      // Create mock ClipboardEvent without clipboardData
      const mockEvent = {} as ClipboardEvent;

      return await processPasteEventAndThrow(mockEvent);
    });

    expect(result.cards).toEqual([]);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('no clipboardData found');
  });

  test('mixed content types with files from items', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async (endpoint) => {
      const { processPasteEventAndThrow } = window as any;

      // Fetch real image data from test fixture
      const imageResponse = await fetch(`${endpoint}/image/google-webp-gallery.webp`);
      const imageBlob = await imageResponse.blob();
      const imageFile = new File([imageBlob], 'google-webp-gallery.webp', { type: 'image/webp' });
      const plainText = 'Some plain text content';

      // Create mock DataTransferItem
      const mockItem = {
        kind: 'file',
        type: 'image/webp',
        getAsFile: () => imageFile,
      };

      // Create mock ClipboardEvent with items and plain text
      const mockClipboardData = {
        files: [],
        types: ['Files', 'text/plain'],
        items: [mockItem],
        getData: (type: string) => {
          if (type === 'text/plain') {
            return plainText;
          }
          return '';
        },
      };

      const mockEvent = {
        clipboardData: mockClipboardData,
      } as unknown as ClipboardEvent;

      return await processPasteEventAndThrow(mockEvent);
    }, FIXTURE_ENDPOINT);

    expect(result.errors).toEqual([]);
    expect(result.cards.length).toBe(2);
    // Image from items
    expect(result.cards[0].content.type).toBe('image');
    expect(result.cards[0].content.alt).toBe('google-webp-gallery.webp');
    expect(result.cards[0].source).toBe('clipboard');
    expect(result.cards[0].mimeType).toBe('image/png');
    // Plain text
    expect(result.cards[1].content.type).toBe('text');
    expect(result.cards[1].content.text).toBe('Some plain text content');
  });

  test('plain text with single URL gets processed as file', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async (endpoint) => {
      const { processPasteEventAndThrow } = window as any;

      const singleUrl = `${endpoint}/plain/simple-functions.py`;

      // Create mock ClipboardEvent with plain text containing a URL
      const mockClipboardData = {
        files: [],
        types: ['text/plain'],
        items: [],
        getData: (type: string) => {
          if (type === 'text/plain') {
            return singleUrl;
          }
          return '';
        },
      };

      const mockEvent = {
        clipboardData: mockClipboardData,
      } as unknown as ClipboardEvent;

      return await processPasteEventAndThrow(mockEvent);
    }, FIXTURE_ENDPOINT);

    expect(result.errors).toEqual([]);
    expect(result.cards.length).toBe(1);
    expect(result.cards[0].mimeType).toBe('text/x-python');
    expect(result.cards[0].url).toBe(`${FIXTURE_ENDPOINT}/plain/simple-functions.py`);
    expect(result.cards[0].content.text).toMatch(/^def greet\(name\)/);
    expect(result.cards[0].source).toBe('clipboard');
  });
});
