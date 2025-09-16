/**
 * CardItem Component
 * Individual card item with editing capabilities
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
import { CardContentPreview, CardContentView, shouldHavePreview } from './content-view';

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
  style?: React.CSSProperties;
}

export interface CardNonEditToolbarProps {
  title: string | undefined;
  container: PomlContainerType | undefined;
  editing: boolean;
  onEditChange: (edit: boolean) => void;
  onCopy: () => void;
  style?: React.CSSProperties;
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
  style,
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
    <Group gap='xs' display='flex' style={style}>
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

export const CardNonEditToolbar = ({
  title,
  container,
  editing,
  onEditChange,
  onCopy,
  style,
}: CardNonEditToolbarProps) => {
  const theme = useMantineTheme();
  const iconSizeSmall = px(theme.fontSizes.sm);

  return (
    <Group gap='xs' display='flex' style={style}>
      <Text fw={600} size='sm' flex='1 1 auto'>
        {title || '(No title)'}
      </Text>
      <Badge size='sm'>{container || 'Paragraph'}</Badge>
      <Switch
        size='sm'
        checked={editing}
        onChange={(event) => {
          onEditChange(event.currentTarget.checked);
        }}
        onLabel={<IconEdit size={iconSizeSmall} stroke={2.5} />}
        offLabel={<IconEditOff size={iconSizeSmall} stroke={2.5} />}
      />
    </Group>
  );
};

/**
 * The main UI component for one card item.
 *
 * Title behavior:
 *
 * 1. If the card has the need for preview (long card / nested), show the expanding button.
 *   1.a. If the expanding button exists, there must be a title bar.
 *   1.b. In edit mode, there is a special title tool bar.
 *   1.c. In other cases, the title bar show caption (if exists) and container plus edit button.
 * 2. If the card does not have the need for preview (short card / not nested),
 *   2.a. If the card has a title or configured container, show the title bar.
 *   2.b. In edit mode, there is a special title tool bar.
 *   2.c. In other cases, the edit button is only shown when the card is hovered.
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

  // Update the edit mode when parentEditable changes
  useEffect(() => {
    if (!parentEditable && editing) {
      setEditing(false);
    }
  }, [parentEditable]);

  // Use this function to update the edit mode.
  const updateEditMode = useCallback(
    (edit: boolean) => {
      setEditing(edit);
      if (!edit) {
        // Commit changes when exiting edit mode
        onUpdate({ ...card, content: { ...card.content, caption: title, container: container } });
      } else {
        // Reset to current values when entering edit mode
        setTitle(card.content.caption);
        setContainer(card.content.container);
        // Open expanded when entering edit mode
        setExpanded(true);
      }
    },
    [card, onUpdate, setTitle, setContainer, setExpanded],
  );

  const handleToggleExpanded = useCallback(() => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    if (!newExpanded) {
      // If not expanded any more, we should also close the edit mode.
      updateEditMode(false);
    }
  }, [setExpanded, updateEditMode, expanded]);

  const handleCopy = useCallback(() => {
    notifyWarning('Copying single card is not implemented yet');
  }, []);

  const needsPreview = useMemo(() => shouldHavePreview(card), [card]);

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

        // 1. If card needs preview (long/nested), always show expanding button and title bar
        // 2. If card doesn't need preview but has title/container, show title bar
        // 3. Edit button visibility depends on mode and hover state

        const hasTitle = !!(card.content.caption || card.content.container);
        const shouldShowTitleBar = needsPreview || hasTitle || editing;

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
              {/* Title bar - only show if needed according to docstring logic */}
              {(needsPreview || shouldShowTitleBar) && (
                <Group mb='xs' display='flex'>
                  {needsPreview && (
                    <ActionIcon size='sm' variant='subtle' onClick={handleToggleExpanded} flex='0 0 auto'>
                      {expanded ? <IconChevronDown size={iconSize} /> : <IconChevronRight size={iconSize} />}
                    </ActionIcon>
                  )}
                  {editing ? (
                    // Always show edit toolbar in edit mode
                    <CardEditToolbar
                      editing={editing}
                      title={card.content.caption}
                      container={card.content.container}
                      onTitleChange={setTitle}
                      onContainerChange={setContainer}
                      onEditChange={updateEditMode}
                      onCopy={handleCopy}
                      onDelete={() => onDelete(card.id)}
                      style={{ flex: '1 1 auto' }}
                    />
                  ) : (
                    <CardNonEditToolbar
                      title={card.content.caption}
                      container={card.content.container}
                      editing={editing}
                      onEditChange={updateEditMode}
                      onCopy={handleCopy}
                      style={{ flex: '1 1 auto' }}
                    />
                  )}
                </Group>
              )}

              {/* Show edit button on hover for cards without title bar */}
              {!shouldShowTitleBar && hovered && parentEditable && (
                <Group
                  style={{
                    position: 'absolute',
                    top: px(theme.spacing.xs),
                    right: px(theme.spacing.xs),
                    zIndex: 1,
                  }}
                  gap='xs'>
                  <ActionIcon size='sm' variant='light' color='primary' onClick={handleCopy}>
                    <IconCopy size={iconSize} />
                  </ActionIcon>
                  <ActionIcon size='sm' variant='light' color='primary' onClick={() => updateEditMode(true)}>
                    <IconEdit size={iconSize} />
                  </ActionIcon>
                </Group>
              )}

              {/* Contents */}

              {expanded ? (
                <CardContentView
                  card={card}
                  editing={editing}
                  onUpdate={(cardContent) => onUpdate({ ...card, content: cardContent })}
                  EditableCardListComponent={EditableCardListComponent}
                />
              ) : (
                <CardContentPreview cardContent={card.content} showNested={true} />
              )}
            </Box>
          </div>
        );
      }}
    </Draggable>
  );
};

export default CardItem;
