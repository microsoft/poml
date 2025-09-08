import React from 'react';
import { Paragraph } from 'poml/essentials';
import { renderToReadableStream } from 'react-dom/server';
import { RichContent, write } from 'poml';
import {
  CardModel,
  isTextContent,
  isBinaryContent,
  isFileContent,
  isNestedContent,
  getDefaultComponentType,
} from './cardModel';
import { notifyWarning, notifyError, notifyDebug } from './notification';

// Import POML components
import {
  Text,
  Code,
  Header,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListItem,
  SubContent,
  Inline,
  Newline,
  DataObject,
  Image,
  Audio,
} from 'poml/essentials';

import {
  Task,
  Question,
  Hint,
  Role,
  OutputFormat,
  StepwiseInstructions,
  Example,
  ExampleInput,
  ExampleOutput,
  ExampleSet,
  Introducer,
  Document,
  Webpage,
  Folder,
  Tree,
  Table,
  AiMessage,
  Conversation,
  HumanMessage,
  SystemMessage,
  MessageContent,
  CaptionedParagraph,
} from 'poml/components';
import { ErrorCollection } from 'poml/base';
import { binaryToBase64 } from './utils/base64';

// Map component type strings to actual React components
const ComponentMap: Record<string, React.FC<any>> = {
  // Basic Components
  Text,
  Paragraph,
  CaptionedParagraph,
  Code,
  Header,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListItem,
  SubContent,
  Inline,
  Newline,
  DataObject,
  Audio,

  // Intentions
  Task,
  Question,
  Hint,
  Role,
  OutputFormat,
  StepwiseInstructions,
  Example,
  ExampleInput,
  ExampleOutput,
  ExampleSet,
  Introducer,

  // Data Displays
  Document,
  Folder,
  Image,
  Table,
  Tree,
  Webpage,

  // Chat Components
  AiMessage,
  Conversation,
  HumanMessage,
  SystemMessage,
  MessageContent,
};

/**
 * Convert a CardModel to a POML React element
 */
export function cardToPOMLElement(card: CardModel): React.ReactElement {
  const Component = ComponentMap[card.componentType] || Text;

  const props = buildComponentProps(card);
  const children = buildComponentChildren(card);
  notifyDebug(`Building POML element: ${card.componentType}`, { props, children });

  if (children === null || children === undefined) {
    return React.createElement(Component, props);
  } else {
    return React.createElement(Component, props, children);
  }
}

/**
 * Build props for the POML component based on card data
 */
function buildComponentProps(card: CardModel): Record<string, any> {
  const props: Record<string, any> = {
    key: card.id,
  };

  // Add title for CaptionedParagraph
  if (card.componentType === 'CaptionedParagraph' && card.title) {
    props.caption = card.title;
  }

  // Add props based on content type
  if (isBinaryContent(card.content)) {
    if (card.content.mimeType) {
      props.type = card.content.mimeType;
    }
    if (card.content.encoding === 'base64') {
      props.base64 = card.content.value;
    } else if (card.content.encoding === 'binary') {
      // For binary encoding, value should be ArrayBuffer
      if (card.content.value instanceof ArrayBuffer) {
        props.base64 = binaryToBase64(card.content.value);
      } else if (typeof card.content.value === 'string') {
        // If it's already a base64 string, use it directly
        props.base64 = card.content.value;
      }
    }
  } else if (isFileContent(card.content)) {
    if (card.content.path) {
      props.src = card.content.path;
    }
    if (card.content.url) {
      props.url = card.content.url;
    }
    if (card.content.name) {
      props.name = card.content.name;
    }
  }

  // Add metadata as custom props (will be ignored by POML renderer)
  if (card.metadata && typeof card.metadata === 'object') {
    Object.entries(card.metadata).forEach(([key, value]) => {
      if (typeof value !== 'object') {
        props[`data-${key}`] = value;
      }
    });
  }

  return props;
}

/**
 * Build children for the POML component based on card content
 */
function buildComponentChildren(card: CardModel): React.ReactNode {
  if (isTextContent(card.content)) {
    return card.content.value;
  } else if (isNestedContent(card.content)) {
    return card.content.children.map((child) => cardToPOMLElement(child));
  } else if (isBinaryContent(card.content)) {
    // Binary uncontents are passed as base64 strings
    return null;
  }
  return null;
}

/**
 * Convert multiple cards to a POML document
 */
export function cardsToPOMLDocument(cards: CardModel[]): React.ReactElement {
  return <Text syntax='markdown'>{cards.map((card) => cardToPOMLElement(card))}</Text>;
}

/**
 * Render a React element to string using renderToReadableStream
 */
async function renderElementToString(element: React.ReactElement): Promise<string> {
  ErrorCollection.clear(); // Clear any previous errors
  let renderError: any = null;
  const stream = await renderToReadableStream(element, {
    onError: (error) => {
      notifyError('Error during POML rendering', error);
      renderError = error;
    },
  });
  await stream.allReady;
  const reader = stream.getReader();

  if (renderError) {
    notifyWarning(`POML rendering encountered an error`, renderError);
  }

  let result = '';
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    result += decoder.decode(value, { stream: true });
  }
  if (!ErrorCollection.empty()) {
    throw ErrorCollection.first();
  }

  // Final decode with stream: false to flush any remaining bytes
  result += decoder.decode();
  return result;
}

export const richContentToString = (content: RichContent): string => {
  // This is temporary and should be replaced with a proper display function
  if (typeof content === 'string') {
    return content;
  }

  return content
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      } else if (item && item.type) {
        return `<${item.type}>`;
      }
      return '<unknown>';
    })
    .join('\n\n');
};

/**
 * Convert a single card to POML string
 */
export async function cardToPOMLString(card: CardModel): Promise<RichContent> {
  const element = cardToPOMLElement(card);
  const ir = await renderElementToString(element);
  const written = await write(ir, { speaker: false });
  return written;
}

/**
 * Convert multiple cards to POML string
 */
export async function cardsToPOMLString(cards: CardModel[]): Promise<RichContent> {
  const document = cardsToPOMLDocument(cards);
  const ir = await renderElementToString(document);
  notifyDebug('Generated intermediate representation', { length: ir.length });
  const written = await write(ir, { speaker: false });
  notifyDebug('Generated POML output', { type: typeof written });
  return written;
}

/**
 * Create a POML element with specific component type
 */
export function createPOMLElement(
  componentType: string,
  props: Record<string, any>,
  children?: React.ReactNode,
): React.ReactElement {
  const Component = ComponentMap[componentType] || Text;
  return React.createElement(Component, props, children);
}

export default async function pomlHelper(cards?: CardModel[]): Promise<RichContent | undefined> {
  try {
    // If cards are provided, render them as POML
    if (cards && cards.length > 0) {
      notifyDebug('Rendering cards to POML', { count: cards.length });
      const results = await cardsToPOMLString(cards);
      if (!results) {
        notifyWarning('No POML content generated from cards. You may need some debugging.');
      }
      return results;
    } else {
      notifyError('No cards provided to render');
      return undefined;
    }
  } catch (error: any) {
    notifyError('Error rendering POML', error);
    return undefined;
  }
}
