import { describe, it, expect } from 'vitest';
import { eliminateHeaderCards } from '@common/utils/card';
import {
  CardContent,
  HeaderCardContent,
  TextCardContent,
  ListCardContent,
  ImageCardContent,
  NestedCardContent,
} from '@common/types';

describe('eliminateHeaderCards', () => {
  // Helper functions to create test cards
  const createHeader = (text: string, level: number): HeaderCardContent => ({
    type: 'header',
    text,
    level,
  });

  const createText = (text: string, caption?: string): TextCardContent => ({
    type: 'text',
    text,
    ...(caption && { caption }),
  });

  const createList = (items: string[], ordered = false, caption?: string): ListCardContent => ({
    type: 'list',
    items,
    ordered,
    ...(caption && { caption }),
  });

  const createImage = (base64: string, alt?: string, caption?: string): ImageCardContent => ({
    type: 'image',
    base64,
    ...(alt && { alt }),
    ...(caption && { caption }),
  });

  it('should return empty array for empty input', () => {
    const result = eliminateHeaderCards([]);
    expect(result).toEqual([]);
  });

  it('should pass through regular cards unchanged', () => {
    const textCard = createText('Hello world');
    const listCard = createList(['Item 1', 'Item 2']);
    const cards = [textCard, listCard];

    const result = eliminateHeaderCards(cards);

    expect(result).toEqual([textCard, listCard]);
  });

  it('should convert lonely header to text card with caption', () => {
    const headerCard = createHeader('Main Title', 1);
    const cards = [headerCard];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'text',
      text: '',
      caption: 'Main Title',
    });
  });

  it('should merge header with single child card', () => {
    const headerCard = createHeader('Section Title', 2);
    const textCard = createText('This is the content');
    const cards = [headerCard, textCard];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'text',
      text: 'This is the content',
      caption: 'Section Title',
    });
  });

  it('should create nested card for header with multiple children', () => {
    const headerCard = createHeader('Chapter 1', 1);
    const textCard = createText('Introduction text');
    const listCard = createList(['Point 1', 'Point 2']);
    const cards = [headerCard, textCard, listCard];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'nested',
      caption: 'Chapter 1',
      cards: [textCard, listCard],
    } as NestedCardContent);
  });

  it('should handle multiple headers at same level', () => {
    const header1 = createHeader('Section 1', 2);
    const text1 = createText('Content 1');
    const header2 = createHeader('Section 2', 2);
    const text2 = createText('Content 2');
    const cards = [header1, text1, header2, text2];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: 'text',
      text: 'Content 1',
      caption: 'Section 1',
    });
    expect(result[1]).toEqual({
      type: 'text',
      text: 'Content 2',
      caption: 'Section 2',
    });
  });

  it('should handle nested headers (h1 > h2)', () => {
    const h1 = createHeader('Chapter', 1);
    const text1 = createText('Chapter intro');
    const h2 = createHeader('Section', 2);
    const text2 = createText('Section content');
    const cards = [h1, text1, h2, text2];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'nested',
      caption: 'Chapter',
      cards: [
        { type: 'text', text: 'Chapter intro' },
        { type: 'text', text: 'Section content', caption: 'Section' },
      ],
    } as NestedCardContent);
  });

  it('should handle complex nested hierarchy (h1 > h2 > h3)', () => {
    const h1 = createHeader('Book', 1);
    const h2 = createHeader('Chapter', 2);
    const h3 = createHeader('Section', 3);
    const text = createText('Deep content');
    const cards = [h1, h2, h3, text];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'nested',
      caption: 'Book',
      cards: [
        {
          type: 'nested',
          caption: 'Chapter',
          cards: [
            {
              type: 'text',
              text: 'Deep content',
              caption: 'Section',
            },
          ],
        },
      ],
    } as NestedCardContent);
  });

  it('should handle header level jumps (h1 > h3)', () => {
    const h1 = createHeader('Chapter', 1);
    const h3 = createHeader('Subsection', 3);
    const text = createText('Content');
    const cards = [h1, h3, text];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'nested',
      caption: 'Chapter',
      cards: [
        {
          type: 'text',
          text: 'Content',
          caption: 'Subsection',
        },
      ],
    } as NestedCardContent);
  });

  it('should handle mixed content types', () => {
    const h1 = createHeader('Overview', 1);
    const text = createText('Introduction');
    const list = createList(['Item 1', 'Item 2']);
    const image = createImage('data:image/png;base64,abc123', 'Test image');
    const cards = [h1, text, list, image];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'nested',
      caption: 'Overview',
      cards: [text, list, image],
    } as NestedCardContent);
  });

  it('should create nested structure when child already has caption', () => {
    const header = createHeader('New Caption', 1);
    const textWithCaption = createText('Content', 'Old Caption');
    const cards = [header, textWithCaption];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(1);
    // Should create nested structure to preserve both captions
    expect(result[0]).toEqual({
      type: 'nested',
      caption: 'New Caption',
      cards: [
        {
          type: 'text',
          text: 'Content',
          caption: 'Old Caption',
        },
      ],
    } as NestedCardContent);
  });

  it('should merge header with single child without caption', () => {
    const header = createHeader('Section Title', 1);
    const textWithoutCaption = createText('Content without caption');
    const cards = [header, textWithoutCaption];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(1);
    // Should merge since child has no caption
    expect(result[0]).toEqual({
      type: 'text',
      text: 'Content without caption',
      caption: 'Section Title',
    });
  });

  it('should handle interleaved headers and content', () => {
    const text0 = createList(['Intro item', 'Another item']);
    const h1 = createHeader('Part 1', 1);
    const text1 = createText('Part 1 content');
    const regularCard = createText('Standalone content');
    const h2 = createHeader('Part 2', 1);
    const text2 = createText('Part 2 content');
    const cards = [text0, h1, text1, regularCard, h2, text2];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      type: 'list',
      items: ['Intro item', 'Another item'],
      ordered: false,
    });
    expect(result[1]).toEqual({
      type: 'nested',
      caption: 'Part 1',
      cards: [
        { type: 'text', text: 'Part 1 content' },
        { type: 'text', text: 'Standalone content' },
      ],
    });
    expect(result[2]).toEqual({
      type: 'text',
      text: 'Part 2 content',
      caption: 'Part 2',
    });
  });

  it('should handle return to higher level after nested headers', () => {
    const h1 = createHeader('Chapter 1', 1);
    const h2 = createHeader('Section 1.1', 2);
    const text1 = createText('Section content');
    const h1_2 = createHeader('Chapter 2', 1);
    const text2 = createText('Chapter 2 content');
    const cards = [h1, h2, text1, h1_2, text2];

    const result = eliminateHeaderCards(cards);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: 'nested',
      caption: 'Chapter 1',
      cards: [
        {
          type: 'text',
          text: 'Section content',
          caption: 'Section 1.1',
        },
      ],
    });
    expect(result[1]).toEqual({
      type: 'text',
      text: 'Chapter 2 content',
      caption: 'Chapter 2',
    });
  });
});
