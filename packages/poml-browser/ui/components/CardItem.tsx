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
  Stack,
  Box,
  Button,
  ActionIcon,
  Select,
  TextInput,
  Textarea,
  Tooltip,
  Image
} from '@mantine/core';
import {
  IconTrash,
  IconEdit,
  IconPlus,
  IconGripVertical,
  IconChevronDown,
  IconChevronRight,
  IconFile,
  IconPhoto,
  IconTable,
  IconCode,
  IconList,
  IconFolder
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
  createCard,
  isImageBinaryContent,
  getBinaryContentDataUrl
} from '@functions/cardModel';

export interface CardItemProps {
  card: CardModel;
  index: number;
  onUpdate: (card: CardModel) => void;
  onDelete: (id: string) => void;
  onCardClick?: (card: CardModel) => void;
  onAddChild?: (parentId: string, child: CardModel) => void;
  editable: boolean;
  nestingLevel: number;
  maxNestingLevel: number;
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
  Folder: <IconFolder size={16} />
};

export const CardItem: React.FC<CardItemProps> = ({
  card,
  index,
  onUpdate,
  onDelete,
  onCardClick,
  onAddChild,
  editable,
  nestingLevel,
  maxNestingLevel,
  EditableCardListComponent
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [editedCard, setEditedCard] = useState(card);
  
  const validComponentTypes = useMemo(
    () => getValidComponentTypes(card.content),
    [card.content]
  );
  
  const handleSave = useCallback(() => {
    onUpdate(editedCard);
    setIsEditing(false);
  }, [editedCard, onUpdate]);
  
  const handleCancel = useCallback(() => {
    setEditedCard(card);
    setIsEditing(false);
  }, [card]);
  
  const handleContentChange = useCallback((value: string) => {
    if (isTextContent(editedCard.content)) {
      setEditedCard({
        ...editedCard,
        content: { ...editedCard.content, value }
      });
    }
  }, [editedCard]);
  
  const handleAddNestedCard = useCallback(() => {
    if (!onAddChild || nestingLevel >= maxNestingLevel) return;
    
    const newCard = createCard({
      content: { type: 'text', value: '' },
      parentId: card.id
    });
    
    if (isNestedContent(card.content)) {
      onUpdate({
        ...card,
        content: {
          ...card.content,
          children: [...card.content.children, newCard]
        }
      });
    } else {
      // Convert to nested content
      onUpdate({
        ...card,
        content: {
          type: 'nested',
          children: [newCard]
        },
        componentType: 'List'
      });
    }
  }, [card, onAddChild, onUpdate, nestingLevel, maxNestingLevel]);
  
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
          style={{
            ...provided.draggableProps.style,
            marginLeft: nestingLevel * 20
          }}
        >
          <Card
            shadow={snapshot.isDragging ? 'lg' : 'sm'}
            p="sm"
            radius="md"
            withBorder
            style={{
              opacity: snapshot.isDragging ? 0.8 : 1,
              backgroundColor: snapshot.isDragging ? '#f0f0f0' : undefined
            }}
          >
            {isEditing ? (
              <Stack gap="xs">
                <TextInput
                  label="Title"
                  value={editedCard.title || ''}
                  onChange={(e) => setEditedCard({ ...editedCard, title: e.target.value })}
                  placeholder="Optional title"
                />
                
                <Select
                  label="Component Type"
                  value={editedCard.componentType || getDefaultComponentType(editedCard)}
                  onChange={(value) => setEditedCard({ 
                    ...editedCard, 
                    componentType: value as POMLComponentType 
                  })}
                  data={validComponentTypes.map(type => ({
                    value: type,
                    label: type
                  }))}
                />
                
                {isTextContent(editedCard.content) && (
                  <Textarea
                    label="Content"
                    value={editedCard.content.value}
                    onChange={(e) => handleContentChange(e.target.value)}
                    minRows={3}
                    maxRows={50}
                    autosize
                  />
                )}
                
                <Group justify="flex-end">
                  <Button size="xs" variant="subtle" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button size="xs" onClick={handleSave}>
                    Save
                  </Button>
                </Group>
              </Stack>
            ) : (
              <>
                <Group justify="space-between" mb="xs">
                  <Group gap="xs">
                    <div {...provided.dragHandleProps}>
                      <IconGripVertical 
                        size={18} 
                        style={{ 
                          cursor: editable ? 'grab' : 'default',
                          opacity: editable ? 1 : 0.3
                        }} 
                      />
                    </div>
                    
                    {isNestedContent(card.content) && (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => setIsExpanded(!isExpanded)}
                      >
                        {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                      </ActionIcon>
                    )}
                    
                    {card.title && (
                      <Text fw={600} size="sm">
                        {card.title}
                      </Text>
                    )}
                    
                    <Badge
                      size="sm"
                      variant="light"
                      leftSection={ComponentIcons[card.componentType || getDefaultComponentType(card)]}
                    >
                      {card.componentType || getDefaultComponentType(card)}
                    </Badge>
                  </Group>
                  
                  {editable && (
                    <Group gap="xs">
                      {nestingLevel < maxNestingLevel && (
                        <Tooltip label="Add nested card">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={handleAddNestedCard}
                          >
                            <IconPlus size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => setIsEditing(true)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => onDelete(card.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  )}
                </Group>
                
                {!isNestedContent(card.content) && (
                  <>
                    {isBinaryContent(card.content) && isImageBinaryContent(card.content) ? (
                      <Box mt="xs">
                        <Image
                          src={imageDataUrl}
                          alt={card.title || 'Card image'}
                          fit="contain"
                          h={200}
                          w="100%"
                          fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3EImage%3C/text%3E%3C/svg%3E"
                          style={{ cursor: onCardClick ? 'pointer' : 'default' }}
                          onClick={() => onCardClick?.(card)}
                        />
                        <Text size="xs" c="dimmed" mt="xs">
                          {contentPreview}
                        </Text>
                      </Box>
                    ) : (
                      <Text 
                        size="sm" 
                        c="dimmed"
                        style={{ cursor: onCardClick ? 'pointer' : 'default' }}
                        onClick={() => onCardClick?.(card)}
                      >
                        {contentPreview}
                      </Text>
                    )}
                  </>
                )}
                
                {isNestedContent(card.content) && isExpanded && EditableCardListComponent && (
                  <Box mt="xs">
                    <EditableCardListComponent
                      cards={card.content.children}
                      onChange={(children: CardModel[]) => onUpdate({
                        ...card,
                        content: { 
                          type: 'nested',
                          children
                        }
                      })}
                      editable={editable}
                      nestingLevel={nestingLevel + 1}
                      maxNestingLevel={maxNestingLevel}
                    />
                  </Box>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </Draggable>
  );
};

export default CardItem;