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
import { type EditableCardListProps } from './card-list';
import { CardContentView, CardPreview } from './content-view';

export interface CardItemProps {
  card: CardModel;
  index: number;
  onUpdate: (card: CardModel) => void;
  onDelete: (id: string) => void;
  // Forward declaration for EditableCardList component
  EditableCardListComponent: React.ComponentType<EditableCardListProps>;
  // If the parent card list is editable.
  // If not, this card must not be editable.
  parentEditable?: boolean;
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

              {expanded ? (
                <CardContentView
                  card={card}
                  editing={editing}
                  onUpdate={(cardContent) => onUpdate({ ...card, content: cardContent })}
                  EditableCardListComponent={EditableCardListComponent}
                />
              ) : (
                <CardPreview cardContent={card.content} showNested={true} />
              )}
            </Box>
          </div>
        );
      }}
    </Draggable>
  );
};

export default CardItem;
