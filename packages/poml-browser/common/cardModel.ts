/**
 * Card Model Types for POML Browser Extension
 * Provides a flexible and structured card system for content management
 */

import { binaryToBase64, binaryToDataURL } from './utils/base64';

// POML Component Types based on docs/components.md
export type POMLComponentType =
  // Basic Components
  | 'Audio'
  | 'Bold'
  | 'CaptionedParagraph'
  | 'Code'
  | 'Header'
  | 'Inline'
  | 'Italic'
  | 'List'
  | 'ListItem'
  | 'Newline'
  | 'Paragraph'
  | 'Strikethrough'
  | 'SubContent'
  | 'Text'
  | 'Underline'
  // Intentions
  | 'Example'
  | 'ExampleInput'
  | 'ExampleOutput'
  | 'ExampleSet'
  | 'Hint'
  | 'Introducer'
  | 'OutputFormat'
  | 'Question'
  | 'Role'
  | 'StepwiseInstructions'
  | 'Task'
  // Data Displays
  | 'Document'
  | 'Folder'
  | 'Image'
  | 'Object'
  | 'Table'
  | 'Tree'
  | 'Webpage'
  // Utilities
  | 'AiMessage'
  | 'Conversation'
  | 'HumanMessage'
  | 'MessageContent'
  | 'SystemMessage';

// Content Types
export type CardContentType<T> = TextContent | BinaryContent | FileContent | NestedContent<T>;

export interface TextContent {
  type: 'text';
  value: string;
}

export interface BinaryContent {
  type: 'binary';
  value: ArrayBuffer | string; // string for base64
  mimeType?: string;
  encoding?: 'base64' | 'binary';
}

export interface FileContent {
  type: 'file';
  path?: string;
  url?: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface NestedContent<T> {
  type: 'nested';
  children: T[];
}

export interface CardModelSlim {
  content: CardContentType<CardModelSlim>;
  componentType: POMLComponentType;
}

// Main Card Model
export interface CardModel {
  id: string;
  title?: string;
  content: CardContentType<CardModel>;
  componentType: POMLComponentType;
  metadata?: CardMetadata;
  timestamp?: Date;
  parentId?: string | null;
}

// Metadata that can be attached to cards but ignored by POML
export interface CardMetadata {
  source?: 'manual' | 'clipboard' | 'file' | 'web' | 'generated';
  url?: string;
  excerpt?: string;
  tags?: string[];
  fileName?: string;
  debug?: string;
}

// Type guards for content types
export const isTextContent = (content: CardContentType<any>): content is TextContent => content.type === 'text';

export const isBinaryContent = (content: CardContentType<any>): content is BinaryContent => content.type === 'binary';

export const isFileContent = (content: CardContentType<any>): content is FileContent => content.type === 'file';

export const isNestedContent = <T>(content: CardContentType<T>): content is NestedContent<T> =>
  content.type === 'nested';

// Component type validation based on content
export function getValidComponentTypes(content: CardContentType<any>): POMLComponentType[] {
  switch (content.type) {
    case 'text':
      return [
        'Text',
        'Paragraph',
        'CaptionedParagraph',
        'Code',
        'Header',
        'Bold',
        'Italic',
        'Underline',
        'Strikethrough',
        'Task',
        'Question',
        'Hint',
        'Role',
        'OutputFormat',
        'StepwiseInstructions',
        'ExampleInput',
        'ExampleOutput',
      ];
    case 'binary':
      return ['Image', 'Audio', 'Document'];
    case 'file':
      return ['Document', 'Image', 'Audio', 'Table', 'Webpage'];
    case 'nested':
      // As you noted, all text-applicable components are also applicable to nested content
      return [
        'Text',
        'Paragraph',
        'CaptionedParagraph',
        'Code',
        'Header',
        'Bold',
        'Italic',
        'Underline',
        'Strikethrough',
        'Task',
        'Question',
        'Hint',
        'Role',
        'OutputFormat',
        'StepwiseInstructions',
        'ExampleInput',
        'ExampleOutput',
        'List',
        'ExampleSet',
        'Conversation',
        'SubContent',
        'Folder',
        'Tree',
        'Object',
      ];
    default:
      return [];
  }
}

// Default component type selection
export function getDefaultComponentType(card: CardModel): POMLComponentType {
  // If has title, default to CaptionedParagraph for text or nested content
  if (card.title && (isTextContent(card.content) || isNestedContent(card.content))) {
    return 'CaptionedParagraph';
  }

  const validTypes = getValidComponentTypes(card.content);
  if (validTypes.length > 0) {
    // Return the most appropriate default for each content type
    switch (card.content.type) {
      case 'text':
        return 'Paragraph';
      case 'binary':
        return 'Image';
      case 'file':
        return 'Document';
      case 'nested':
        return 'List';
      default:
        return validTypes[0];
    }
  }

  return 'Text';
}

// Serialization helpers
export interface SerializedCardModel {
  id: string;
  title?: string;
  content: SerializedCardContent;
  componentType?: POMLComponentType;
  metadata?: CardMetadata;
  timestamp?: string;
  order?: number;
  parentId?: string | null;
}

export type SerializedCardContent = TextContent | SerializedBinaryContent | FileContent | SerializedNestedContent;

export interface SerializedBinaryContent {
  type: 'binary';
  value: string; // Always base64 for serialization
  mimeType?: string;
  encoding: 'base64';
}

export interface SerializedNestedContent {
  type: 'nested';
  children: SerializedCardModel[];
}

// Serialize card for storage
export function serializeCard(card: CardModel): SerializedCardModel {
  const serialized: SerializedCardModel = {
    ...card,
    timestamp: card.timestamp?.toISOString(),
    content: serializeContent(card.content),
  };
  return serialized;
}

function serializeContent(content: CardContentType<CardModel>): SerializedCardContent {
  switch (content.type) {
    case 'text':
    case 'file':
      return content;
    case 'binary':
      if (content.value instanceof ArrayBuffer) {
        const base64 = binaryToBase64(content.value);
        return {
          type: 'binary',
          value: base64,
          mimeType: content.mimeType,
          encoding: 'base64',
        };
      }
      return {
        ...content,
        value: content.value,
        encoding: 'base64',
      };
    case 'nested':
      return {
        type: 'nested',
        children: content.children.map(serializeCard),
      };
  }
}

// Deserialize card from storage
export function deserializeCard(serialized: SerializedCardModel): CardModel {
  const card = {
    ...serialized,
    timestamp: serialized.timestamp ? new Date(serialized.timestamp) : undefined,
    content: deserializeContent(serialized.content),
  };

  // Ensure componentType is set for legacy cards
  if (!card.componentType) {
    card.componentType = getDefaultComponentType(card as CardModel);
  }

  return card as CardModel;
}

function deserializeContent(content: SerializedCardContent): CardContentType<CardModel> {
  switch (content.type) {
    case 'text':
    case 'file':
      return content;
    case 'binary':
      if (content.encoding === 'base64' && typeof content.value === 'string') {
        // Keep as base64 string for efficiency, convert to ArrayBuffer only when needed
        return {
          type: 'binary',
          value: content.value,
          mimeType: content.mimeType,
          encoding: 'base64',
        };
      }
      return content as BinaryContent;
    case 'nested':
      return {
        type: 'nested',
        children: content.children.map(deserializeCard),
      };
  }
}

// Card collection utilities
export interface CardCollection {
  cards: CardModel[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createCardCollection(cards: CardModel[] = []): CardCollection {
  return {
    cards,
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ID generation utility
export function generateId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Helper to create a new card with specified or default component type
export function createCard(options: {
  id?: string;
  title?: string;
  content: CardContentType<CardModel>;
  componentType?: POMLComponentType;
  parentId?: string | null;
  timestamp?: Date;
  metadata?: CardMetadata;
}): CardModel {
  const card: CardModel = {
    id: options.id || generateId(),
    title: options.title,
    content: options.content,
    componentType:
      options.componentType ||
      getDefaultComponentType({
        content: options.content,
        componentType: 'Text',
      } as CardModel),
    parentId: options.parentId,
    timestamp: options.timestamp || new Date(),
    metadata: options.metadata,
  };

  return card;
}

// Helper to convert CardModelSlim to CardModel
export function createCardFromSlim(
  slim: CardModelSlim,
  options?: {
    id?: string;
    title?: string;
    parentId?: string | null;
    timestamp?: Date;
    order?: number;
    metadata?: CardMetadata;
  },
): CardModel {
  const timestamp = options?.timestamp || new Date();
  const cardId = options?.id || generateId();

  // Convert nested content recursively
  const convertContent = (content: CardContentType<CardModelSlim>, parentId: string): CardContentType<CardModel> => {
    if (isNestedContent(content)) {
      return {
        type: 'nested',
        children: content.children.map((child) =>
          createCardFromSlim(child, {
            parentId,
            timestamp,
          }),
        ),
      };
    }
    return content as CardContentType<CardModel>;
  };

  return {
    id: cardId,
    title: options?.title,
    content: convertContent(slim.content, cardId),
    componentType: slim.componentType,
    parentId: options?.parentId || null,
    timestamp,
    metadata: options?.metadata,
  };
}

// Utility to check if binary content is an image
export function isImageBinaryContent(content: BinaryContent): boolean {
  if (!content.mimeType) {
    return false;
  }
  return content.mimeType.startsWith('image/');
}

// Utility to get data URL for image binary content
export function getBinaryContentDataUrl(content: BinaryContent): string | null {
  if (!isImageBinaryContent(content)) {
    return null;
  }

  if (content.value instanceof ArrayBuffer) {
    return binaryToDataURL(content.value, content.mimeType || 'application/octet-stream');
  } else {
    return `data:${content.mimeType || 'application/octet-stream'};base64,${content.value}`;
  }
}
