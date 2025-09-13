/**
 * CardItem Component
 * Individual card item with editing capabilities
 */

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
import { getValidComponentTypes } from '@common/utils/card';
import { computedThemeVariables } from '../themes/helper';
import { notifyWarning } from '@common/notification';

const IMAGE_FALLBACK_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage%3C/text%3E%3C/svg%3E";

const TEXT_STYLE = { whiteSpace: 'pre-line' };

export interface CardItemProps {
  card: CardModel;
  index: number;
  onUpdate: (card: CardModel) => void;
  onDelete: (id: string) => void;
  // Forward declaration for EditableCardList component
  onCreateCardList: (cards: CardModel[]) => void;
  // If the parent card list is editable.
  // If not, this card must not be editable.
  parentEditable?: boolean;
}

interface CardPreviewProps {
  cardContent: CardContent;
  showNested: boolean;
}

interface CardContentViewProps {
  cardContent: CardContent;
  editing: boolean;
  EditableCardListComponent: React.ComponentType<any>;
}

export interface CardToolBarProps {
  editing: boolean;
  title: string | undefined;
  container: PomlContainerType | undefined;
  onTitleChange: (title: string | undefined) => void;
  onContainerChange: (container: PomlContainerType | undefined) => void;
  onEditChange: (edit: boolean) => void;
  onCopy: () => void;
  onDelete: () => void;
}

/**
 * A card should have a preview when its content is too long.
 * The preview does not take care of the title.
 */
const shouldHavePreview = (card: CardModel) => {
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
const CardPreview = ({ cardContent, showNested }: CardPreviewProps) => {
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
    return <CardContentView cardContent={cardContent} editing={false} />;
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
const CardContentView = ({ cardContent, editing, EditableCardListComponent }: CardContentViewProps) => {
  const imageDataUrl = useMemo(() => {
    if (cardContent.type === 'image') {
      return `data:image/png;base64,${cardContent.base64}`;
    }
    return null;
  }, [cardContent]);

  if (cardContent.type === 'text') {
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
      <Stack gap='xs'>
        {cardContent.cards.map((content, index) => (
          <CardPreview key={index} cardContent={content} showNested={false} />
        ))}
      </Stack>
    );
  }
  return null;
};

const getCardIcon = (card: CardModel) => {
  const theme = useMantineTheme();
  const sz = px(theme.fontSizes.lg);
  if (card.content.type === 'image') {
    return <IconPhoto size={sz} />;
  } else if (card.content.container === 'Code') {
    return <IconCode size={sz} />;
  } else if (card.content.type === 'list') {
    return <IconList size={sz} />;
  } else if (card.content.type === 'table') {
    return <IconTable size={sz} />;
  } else {
    return <IconFile size={sz} />;
  }
};

/**
 * You can basically edit two things in this toolbar:
 * One is the card caption, the other is poml container type.
 * You can also delete and copy the card via this toolbar.
 * The toolbar is only visible after user clicked the editing button.
 */
export const CardEditToolbar = ({
  editing,
  title,
  container,
  onTitleChange,
  onContainerChange,
  onEditChange,
  onCopy,
  onDelete,
}: CardToolBarProps) => {
  const theme = useMantineTheme();
  const iconSizeSmall = px(theme.fontSizes.sm);
  const iconSizeMedium = px(theme.fontSizes.md);
  const validComponentTypes = useMemo(() => {
    return getValidComponentTypes();
  }, []);

  const { colors } = computedThemeVariables();

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.trim();
      onTitleChange(value.length > 0 ? value : undefined);
    },
    [onTitleChange],
  );

  const handleContainerChange = useCallback(
    (newContainer: PomlContainerType) => {
      onContainerChange(newContainer);
    },
    [onContainerChange],
  );

  return (
    <Group gap='xs' display='flex'>
      <TextInput
        value={title ?? ''}
        onChange={handleTitleChange}
        placeholder='Caption'
        size='md'
        fw={500}
        variant='unstyled'
        styles={{
          wrapper: {
            flex: 1,
            minWidth: 0,
          },
          input: {
            'border': colors.border.active,
            'borderRadius': theme.defaultRadius,
            'padding': '4px 8px',
            '&:focus': {
              borderColor: colors.poml.primary,
            },
          },
        }}
      />
      <Menu shadow='md' width='12em'>
        <Menu.Target>
          <Badge size='sm' rightSection={<IconChevronDown size={iconSizeSmall} />} style={{ cursor: 'pointer' }}>
            {container || 'Paragraph'}
          </Badge>
        </Menu.Target>
        <Menu.Dropdown>
          {validComponentTypes.map((type) => (
            <Menu.Item key={type} onClick={() => handleContainerChange(type)}>
              <Text size='sm' fw={600}>
                {type}
              </Text>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <Switch
        size='sm'
        checked={editing}
        onChange={(event) => {
          onEditChange(event.currentTarget.checked);
        }}
        onLabel={<IconEdit size={iconSizeSmall} stroke={2.5} />}
        offLabel={<IconEditOff size={iconSizeSmall} stroke={2.5} />}
      />
      <ActionIcon size='sm' variant='subtle' color='primary' onClick={onCopy}>
        <IconCopy size={iconSizeMedium} />
      </ActionIcon>
      <ActionIcon size='sm' variant='subtle' color='red' onClick={onDelete}>
        <IconTrash size={iconSizeMedium} />
      </ActionIcon>
    </Group>
  );
};

/**
 * The main UI component for one card item.
 */
export const CardItem: React.FC<CardItemProps> = ({
  card,
  index,
  onUpdate,
  onDelete,
  parentEditable,
  EditableCardListComponent,
}: CardItemProps) => {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Editing states that has not commited
  const [title, setTitle] = useState(card.content.caption);
  const [container, setContainer] = useState(card.content.container);

  const theme = useMantineTheme();
  const { colors } = computedThemeVariables();

  const iconSize = px(theme.fontSizes.md);

  // Component icons mapping
  const ComponentIcons: Record<PomlContainerType, React.ReactElement> = {
    Paragraph: <IconFile size={iconSize} />,
    Text: <IconFile size={iconSize} />,
    Code: <IconCode size={iconSize} />,
    Task: <IconList size={iconSize} />,
    Question: <IconList size={iconSize} />,
    Hint: <IconList size={iconSize} />,
    Role: <IconList size={iconSize} />,
    OutputFormat: <IconList size={iconSize} />,
    StepwiseInstructions: <IconList size={iconSize} />,
    Example: <IconList size={iconSize} />,
    ExampleInput: <IconList size={iconSize} />,
    ExampleOutput: <IconList size={iconSize} />,
    ExampleSet: <IconList size={iconSize} />,
    Introducer: <IconList size={iconSize} />,
  };

  const handleToggleExpanded = useCallback(() => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    if (!newExpanded) {
      // If not expanded any more, we should also close the edit mode.
      setEditing(false);
    }
  }, [setExpanded, setEditing, expanded]);

  const handleEditModeChange = useCallback(
    (edit: boolean) => {
      setEditing(edit);
      if (!edit) {
        onUpdate({ ...card, content: { ...card.content, caption: title, container: container } });
      }
      // TODO: Gather data from textarea and other inputs, update them all.
    },
    [card, onUpdate],
  );

  const handleCopy = useCallback(() => {
    notifyWarning('Copying single card is not implemented yet');
  }, []);

  const contentPreview = useMemo(() => {
    if (card.content.type === 'text') {
      return card.content.text.substring(0, 100) + (card.content.text.length > 100 ? '...' : '');
    } else if (card.content.type === 'list') {
      return `List with ${card.content.items.length} items`;
    } else if (card.content.type === 'image') {
      return `Image (${card.content.alt || 'no alt text'})`;
    } else if (card.content.type === 'table') {
      return `Table with ${card.content.records.length} rows`;
    } else if (card.content.type === 'nested') {
      return `${card.content.cards.length} nested items`;
    }
    return 'Empty';
  }, [card.content]);

  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={!parentEditable}>
      {(provided, snapshot) => {
        const boxStyle = snapshot.isDragging
          ? {
              backgroundColor: colors.scale[2],
              opacity: 0.8,
              boxShadow: theme.shadows.md,
              border: `1.5px solid ${colors.border.active}`,
              borderRadius: theme.defaultRadius,
            }
          : {};

        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...(parentEditable ? provided.dragHandleProps : {})}
            style={{
              ...provided.draggableProps.style,
              cursor: parentEditable ? (snapshot.isDragging ? 'grabbing' : 'grab') : 'default',
            }}>
            {/* The main card container */}
            <Box
              p='xs'
              style={{
                position: 'relative',
                ...boxStyle,
              }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}>
              <Group mb='xs' display='flex'>
                <ActionIcon size='sm' variant='subtle' onClick={handleToggleExpanded} flex='0 0 auto'>
                  {expanded ? <IconChevronDown size={iconSize} /> : <IconChevronRight size={iconSize} />}
                </ActionIcon>
                {/* Always show title in edit mode, or when it exists */}
                {editing ? (
                  <CardEditToolbar
                    editing={editing}
                    title={card.content.caption}
                    container={card.content.container}
                    onTitleChange={setTitle}
                    onContainerChange={setContainer}
                    onEditChange={setEditing}
                    onCopy={handleCopy}
                    onDelete={() => onDelete(card.id)}
                  />
                ) : (
                  card.content.caption && (
                    <Text fw={600} size='sm'>
                      {card.content.caption}
                    </Text>
                  )
                )}
              </Group>

              {/* TODO: If not editing add a hovered copy and edit button at the top right corner */}

              {/* Contents */}

              {card.content.type !== 'nested' && (
                <>
                  {card.content.type === 'image' ? (
                    <Box mt='xs'>
                      <Image
                        src={imageDataUrl}
                        alt={card.content.alt || 'Card image'}
                        fit='contain'
                        h='15em'
                        w='100%'
                        fallbackSrc={IMAGE_FALLBACK_SRC}
                      />
                      <Text size='xs' c='dimmed' mt='xs'>
                        {contentPreview}
                      </Text>
                    </Box>
                  ) : (
                    <Text size='sm' c='dimmed'>
                      {contentPreview}
                    </Text>
                  )}
                </>
              )}

              {/* Nested cards */}
              {card.content.type === 'nested' && expanded && (
                <Box mt='xs'>
                  <EditableCardListComponent
                    cards={card.content.cards.map((content, index) => ({
                      id: `nested-${card.id}-${index}`,
                      content,
                      timestamp: new Date(),
                    }))}
                    onChange={(cardModels: CardModel[]) =>
                      onUpdate({
                        ...card,
                        content: {
                          type: 'nested',
                          cards: cardModels.map((cardModel) => cardModel.content),
                        },
                      })
                    }
                    editable={parentEditable}
                  />
                </Box>
              )}
            </Box>
          </div>
        );
      }}
    </Draggable>
  );
};

export default CardItem;
