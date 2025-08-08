import React from 'react';
import { Paragraph } from 'poml/essentials';
import { Markup } from 'poml/presentation';
import { renderToReadableStream } from 'react-dom/server';
import { renderToString } from 'react-dom/server';
import {
  CardModel,
  isTextContent,
  isBinaryContent,
  isFileContent,
  isNestedContent,
  getDefaultComponentType
} from './cardModel';

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
  Object as POMLObject,
  Image,
  Audio
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
  CaptionedParagraph
} from 'poml/components';

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
  Object: POMLObject,
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
  MessageContent
};

/**
 * Convert a CardModel to a POML React element
 */
export function cardToPOMLElement(card: CardModel): React.ReactElement {
  const componentType = card.componentType || getDefaultComponentType(card);
  const Component = ComponentMap[componentType] || Text;

  const props = buildComponentProps(card);
  const children = buildComponentChildren(card);

  return React.createElement(Component, props, children);
}

/**
 * Build props for the POML component based on card data
 */
function buildComponentProps(card: CardModel): Record<string, any> {
  const props: Record<string, any> = {
    key: card.id
  };

  // Add title for CaptionedParagraph
  if (card.componentType === 'CaptionedParagraph' && card.title) {
    props.caption = card.title;
  }

  // Add props based on content type
  if (isBinaryContent(card.content)) {
    if (card.content.mimeType) {
      props.mimeType = card.content.mimeType;
    }
    if (card.content.encoding === 'base64') {
      props.src = `data:${card.content.mimeType || 'application/octet-stream'};base64,${card.content.value}`;
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
    return card.content.children.map(child => cardToPOMLElement(child));
  } else if (isBinaryContent(card.content) && card.content.encoding === 'base64') {
    // For binary content that's base64 encoded, it can be embedded as text content
    return null; // Binary data is handled via src prop
  }
  return null;
}

/**
 * Convert multiple cards to a POML document
 */
export function cardsToPOMLDocument(cards: CardModel[]): React.ReactElement {
  return <SubContent>{cards.map(card => cardToPOMLElement(card))}</SubContent>;
}

async function HiddenPomlIR() {
  // wait 1000ms
  await new Promise(resolve => setTimeout(resolve, 1000));

  return (
    <Markup.Paragraph>
      This is a hidden Poml IR component. It is used to ensure that the Poml IR is correctly parsed
      and rendered in the browser.
    </Markup.Paragraph>
  );
}

function SimpleTest() {
  return <div>Simple test component</div>;
}

/**
 * Render a React element to string using renderToReadableStream
 */
async function renderElementToString(element: React.ReactElement): Promise<string> {
  const stream = await renderToReadableStream(element, {
    onError: error => {
      console.error('Error during rendering:', error);
    }
  });
  await stream.allReady;
  const reader = stream.getReader();

  let result = '';
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    result += decoder.decode(value, { stream: true });
  }

  // Final decode with stream: false to flush any remaining bytes
  result += decoder.decode();
  return result;
}

/**
 * Convert a single card to POML string
 */
export async function cardToPOMLString(card: CardModel): Promise<string> {
  const element = cardToPOMLElement(card);
  return renderElementToString(element);
}

/**
 * Convert multiple cards to POML string
 */
export async function cardsToPOMLString(cards: CardModel[]): Promise<string> {
  const document = cardsToPOMLDocument(cards);
  return renderElementToString(document);
}

/**
 * Create a POML element with specific component type
 */
export function createPOMLElement(
  componentType: string,
  props: Record<string, any>,
  children?: React.ReactNode
): React.ReactElement {
  const Component = ComponentMap[componentType] || Text;
  return React.createElement(Component, props, children);
}

export default async function pomlHelper(cards?: CardModel[]): Promise<string> {
  try {
    // If cards are provided, render them as POML
    if (cards && cards.length > 0) {
      console.log('Rendering cards to POML:', cards);
      return await cardsToPOMLString(cards);
    } else {
      return "<div>No cards provided to render.</div>";
    }
  } catch (error) {
    console.error('Rendering error:', error);
    return `<div>Error: ${error}</div>`;
  }
}
