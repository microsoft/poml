import React from 'react';
import { renderToReadableStream } from 'react-dom/server';
import { RichContent, write } from 'poml';
import { ErrorCollection } from 'poml/base';
import { CardModel, CardContent } from './types';
import { notifyWarning, notifyError, notifyDebug } from './notification';

import { Text, Code, Paragraph, List, ListItem, Image } from 'poml/essentials';

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
  Table,
  CaptionedParagraph,
} from 'poml/components';
import { PomlContainerType } from './types';

// Map component type strings to actual React components
const ComponentMap: Record<PomlContainerType, React.FC<any>> = {
  // Basic Components
  Paragraph,
  Text,
  Code,

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
};

/**
 * Convert a CardModel to a POML React element
 * This is only related to the CardContent type, not the CardModel type
 */
export function cardToPomlReact(card: CardContent): React.ReactElement {
  const innerComponent = getInnerComponent(card);
  const outerComponent = getOuterComponent(card, innerComponent);
  return outerComponent;
}

/**
 * Get the component closest to the card content
 */
function getInnerComponent(card: CardContent): React.ReactElement {
  switch (card.type) {
    case 'text': {
      return <Text whiteSpace='pre'>{card.text}</Text>;
    }
    case 'list': {
      const randomKey = Math.random().toString(36).substring(2, 15);
      return (
        <List listStyle={card.ordered ? 'decimal' : 'star'}>
          {card.items.map((item, i) => {
            return <ListItem key={`${randomKey}-${i}`}>{item}</ListItem>;
          })}
        </List>
      );
    }
    case 'image': {
      return <Image base64={card.base64} alt={card.alt} />;
    }
    case 'table': {
      return <Table records={card.records} columns={card.columns} />;
    }
    case 'nested': {
      return <>{card.cards.map((c) => cardToPomlReact(c))}</>;
    }
    default: {
      throw new Error(`Unsupported card content type: ${(card as any).type}`);
    }
  }
}

/**
 * Get the component respecting the "container" property
 */
function getOuterComponent(card: CardContent, innerComponent: React.ReactElement): React.ReactElement {
  if (!card.container) {
    // Default to Paragraph or CaptionedParagraph if no container is set
    if (card.caption) {
      return <CaptionedParagraph caption={card.caption}>{innerComponent}</CaptionedParagraph>;
    } else {
      return <Paragraph>{innerComponent}</Paragraph>;
    }
  } else {
    // 1) Find the component type specified as container
    // TODO: figure out the default type for nested correlated types
    const component = ComponentMap[card.container];
    if (!component) {
      throw new Error(`Unsupported container type: ${card.container}`);
    }
    const element = React.createElement(component, {}, innerComponent);
    // 2) Add caption if specified
    if (card.caption) {
      return <CaptionedParagraph caption={card.caption}>{element}</CaptionedParagraph>;
    } else {
      return element;
    }
  }
}

/**
 * Convert multiple cards to a POML document
 */
export function cardsToPomlDocument(cards: CardModel[]): React.ReactElement {
  return <Text syntax='markdown'>{cards.map((card) => cardToPomlReact(card.content))}</Text>;
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
 * Convert multiple cards to POML string
 */
export async function renderCardsByPoml(cards: CardModel[]): Promise<RichContent | undefined> {
  let document: React.ReactElement;
  let ir: string;
  try {
    document = cardsToPomlDocument(cards);
  } catch (error: any) {
    notifyError('Error converting cards to POML document', error);
    return undefined;
  }
  ErrorCollection.clear();
  try {
    ir = await renderElementToString(document);
    notifyDebug('Generated intermediate representation.', { ir });
    if (!ErrorCollection.empty()) {
      for (const error of ErrorCollection.list()) {
        notifyWarning('Error converting POML document to IR', error);
      }
    }
  } catch (error: any) {
    notifyError('Error converting POML document to IR', error);
    return undefined;
  }
  ErrorCollection.clear();
  try {
    const written = write(ir, { speaker: false });
    notifyDebug('Generated POML output', { written });
    if (!ErrorCollection.empty()) {
      for (const error of ErrorCollection.list()) {
        notifyWarning('Error converting POML IR to output', error);
      }
    }
  } catch (error: any) {
    notifyError('Error converting POML IR to output', error);
    return undefined;
  }
}
