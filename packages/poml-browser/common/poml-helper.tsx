import React from 'react';
import { Paragraph } from 'poml/essentials';
import { renderToReadableStream } from 'react-dom/server';
import { RichContent, write } from 'poml';
import {
  CardModel,
  TextCardContent,
  ImageCardContent,
  TableCardContent,
  ListCardContent,
  NestedCardContent,
} from './types';
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
  Object as POMLObject,
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
  MessageContent,
};

/**
 * Convert a CardModel to a POML React element
 */
export function cardToPOMLElement(card: CardModel): React.ReactElement {
  const { component, props, children } = getComponentFromCard(card);
  const Component = ComponentMap[component] || Text;

  notifyDebug(`Building POML element: ${component}`, { props, children });

  if (children === null || children === undefined) {
    return React.createElement(Component, props);
  } else {
    return React.createElement(Component, props, children);
  }
}

/**
 * Get component type, props, and children from a CardModel
 */
function getComponentFromCard(card: CardModel): {
  component: string;
  props: Record<string, any>;
  children: React.ReactNode;
} {
  const content = card.content;
  const props: Record<string, any> = {};

  // Add URL and timestamp metadata
  if (card.url) {
    props['data-url'] = card.url;
  }
  if (card.timestamp) {
    props['data-timestamp'] = card.timestamp.toISOString();
  }
  if (card.tags) {
    props['data-tags'] = card.tags.join(',');
  }

  switch (content.type) {
    case 'text': {
      const textContent = content as TextCardContent;
      const component = getTextComponent(textContent);

      if (textContent.caption) {
        props.caption = textContent.caption;
      }

      return {
        component,
        props,
        children: textContent.text,
      };
    }

    case 'image': {
      const imageContent = content as ImageCardContent;
      props.base64 = imageContent.base64;

      if (imageContent.alt) {
        props.alt = imageContent.alt;
      }
      if (imageContent.caption) {
        props.caption = imageContent.caption;
      }

      return {
        component: 'Image',
        props,
        children: null,
      };
    }

    case 'table': {
      const tableContent = content as TableCardContent;
      props.records = tableContent.records;

      if (tableContent.columns) {
        props.columns = tableContent.columns;
      }
      if (tableContent.caption) {
        props.caption = tableContent.caption;
      }

      return {
        component: 'Table',
        props,
        children: null,
      };
    }

    case 'list': {
      const listContent = content as ListCardContent;
      props.ordered = listContent.ordered || false;

      if (listContent.caption) {
        props.caption = listContent.caption;
      }

      const children = listContent.items.map((item, index) => React.createElement(ListItem, { key: index }, item));

      return {
        component: 'List',
        props,
        children,
      };
    }

    case 'nested': {
      const nestedContent = content as NestedCardContent;

      if (nestedContent.caption) {
        props.caption = nestedContent.caption;
      }

      const children = nestedContent.cards.map((childContent) =>
        cardToPOMLElement({ content: childContent, source: card.source }),
      );

      return {
        component: getNestedComponent(nestedContent),
        props,
        children,
      };
    }

    default:
      return {
        component: 'Text',
        props,
        children: 'Unsupported content type',
      };
  }
}

/**
 * Determine the appropriate text component based on container type
 */
function getTextComponent(content: TextCardContent): string {
  if (!content.container) {
    return content.caption ? 'CaptionedParagraph' : 'Paragraph';
  }

  // Map container types to POML components
  switch (content.container) {
    case 'Code':
      return 'Code';
    case 'CaptionedParagraph':
      return 'CaptionedParagraph';
    case 'Paragraph':
      return 'Paragraph';
    case 'Task':
      return 'Task';
    case 'Question':
      return 'Question';
    case 'Hint':
      return 'Hint';
    case 'Role':
      return 'Role';
    case 'OutputFormat':
      return 'OutputFormat';
    case 'StepwiseInstructions':
      return 'StepwiseInstructions';
    case 'Example':
      return 'Example';
    case 'ExampleInput':
      return 'ExampleInput';
    case 'ExampleOutput':
      return 'ExampleOutput';
    case 'Introducer':
      return 'Introducer';
    default:
      return content.caption ? 'CaptionedParagraph' : 'Paragraph';
  }
}

/**
 * Determine the appropriate nested component based on container type
 */
function getNestedComponent(content: NestedCardContent): string {
  if (!content.container) {
    return content.caption ? 'CaptionedParagraph' : 'Document';
  }

  switch (content.container) {
    case 'ExampleSet':
      return 'ExampleSet';
    case 'Task':
      return 'Task';
    case 'Question':
      return 'Question';
    default:
      return content.caption ? 'CaptionedParagraph' : 'Document';
  }
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
  const written = write(ir, { speaker: false });
  return written;
}

/**
 * Convert multiple cards to POML string
 */
export async function cardsToPOMLString(cards: CardModel[]): Promise<RichContent> {
  const document = cardsToPOMLDocument(cards);
  const ir = await renderElementToString(document);
  notifyDebug('Generated intermediate representation', { length: ir.length });
  const written = write(ir, { speaker: false });
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
