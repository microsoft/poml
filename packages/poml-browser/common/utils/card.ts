/** Card utilities */

import {
  CardContent,
  HeaderCardContent,
  NestedCardContent,
  TextCardContent,
  CardModel,
  CreateCardModelOptions,
} from '@common/types';

/**
 * Creates a CardModel from CardContent with optional metadata.
 *
 * This function wraps CardContent in a CardModel structure that includes
 * metadata like ID, timestamp, source information, and other options.
 *
 * @param content - The card content to wrap. Can be a single CardContent or an array of CardContent.
 *   If an array is provided, it will be wrapped in a NestedCardContent structure.
 * @param options - Optional metadata for the card including ID, source, URL, etc.
 * @returns A complete CardModel with the provided content and metadata
 *
 * @example
 * ```typescript
 * // Create a simple text card
 * const textCard = createCard({
 *   type: 'text',
 *   text: 'Hello world'
 * });
 *
 * // Create a card with metadata
 * const cardWithMeta = createCard({
 *   type: 'text',
 *   text: 'Hello world'
 * }, {
 *   id: 'custom-id',
 *   source: 'manual',
 *   url: 'https://example.com',
 *   tags: ['important']
 * });
 *
 * // Create a nested card from multiple content items
 * const nestedCard = createCard([
 *   { type: 'text', text: 'First item' },
 *   { type: 'text', text: 'Second item' }
 * ]);
 * ```
 */
export function createCard(content: CardContent | CardContent[], options?: CreateCardModelOptions): CardModel {
  // Generate a unique ID if not provided
  const id = options?.id ?? `card-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  // Set default timestamp
  const timestamp = options?.timestamp ?? new Date();

  // Handle array content by wrapping in NestedCardContent
  const cardContent: CardContent = Array.isArray(content)
    ? ({
        type: 'nested',
        cards: content,
      } as NestedCardContent)
    : content;

  // Create and return the CardModel
  return {
    id,
    content: cardContent,
    timestamp,
    ...options,
  };
}

/**
 * Transforms an array containing HeaderCardContent and regular CardContent into a hierarchical structure
 * where headers become captions for subsequent content.
 *
 * ## Processing Rules:
 *
 * 1. **Header Collection**: When a header card is encountered, it collects all subsequent cards until:
 *    - Another header of the same or higher level (lower number) is found
 *    - The end of the array is reached
 *
 * 2. **Content Structuring**:
 *    - **No children**: Header becomes a text card with caption
 *    - **Single child without caption**: Header text becomes the caption of that child card
 *    - **Single child with existing caption**: Creates a NestedCardContent to preserve both captions
 *    - **Multiple children**: Creates a NestedCardContent with header as caption
 *
 * 3. **Nested Headers**: Headers with higher level numbers (e.g., h3 after h2) are collected
 *    as children and processed recursively
 *
 * ## Example Transformations:
 *
 * ```typescript
 * // Input: [h1, text, image, h2, text]
 * // Output: [{type: 'nested', caption: 'h1', cards: [text, image]}, {type: 'text', caption: 'h2', text: '...'}]
 *
 * // Input: [h1, text]
 * // Output: [{type: 'text', caption: 'h1', text: '...'}]
 * ```
 *
 * @param cards Array of CardContent or HeaderCardContent to process
 * @returns Array of CardContent with headers eliminated and converted to captions
 */
export function eliminateHeaderCards(cards: (CardContent | HeaderCardContent)[]): CardContent[] {
  const result: CardContent[] = [];
  let i = 0;

  while (i < cards.length) {
    const card = cards[i];

    if (card.type === 'header') {
      // Found a header card
      const headerText = card.text;
      const headerLevel = card.level;

      // Collect all subsequent cards until we hit same/higher level header
      const children: (CardContent | HeaderCardContent)[] = [];
      let j = i + 1;

      while (j < cards.length) {
        const nextCard = cards[j];

        // Stop if we hit a header of same or higher priority (lower or equal level number)
        if (nextCard.type === 'header' && (nextCard as HeaderCardContent).level <= headerLevel) {
          break;
        }

        children.push(nextCard);
        j++;
      }

      // Process collected children recursively to handle nested headers
      const processedChildren = children.length > 0 ? eliminateHeaderCards(children) : [];

      // Create the appropriate card structure based on children count
      if (processedChildren.length === 0) {
        // No children - create text card with header as caption
        const textCard: TextCardContent = {
          type: 'text',
          text: '',
          caption: headerText,
        };
        result.push(textCard);
      } else if (processedChildren.length === 1 && !processedChildren[0].caption) {
        // Single child without caption - add header as caption to the child
        result.push({
          ...processedChildren[0],
          caption: headerText,
        });
      } else {
        // Multiple children - create nested card
        const nestedCard: NestedCardContent = {
          type: 'nested',
          cards: processedChildren,
          caption: headerText,
        };
        result.push(nestedCard);
      }

      // Move index to next unprocessed card
      i = j;
    } else {
      // Regular card - add directly to result
      result.push(card);
      i++;
    }
  }

  return result;
}
