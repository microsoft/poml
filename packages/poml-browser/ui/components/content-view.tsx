import React, { useState, useCallback, useMemo } from 'react';
import {
  Text,
  Group,
  Badge,
  Box,
  ActionIcon,
  TextInput,
  Image,
  Switch,
  Menu,
  px,
  useMantineTheme,
  List,
  ListItem,
  Stack,
  Table,
} from '@mantine/core';
import {
  IconTrash,
  IconEdit,
  IconEditOff,
  IconChevronDown,
  IconChevronRight,
  IconFile,
  IconPhoto,
  IconTable,
  IconCode,
  IconList,
  IconCopy,
} from '@tabler/icons-react';
import { Draggable } from '@hello-pangea/dnd';
import { CardContent, CardModel, PomlContainerType } from '@common/types';
import { createCard, getValidComponentTypes } from '@common/utils/card';
import { computedThemeVariables } from '../themes/helper';
import { notifyWarning } from '@common/notification';
import { type EditableCardListProps } from './card-list';

const TEXT_STYLE = { whiteSpace: 'pre-line' };

const IMAGE_FALLBACK_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage%3C/text%3E%3C/svg%3E";

interface CardPreviewProps {
  cardContent: CardContent;
  showNested: boolean;
}

interface CardContentViewProps {
  card: CardModel;
  editing: boolean;
  onUpdate: (cardContent: CardContent) => void;
  EditableCardListComponent: React.ComponentType<EditableCardListProps>;
}

/**
 * A card should have a preview when its content is too long.
 * The preview does not take care of the title.
 */
export const shouldHavePreview = (card: CardModel) => {
  if (card.content.type === 'text') {
    return card.content.text.length > 300 || (card.content.text.match(/\n/g) || []).length > 10;
  } else if (card.content.type === 'list') {
    return card.content.items.length > 8;
  } else if (card.content.type === 'table') {
    // not supported yet
    return false;
  } else if (card.content.type === 'image') {
    // Images always have preview
    return true;
  } else if (card.content.type === 'nested') {
    // Nested content always have preview when having more than 3 nested card
    return card.content.cards.length > 3;
  }
  return false;
};

const TruncateMarker = ({ marker }: { marker?: string }) => {
  return <Text c='dimmed'>{marker || '... (truncated)'}</Text>;
};

/**
 * Preview of an card content when the expanded button is not clicked.
 */
export const CardPreview = ({ cardContent, showNested }: CardPreviewProps) => {
  const imageDataUrl = useMemo(() => {
    if (cardContent.type === 'image') {
      return `data:image/png;base64,${cardContent.base64}`;
    }
    return null;
  }, [cardContent]);

  if (cardContent.type === 'text') {
    if (cardContent.text.match(/\n/g)?.[9]) {
      // Find the index of the 10th newline character
      const match = [...cardContent.text.matchAll(/\n/g)];
      const index = match[9]?.index ?? 0;
      const substr = cardContent.text.substring(0, index);
      return (
        <Text size='sm' style={TEXT_STYLE}>
          {substr} <TruncateMarker />
        </Text>
      );
    } else {
      const substr = cardContent.text.substring(0, 300);
      return (
        <Text size='sm' style={TEXT_STYLE}>
          {substr} <TruncateMarker />
        </Text>
      );
    }
  } else if (cardContent.type === 'image') {
    return (
      <Box>
        <Image
          src={imageDataUrl}
          alt={cardContent.alt}
          fit='contain'
          h='15em'
          w='100%'
          fallbackSrc={IMAGE_FALLBACK_SRC}
        />
        {cardContent.alt && (
          <Text size='xs' c='dimmed' mt='xs'>
            {cardContent.alt}
          </Text>
        )}
      </Box>
    );
  } else if (cardContent.type === 'list') {
    const first8 = cardContent.items.slice(0, 8);
    return (
      <List>
        {first8.map((item, index) => {
          const substr = item.length > 100 ? item.substring(0, 100) + '... (truncated)' : item;
          return (
            <ListItem key={index}>
              <Text size='sm'>
                {substr} <TruncateMarker />
              </Text>
            </ListItem>
          );
        })}
        <ListItem>
          <Text size='sm'>...</Text>
        </ListItem>
      </List>
    );
  } else if (cardContent.type === 'table') {
    return <Text size='sm'>Table with {cardContent.records.length} rows</Text>;
  } else if (cardContent.type === 'nested') {
    if (!showNested) {
      return (
        <Text size='sm' c='dimmed'>
          {cardContent.cards.length} nested items
        </Text>
      );
    }
    const first3 = cardContent.cards.slice(0, 3).map((content, index) => {
      // If we are already showing preview, we don't show the nested contents again.
      return <CardPreview key={index} cardContent={content} showNested={false} />;
    });
    if (cardContent.cards.length > 3) {
      return (
        <Stack gap='xs'>
          {first3}
          <TruncateMarker marker={`... (${cardContent.cards.length - 3} more)`} />
        </Stack>
      );
    } else {
      return first3;
    }
  }
};

/**
 * The full content view of a card.
 */
export const CardContentView = ({ card, editing, onUpdate, EditableCardListComponent }: CardContentViewProps) => {
  // We will create a list of (fake) card models from the card content
  const nestedCardModels = useMemo(() => {
    const { id, content, timestamp, ...rest } = card;
    if (content.type !== 'nested') {
      return [];
    }
    return content.cards.map((content, index) => createCard(content, rest));
  }, [card]);
  const cardContent = card.content;

  if (cardContent.type === 'text') {
    // TODO: support edit mode
    return (
      <Text size='sm' style={TEXT_STYLE}>
        {cardContent.text}
      </Text>
    );
  } else if (cardContent.type === 'list') {
    return (
      <List>
        {cardContent.items.map((item, index) => (
          <ListItem key={index}>{item}</ListItem>
        ))}
      </List>
    );
  } else if (cardContent.type === 'image') {
    return <CardPreview cardContent={cardContent} showNested={false} />;
  } else if (cardContent.type === 'table') {
    return (
      <Table>
        <Table.Thead>
          <Table.Tr>
            {cardContent.columns?.map((column) => (
              <Table.Td key={column.field}>{column.header}</Table.Td>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {cardContent.records.map((record, index) => (
            <Table.Tr key={index}>
              {cardContent.columns?.map((column) => (
                <Table.Td key={column.field}>{record[column.field] ?? ''}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  } else if (cardContent.type === 'nested') {
    return (
      <EditableCardListComponent
        cards={nestedCardModels}
        onChange={(cards) => {
          onUpdate({
            ...cardContent,
            // Strip the faked card models when writing back
            cards: cards.map((card) => card.content),
          });
        }}
        /* Inherit the editing state from the current card */
        editable={editing}
      />
    );
  }
  return null;
};
