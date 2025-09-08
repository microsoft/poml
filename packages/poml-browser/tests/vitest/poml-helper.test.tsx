import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { cardToPomlReact, cardsToPomlDocument, richContentToString, renderCardsByPoml } from '@common/poml-helper';
import {
  CardModel,
  CardContent,
  TextCardContent,
  ListCardContent,
  ImageCardContent,
  TableCardContent,
  NestedCardContent,
  PomlContainerType,
  SettingsBundle,
} from '@common/types';
import { RichContent } from 'poml';
import { reactRender } from 'poml/util/reactRender';

// Mock getSettings globally to return default settings
vi.mock('@common/settings', () => ({
  getSettings: vi.fn().mockResolvedValue({
    theme: 'auto',
    uiNotificationLevel: 'info',
    consoleNotificationLevel: 'debug',
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

describe('poml-helper', () => {
  describe('renderCardsByPoml', () => {
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
      const card: CardModel = {
        content: {
          type: 'image',
          base64:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          alt: 'Test image',
        },
      };
      const result = await renderCardsByPoml([card]);
      console.log(result);
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
      expect(typeof result).toBe('string');
      expect(result).toBeTruthy();
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
      expect(result).toContain('Nested text 1');
      expect(result).toContain('Nested text 2');
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
      expect(result).toContain('Content with caption');
      expect(result).toContain('This is a caption');
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
      expect(result).toContain('Task content');
    });

    it('should handle empty card array', async () => {
      const result = await renderCardsByPoml([]);
      expect(typeof result).toBe('string');
    });

    it('should handle text with newlines', async () => {
      const card: CardModel = {
        content: {
          type: 'text',
          text: 'Line 1\nLine 2\nLine 3',
        },
      };
      const result = await renderCardsByPoml([card]);
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });
  });

  describe('cardsToPomlDocument', () => {
    it('should convert single card to POML document', () => {
      const cards: CardModel[] = [
        {
          content: {
            type: 'text',
            text: 'Test content',
          },
        },
      ];
      const document = cardsToPomlDocument(cards);
      expect(React.isValidElement(document)).toBe(true);
    });

    it('should convert multiple cards to POML document', () => {
      const cards: CardModel[] = [
        {
          content: {
            type: 'text',
            text: 'First',
          },
        },
        {
          content: {
            type: 'text',
            text: 'Second',
          },
        },
      ];
      const document = cardsToPomlDocument(cards);
      expect(React.isValidElement(document)).toBe(true);
    });
  });

  describe('cardToPomlReact', () => {
    it('should convert text content to React element', () => {
      const content: TextCardContent = {
        type: 'text',
        text: 'Test text',
      };
      const element = cardToPomlReact(content);
      expect(React.isValidElement(element)).toBe(true);
    });

    it('should convert list content to React element', () => {
      const content: ListCardContent = {
        type: 'list',
        items: ['Item 1', 'Item 2'],
        ordered: false,
      };
      const element = cardToPomlReact(content);
      expect(React.isValidElement(element)).toBe(true);
    });

    it('should convert image content to React element', () => {
      const content: ImageCardContent = {
        type: 'image',
        base64: 'data:image/png;base64,test',
        alt: 'Test',
      };
      const element = cardToPomlReact(content);
      expect(React.isValidElement(element)).toBe(true);
    });

    it('should convert table content to React element', () => {
      const content: TableCardContent = {
        type: 'table',
        records: [{ key: 'value' }],
        columns: [{ field: 'key', header: 'Key' }],
      };
      const element = cardToPomlReact(content);
      expect(React.isValidElement(element)).toBe(true);
    });

    it('should convert nested content to React element', () => {
      const content: NestedCardContent = {
        type: 'nested',
        cards: [
          {
            type: 'text',
            text: 'Nested text',
          },
        ],
      };
      const element = cardToPomlReact(content);
      expect(React.isValidElement(element)).toBe(true);
    });
  });

  describe('richContentToString', () => {
    it('should convert string content', () => {
      const content = 'Simple string';
      const result = richContentToString(content);
      expect(result).toBe('Simple string');
    });

    it('should convert array of mixed content', () => {
      const content: RichContent = ['Text part', { type: 'component', value: 'test' }, 'Another text part'];
      const result = richContentToString(content);
      expect(result).toContain('Text part');
      expect(result).toContain('<component>');
      expect(result).toContain('Another text part');
    });

    it('should handle empty array', () => {
      const content: RichContent = [];
      const result = richContentToString(content);
      expect(result).toBe('');
    });

    it('should handle array with unknown items', () => {
      const content: RichContent = ['Known text', null, undefined, {}];
      const result = richContentToString(content);
      expect(result).toContain('Known text');
      expect(result).toContain('<unknown>');
    });
  });
});
