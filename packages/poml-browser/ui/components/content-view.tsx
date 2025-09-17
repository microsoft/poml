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
  Code,
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
import { CardContent, CardModel, PomlContainerType, ColumnDefinition } from '@common/types';
import { createCard, getValidComponentTypes } from '@common/utils/card';
import { computedThemeVariables } from '../themes/helper';
import { notifyWarning } from '@common/notification';
import { type EditableCardListProps } from './card-list';

const TEXT_STYLE = { whiteSpace: 'pre-line' };

const IMAGE_FALLBACK_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage%3C/text%3E%3C/svg%3E";

interface CardContentPreviewProps {
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
 *
 * However, preview component is not necessarily called when shouldHavePreview is true;
 * it's also not necessary to be not called when shouldHavePreview is false.
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
export const CardContentPreview = ({ cardContent, showNested }: CardContentPreviewProps) => {
  if (cardContent.type === 'text') {
    let substr: string;
    if (cardContent.text.match(/\n/g)?.[9]) {
      // Find the index of the 10th newline character
      const match = [...cardContent.text.matchAll(/\n/g)];
      const index = match[9]?.index ?? 0;
      substr = cardContent.text.substring(0, index);
    } else {
      substr = cardContent.text.substring(0, 300);
    }
    if (cardContent.container === 'Code') {
      return (
        <Box component='div' size='md'>
          <Code block>
            {substr} <TruncateMarker />
          </Code>
        </Box>
      );
    } else {
      return (
        <Text size='md' style={TEXT_STYLE}>
          {substr} <TruncateMarker />
        </Text>
      );
    }
  } else if (cardContent.type === 'image') {
    return <ImageView base64={cardContent.base64} alt={cardContent.alt} showAlt={false} />;
  } else if (cardContent.type === 'table') {
    return <TableView records={cardContent.records} columns={cardContent.columns} />;
  } else if (cardContent.type === 'list') {
    const first8 = cardContent.items.slice(0, 8);
    return (
      <List>
        {first8.map((item, index) => {
          const substr = item.length > 100 ? item.substring(0, 100) + '... (truncated)' : item;
          return (
            <ListItem key={index}>
              <Text size='md'>
                {substr} <TruncateMarker />
              </Text>
            </ListItem>
          );
        })}
        <ListItem>
          <Text size='md'>...</Text>
        </ListItem>
      </List>
    );
  } else if (cardContent.type === 'nested') {
    if (!showNested) {
      return (
        <Text size='md' c='dimmed'>
          {cardContent.cards.length} nested items
        </Text>
      );
    }
    const first3 = cardContent.cards.slice(0, 3).map((content, index) => {
      // If we are already showing preview, we don't show the nested contents again.
      return <CardContentPreview key={index} cardContent={content} showNested={false} />;
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
    if (cardContent.container === 'Code') {
      return (
        <Box component='div' size='md'>
          <Code block>{cardContent.text}</Code>
        </Box>
      );
    } else {
      return (
        <Text size='md' style={TEXT_STYLE}>
          {cardContent.text}
        </Text>
      );
    }
  } else if (cardContent.type === 'list') {
    return (
      <List>
        {cardContent.items.map((item, index) => (
          <ListItem key={index}>
            <Text size='md'>{item}</Text>
          </ListItem>
        ))}
      </List>
    );
  } else if (cardContent.type === 'image') {
    return <ImageView base64={cardContent.base64} alt={cardContent.alt} showAlt={true} />;
  } else if (cardContent.type === 'table') {
    return <TableView records={cardContent.records} columns={cardContent.columns} />;
  } else if (cardContent.type === 'nested') {
    return (
      <Box pl='lg' pr={0} pt='xs' pb='xs' component='div'>
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
      </Box>
    );
  }
  return null;
};

const ImageView = ({ base64, alt, showAlt }: { base64: string; alt?: string; showAlt?: boolean }) => {
  const imageDataUrl = useMemo(() => {
    return `data:image/png;base64,${base64}`;
  }, [base64]);
  return (
    <Box>
      <Image src={imageDataUrl} alt={alt} fit='contain' h='15em' w='100%' fallbackSrc={IMAGE_FALLBACK_SRC} />
      {(showAlt ?? true) && alt && (
        <Text size='xs' c='dimmed' mt='xs'>
          {alt}
        </Text>
      )}
    </Box>
  );
};

const TableView = ({ records, columns }: { records: { [key: string]: any }[]; columns?: ColumnDefinition[] }) => {
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          {columns?.map((column) => (
            <Table.Td key={column.field}>{column.header}</Table.Td>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {records.map((record, index) => (
          <Table.Tr key={index}>
            {columns?.map((column) => (
              <Table.Td key={column.field}>{record[column.field] ?? ''}</Table.Td>
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
};
