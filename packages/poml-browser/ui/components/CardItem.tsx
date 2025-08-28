/**
 * CardItem Component
 * Individual card item with editing capabilities
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Text, Group, Badge, Box, ActionIcon, TextInput, Image, Switch, Menu } from '@mantine/core';
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
import {
  CardModel,
  POMLComponentType,
  isTextContent,
  isBinaryContent,
  isFileContent,
  isNestedContent,
  getValidComponentTypes,
  getDefaultComponentType,
  isImageBinaryContent,
  getBinaryContentDataUrl,
} from '@common/cardModel';

export interface CardItemProps {
  card: CardModel;
  index: number;
  onUpdate: (card: CardModel) => void;
  onDelete: (id: string) => void;
  onCardClick?: (card: CardModel) => void;
  editable: boolean;
  // Forward declaration for EditableCardList component
  EditableCardListComponent?: React.ComponentType<any>;
}

// Icon map for component types
const ComponentIcons: Partial<Record<POMLComponentType, React.ReactNode>> = {
  Image: <IconPhoto size={16} />,
  Document: <IconFile size={16} />,
  Table: <IconTable size={16} />,
  Code: <IconCode size={16} />,
  List: <IconList size={16} />,
  Folder: <IconFolder size={16} />,
};

export const CardItem: React.FC<CardItemProps> = ({
  card,
  index,
  onUpdate,
  onDelete,
  onCardClick,
  editable,
  EditableCardListComponent,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [titleEditValue, setTitleEditValue] = useState(card.title || '');

  const validComponentTypes = useMemo(() => getValidComponentTypes(card.content), [card.content]);

  const handleEditModeConfirm = useCallback(() => {
    onUpdate({ ...card, title: titleEditValue });
  }, [card, titleEditValue, onUpdate]);

  const contentPreview = useMemo(() => {
    if (isTextContent(card.content)) {
      return card.content.value.substring(0, 100) + (card.content.value.length > 100 ? '...' : '');
    } else if (isBinaryContent(card.content)) {
      if (isImageBinaryContent(card.content)) {
        return `Image (${card.content.mimeType})`;
      }
      return `Binary data (${card.content.mimeType || 'unknown type'})`;
    } else if (isFileContent(card.content)) {
      return `File: ${card.content.name || card.content.path || card.content.url || 'unknown'}`;
    } else if (isNestedContent(card.content)) {
      return `${card.content.children.length} nested items`;
    }
    return 'Empty';
  }, [card.content]);

  const imageDataUrl = useMemo(() => {
    if (isBinaryContent(card.content) && isImageBinaryContent(card.content)) {
      return getBinaryContentDataUrl(card.content);
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
                  {isNestedContent(card.content) && (
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
                    card.title && (
                      <Text fw={600} size='sm'>
                        {card.title}
                      </Text>
                    )
                  )}

                  {isEditMode ? (
                    <Menu shadow='md' width={150}>
                      <Menu.Target>
                        <Badge
                          size='sm'
                          variant='light'
                          leftSection={ComponentIcons[card.componentType || getDefaultComponentType(card)]}
                          rightSection={<IconChevronDown size={12} />}
                          style={{ cursor: 'pointer' }}>
                          {card.componentType || getDefaultComponentType(card)}
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
                                componentType: type as POMLComponentType,
                              })
                            }>
                            {type}
                          </Menu.Item>
                        ))}
                      </Menu.Dropdown>
                    </Menu>
                  ) : (
                    <Badge
                      size='sm'
                      variant='light'
                      leftSection={ComponentIcons[card.componentType || getDefaultComponentType(card)]}>
                      {card.componentType || getDefaultComponentType(card)}
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

              {!isNestedContent(card.content) && (
                <>
                  {isBinaryContent(card.content) && isImageBinaryContent(card.content) ? (
                    <Box mt='xs'>
                      <Image
                        src={imageDataUrl}
                        alt={card.title || 'Card image'}
                        fit='contain'
                        h={200}
                        w='100%'
                        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage%3C/text%3E%3C/svg%3E"
                        style={{ cursor: onCardClick ? 'pointer' : 'default' }}
                        onClick={() => onCardClick?.(card)}
                      />
                      <Text size='xs' c='dimmed' mt='xs'>
                        {contentPreview}
                      </Text>
                    </Box>
                  ) : (
                    <Text
                      size='sm'
                      c='dimmed'
                      style={{ cursor: onCardClick ? 'pointer' : 'default' }}
                      onClick={() => onCardClick?.(card)}>
                      {contentPreview}
                    </Text>
                  )}
                </>
              )}

              {isNestedContent(card.content) && isExpanded && EditableCardListComponent && (
                <Box mt='xs'>
                  <EditableCardListComponent
                    cards={card.content.children}
                    onChange={(children: CardModel[]) =>
                      onUpdate({
                        ...card,
                        content: {
                          type: 'nested',
                          children,
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
