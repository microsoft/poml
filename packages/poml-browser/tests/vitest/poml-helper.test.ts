import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { richContentToString, renderCardsByPoml } from '@common/poml-helper';
import { CardModel, SettingsBundle } from '@common/types';
import { RichContent } from 'poml';
import { reactRender } from 'poml/util/reactRender';
import path from 'path';
import { readFileSync } from 'fs';

// Mock getSettings globally to return default settings
vi.mock('@common/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({
    theme: 'auto',
    uiNotificationLevel: 'info',
    consoleNotificationLevel: 'info',
  } as SettingsBundle),
  setSettings: vi.fn(),
  clearSettingsCache: vi.fn(),
}));

// Mock everywhere function to execute locally instead of using RPC
vi.mock('@common/rpc', () => ({
  everywhere: vi.fn().mockImplementation((functionName: string, handlerOrRole: any, role?: any) => {
    if (typeof handlerOrRole === 'function') {
      // Second overload: everywhere(functionName, handler, role) - return the handler function directly
      return handlerOrRole;
    } else {
      // First overload: everywhere(functionName, role) - return a mock function
      return vi.fn();
    }
  }),
  detectCurrentRole: vi.fn().mockReturnValue('test'),
  pingPong: {},
}));

// Mock renderElementToString to use Node.js reactRender instead of browser renderToReadableStream
vi.mock('@common/utils/react', async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    renderElementToString: vi.fn().mockImplementation(async (element: React.ReactElement) => {
      return await reactRender(element);
    }),
  };
});

const TEST_FIXTURE_PATH = path.resolve(__dirname, '../../../../test-fixtures');

describe('poml-helper', () => {
  // Temporarily unset window and document to force Node.js implementation of preprocessImage
  let originalWindow: any;
  let originalDocument: any;

  beforeAll(() => {
    originalWindow = globalThis.window;
    originalDocument = globalThis.document;
    // @ts-ignore
    delete globalThis.window;
    // @ts-ignore
    delete globalThis.document;
  });

  afterAll(() => {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    }
    if (originalDocument !== undefined) {
      globalThis.document = originalDocument;
    }
  });

  it('should render a simple text card', async () => {
    const card: CardModel = {
      content: {
        type: 'text',
        text: 'Hello, world!',
      },
    };
    const result = await renderCardsByPoml([card]);
    expect(result).toBe('Hello, world!');
  });

  it('should render a list card with unordered items', async () => {
    const card: CardModel = {
      content: {
        type: 'list',
        items: [
          'Item 1',
          '  Item 2', // extra space should be stripped
          'Item 3',
        ],
        ordered: false,
      },
    };
    const result = await renderCardsByPoml([card]);
    expect(result).toBe('* Item 1\n* Item 2\n* Item 3');
  });

  it('should render a list card with ordered items', async () => {
    const card: CardModel = {
      content: {
        type: 'list',
        items: ['First', 'Second', 'Third'],
        ordered: true,
      },
    };
    const result = await renderCardsByPoml([card]);
    expect(result).toBe('1. First\n2. Second\n3. Third');
  });

  it('should render an image card', async () => {
    const base64 = readFileSync(TEST_FIXTURE_PATH + '/image/gpt-5-random-image.png').toString('base64');
    const card: CardModel = {
      content: {
        type: 'image',
        base64: base64,
        alt: 'gpt-5-random-image.png',
      },
    };
    const result = await renderCardsByPoml([card]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect((result as any)[0].type).toBe('image/png');
    expect((result as any)[0].base64).toBeTruthy();
    expect((result as any)[0].alt).toBe('gpt-5-random-image.png');

    // convert to string
    const resultString = richContentToString(result as RichContent);
    console.log('<image/png>');
  });

  it('should render a table card', async () => {
    const card: CardModel = {
      content: {
        type: 'table',
        records: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'age', header: 'Age' },
        ],
      },
    };
    const result = await renderCardsByPoml([card]);
    expect(result).toBe(`| Name  | Age |
| ----- | --- |
| Alice | 30  |
| Bob   | 25  |`);
  });

  it('should render nested cards', async () => {
    const card: CardModel = {
      content: {
        type: 'nested',
        cards: [
          {
            type: 'text',
            text: 'Nested text 1',
          },
          {
            type: 'text',
            text: 'Nested text 2',
          },
        ],
      },
    };
    const result = await renderCardsByPoml([card]);
    expect(result).toBe('Nested text 1\n\nNested text 2');
  });

  it('should render multiple cards', async () => {
    const cards: CardModel[] = [
      {
        content: {
          type: 'text',
          text: 'First card',
        },
      },
      {
        content: {
          type: 'text',
          text: 'Second card',
        },
      },
    ];
    const result = await renderCardsByPoml(cards);
    expect(result).toContain('First card');
    expect(result).toContain('Second card');
  });

  it('should render card with caption', async () => {
    const card: CardModel = {
      content: {
        type: 'text',
        text: 'Content with caption',
        caption: 'This is a caption',
      },
    };
    const result = await renderCardsByPoml([card]);
    expect(result).toBe('# This is a caption\n\nContent with caption');
  });

  it('should render card with container type', async () => {
    const card: CardModel = {
      content: {
        type: 'text',
        text: 'Task content',
        container: 'Task',
      },
    };
    const result = await renderCardsByPoml([card]);
    expect(result).toBe('# Task\n\nTask content');
  });

  it('should handle empty card array', async () => {
    const result = await renderCardsByPoml([]);
    expect(result).toEqual([]);
  });

  it('should handle text with newlines', async () => {
    const card: CardModel = {
      content: {
        type: 'text',
        text: 'Line 1\n  Line 2\n\nLine 3   ',
      },
    };
    const result = await renderCardsByPoml([card]);
    expect(result).toBe((card.content as any).text);
  });

  it('should convert string content', () => {
    const content = 'Simple string';
    const result = richContentToString(content);
    expect(result).toBe('Simple string');
  });

  it('should convert array of mixed content', () => {
    const content: RichContent = ['Text part', { type: 'component', base64: 'test' }, 'Another text part'];
    const result = richContentToString(content);
    expect(result).toBe('Text part\n\n<component>\n\nAnother text part');
  });

  it('should handle empty array', () => {
    const content: RichContent = [];
    const result = richContentToString(content);
    expect(result).toBe('');
  });

  it('should handle array with unknown items', () => {
    const content: any = ['Known text', null, undefined, {}];
    const result = richContentToString(content);
    expect(result).toBe('Known text\n\n<unknown>\n\n<unknown>\n\n<unknown>');
  });
});
