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
import { CardModel, PomlContainerType } from '@common/types';
import { getValidComponentTypes } from '@common/utils/card';
import { computedThemeVariables } from '../themes/helper';

export interface CardItemProps {
  card: CardModel;
  index: number;
  onUpdate: (card: CardModel) => void;
  onDelete: (id: string) => void;
  // Forward declaration for EditableCardList component
  EditableCardListComponent: React.ComponentType<any>;
  // If the parent card list is editable.
  // If not, this card must not be editable.
  parentEditable?: boolean;
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

export interface CardToolBarProps {
  editting: boolean;
  card: CardModel;
  onEditModeEnter: () => void;
  // Update the title and container type.
  onEditModeExit: (title: string | undefined, pomlContainerType: PomlContainerType | undefined) => void;
  onCopy: () => void;
  onDelete: () => void;
}

/**
 * You can basically edit two things in this toolbar:
 * One is the card caption, the other is poml container type.
 * You can also delete and copy the card via this toolbar.
 * The toolbar is only visible after user clicked the editting button.
 */
export const CardEditToolbar = ({
  editting,
  card,
  onEditModeEnter,
  onEditModeExit,
  onCopy,
  onDelete,
}: CardToolBarProps) => {
  const theme = useMantineTheme();
  const iconSizeSmall = px(theme.fontSizes.sm);
  const iconSizeMedium = px(theme.fontSizes.md);
  const validComponentTypes = useMemo(() => {
    return getValidComponentTypes();
  }, [card]);

  const [container, setContainer] = useState(card.content.container);
  const [title, setTitle] = useState(card.content.caption);
  const { colors } = computedThemeVariables();

  return (
    <Group gap='xs' display='flex'>
      <TextInput
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
            <Menu.Item key={type} onClick={() => setContainer(type)}>
              <Text size='sm' fw={600}>
                {type}
              </Text>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <Switch
        size='sm'
        checked={editting}
        onChange={(event) => {
          const newEditMode = event.currentTarget.checked;
          if (newEditMode) {
            onEditModeEnter();
          } else {
            onEditModeExit(title, container); // Will be handled by parent
          }
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
  const [editting, setEditting] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState(card.content.caption || '');
  const [isHovered, setIsHovered] = useState(false);

  const validComponentTypes = getValidComponentTypes();

  // Component icons mapping
  const ComponentIcons: Record<PomlContainerType, React.ReactElement> = {
    Paragraph: <IconFile size={16} />,
    Text: <IconFile size={16} />,
    Code: <IconCode size={16} />,
    Task: <IconList size={16} />,
    Question: <IconList size={16} />,
    Hint: <IconList size={16} />,
    Role: <IconList size={16} />,
    OutputFormat: <IconList size={16} />,
    StepwiseInstructions: <IconList size={16} />,
    Example: <IconList size={16} />,
    ExampleInput: <IconList size={16} />,
    ExampleOutput: <IconList size={16} />,
    ExampleSet: <IconList size={16} />,
    Introducer: <IconList size={16} />,
  };

  const handleEditModeConfirm = useCallback(() => {
    if (titleEditValue.trim() === '') {
      onUpdate({ ...card, content: { ...card.content, caption: undefined } });
    } else {
      onUpdate({ ...card, content: { ...card.content, caption: titleEditValue } });
    }
  }, [card, titleEditValue, onUpdate]);

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

  const imageDataUrl = useMemo(() => {
    if (card.content.type === 'image') {
      return `data:image/png;base64,${card.content.base64}`;
    }
    return null;
  }, [card.content]);

  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={!parentEditable}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...(parentEditable ? provided.dragHandleProps : {})}
          style={{
            ...provided.draggableProps.style,
            cursor: parentEditable ? (snapshot.isDragging ? 'grabbing' : 'grab') : 'default',
          }}>
          <Box
            style={{
              position: 'relative',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '12px',
              backgroundColor: snapshot.isDragging ? '#f0f0f0' : '#fff',
              opacity: snapshot.isDragging ? 0.8 : 1,
              boxShadow: snapshot.isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}>
            <>
              {/* Always show title in edit mode, or when it exists */}
              {(isEditMode || card.content.caption) && (
                <Group mb='xs' style={{ flex: 1, minWidth: 0 }}>
                  {card.content.type === 'nested' && (
                    <ActionIcon size='sm' variant='subtle' onClick={() => setIsExpanded(!isExpanded)}>
                      {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    </ActionIcon>
                  )}

                  {isEditMode ? (
                    <TextInput
                      value={titleEditValue}
                      onChange={(e) => setTitleEditValue(e.target.value)}
                      placeholder='Card title'
                      size='sm'
                      fw={600}
                      variant='unstyled'
                      style={{ flex: 1, minWidth: 0 }}
                      styles={{
                        input: {
                          'fontWeight': 600,
                          'border': '1px solid #e0e0e0',
                          'borderRadius': '4px',
                          'padding': '4px 8px',
                          '&:focus': {
                            borderColor: '#228be6',
                          },
                        },
                      }}
                    />
                  ) : (
                    <Text fw={600} size='sm'>
                      {card.content.caption}
                    </Text>
                  )}
                </Group>
              )}

              {/* Content type badge and toolbar */}
              <Group justify='space-between' mb='xs' style={{ position: 'relative' }}>
                <Group gap='xs'>
                  {!isEditMode && card.content.type === 'nested' && !card.content.caption && (
                    <ActionIcon size='sm' variant='subtle' onClick={() => setIsExpanded(!isExpanded)}>
                      {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                    </ActionIcon>
                  )}

                  {isEditMode ? (
                    <Menu shadow='md' width={150}>
                      <Menu.Target>
                        <Badge
                          size='sm'
                          variant='light'
                          leftSection={ComponentIcons[card.content.container || 'Paragraph']}
                          rightSection={<IconChevronDown size={12} />}
                          style={{ cursor: 'pointer' }}>
                          {card.content.container || 'Paragraph'}
                        </Badge>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {validComponentTypes.map((type) => (
                          <Menu.Item
                            key={type}
                            leftSection={ComponentIcons[type]}
                            onClick={() =>
                              onUpdate({
                                ...card,
                                content: {
                                  ...card.content,
                                  container: type as PomlContainerType,
                                },
                              })
                            }>
                            {type}
                          </Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>
                  ) : (
                    <Badge size='sm' variant='light' leftSection={getCardIcon(card)}>
                      {card.content.container || card.content.type.charAt(0).toUpperCase() + card.content.type.slice(1)}
                    </Badge>
                  )}
                </Group>

                {/* CardToolbar - positioned absolutely within this Group */}
                {parentEditable && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      padding: '4px',
                      boxShadow: isEditMode || isHovered ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                      opacity: isEditMode || isHovered ? 1 : 0,
                      transition: 'all 0.2s ease',
                      zIndex: 10,
                    }}>
                    <CardToolbar
                      editting={isEditMode}
                      onEditModeEnter={() => {
                        setIsEditMode(true);
                        setTitleEditValue(card.content.caption || '');
                      }}
                      onEditModeExit={() => {
                        setIsEditMode(false);
                        handleEditModeConfirm();
                      }}
                      onDelete={() => onDelete(card.id)}
                    />
                  </div>
                )}
              </Group>

              {card.content.type !== 'nested' && (
                <>
                  {card.content.type === 'image' ? (
                    <Box mt='xs'>
                      <Image
                        src={imageDataUrl}
                        alt={card.content.alt || 'Card image'}
                        fit='contain'
                        h={200}
                        w='100%'
                        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage%3C/text%3E%3C/svg%3E"
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
              {card.content.type === 'nested' && isExpanded && (
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
            </>
          </Box>
        </div>
      )}
    </Draggable>
  );
};

export default CardItem;
