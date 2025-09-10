/**
 * CardItem Component
 * Individual card item with editing capabilities
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
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
  IconFolder,
} from '@tabler/icons-react';
import { Draggable } from '@hello-pangea/dnd';
import { CardModel, PomlContainerType } from '@common/types';
import { getValidComponentTypes } from '@common/utils/card';

export interface CardItemProps {
  card: CardModel;
  index: number;
  onUpdate: (card: CardModel) => void;
  onDelete: (id: string) => void;
  editable: boolean;
  // Forward declaration for EditableCardList component
  EditableCardListComponent: React.ComponentType<any>;
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

export const CardItem: React.FC<CardItemProps> = ({
  card,
  index,
  onUpdate,
  onDelete,
  editable,
  EditableCardListComponent,
}: CardItemProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState(card.content.caption || '');

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
    const { content, ...rest } = card;
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
    <Draggable draggableId={card.id} index={index} isDragDisabled={!editable}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...(editable ? provided.dragHandleProps : {})}
          style={{
            ...provided.draggableProps.style,
            cursor: editable ? (snapshot.isDragging ? 'grabbing' : 'grab') : 'default',
          }}>
          <Card
            shadow={snapshot.isDragging ? 'lg' : 'sm'}
            p='sm'
            radius='md'
            withBorder
            style={{
              opacity: snapshot.isDragging ? 0.8 : 1,
              backgroundColor: snapshot.isDragging ? '#f0f0f0' : undefined,
            }}>
            <>
              <Group justify='space-between' mb='xs'>
                <Group gap='xs' style={{ flex: 1, minWidth: 0 }}>
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
                          'padding': '2px 4px',
                          '&:focus': {
                            borderColor: '#228be6',
                          },
                        },
                      }}
                    />
                  ) : (
                    card.content.caption && (
                      <Text fw={600} size='sm'>
                        {card.content.caption}
                      </Text>
                    )
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

                {editable && (
                  <Group gap='xs' style={{ flexShrink: 0 }}>
                    <Switch
                      size='sm'
                      checked={isEditMode}
                      onChange={(event) => {
                        const newEditMode = event.currentTarget.checked;
                        setIsEditMode(newEditMode);
                        if (!newEditMode) {
                          // Save title changes when exiting edit mode
                          handleEditModeConfirm();
                        }
                      }}
                      onLabel={<IconEdit size={12} stroke={2.5} />}
                      offLabel={<IconEditOff size={12} stroke={2.5} />}
                    />

                    <ActionIcon size='sm' variant='subtle' color='red' onClick={() => onDelete(card.id)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
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
                    editable={editable}
                  />
                </Box>
              )}
            </>
          </Card>
        </div>
      )}
    </Draggable>
  );
};

export default CardItem;
