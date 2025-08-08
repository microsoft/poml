/**
 * Editable Card List Component
 * Provides an editable, reorderable, nestable list of cards
 */

import React, { useCallback, useState } from 'react';
import {
  Stack,
  Box,
  Button,
  Group,
  Paper,
  Text,
  Center
} from '@mantine/core';
import {
  IconPlus
} from '@tabler/icons-react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import {
  CardModel,
  isNestedContent,
  generateId
} from '@functions/cardModel';
import { CardItem } from './CardItem';

interface EditableCardListProps {
  cards: CardModel[];
  onChange: (cards: CardModel[]) => void;
  onSave?: (cards: CardModel[]) => void;
  onCardClick?: (card: CardModel) => void;
  editable?: boolean;
  nestingLevel?: number;
  maxNestingLevel?: number;
}

export const EditableCardList: React.FC<EditableCardListProps> = ({
  cards,
  onChange,
  onSave,
  onCardClick,
  editable = true,
  nestingLevel = 0,
  maxNestingLevel = 3
}) => {
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    const newCards = Array.from(cards);
    const [reorderedItem] = newCards.splice(result.source.index, 1);
    newCards.splice(result.destination.index, 0, reorderedItem);
    
    // Update order property
    const updatedCards = newCards.map((card, index) => ({
      ...card,
      order: index
    }));
    
    onChange(updatedCards);
  }, [cards, onChange]);
  
  const handleUpdateCard = useCallback((updatedCard: CardModel) => {
    const newCards = cards.map(card => 
      card.id === updatedCard.id ? updatedCard : card
    );
    onChange(newCards);
  }, [cards, onChange]);
  
  const handleDeleteCard = useCallback((id: string) => {
    const newCards = cards.filter(card => card.id !== id);
    onChange(newCards);
  }, [cards, onChange]);
  
  const handleAddCard = useCallback(() => {
    const newCard: CardModel = {
      id: generateId(),
      content: { type: 'text', value: '' },
      timestamp: new Date(),
      order: cards.length
    };
    onChange([...cards, newCard]);
  }, [cards, onChange]);
  
  const handleAddCardAtIndex = useCallback((index: number) => {
    const newCard: CardModel = {
      id: generateId(),
      content: { type: 'text', value: '' },
      timestamp: new Date(),
      order: index
    };
    const newCards = [...cards];
    newCards.splice(index, 0, newCard);
    
    // Update order property for all cards after insertion
    const updatedCards = newCards.map((card, idx) => ({
      ...card,
      order: idx
    }));
    
    onChange(updatedCards);
  }, [cards, onChange]);
  
  const handleAddChild = useCallback((parentId: string, child: CardModel) => {
    const updateCardRecursive = (cardList: CardModel[]): CardModel[] => {
      return cardList.map(card => {
        if (card.id === parentId) {
          if (isNestedContent(card.content)) {
            return {
              ...card,
              content: {
                ...card.content,
                children: [...card.content.children, child]
              }
            };
          } else {
            return {
              ...card,
              content: {
                type: 'nested',
                children: [child]
              },
              componentType: 'List'
            };
          }
        } else if (isNestedContent(card.content)) {
          return {
            ...card,
            content: {
              ...card.content,
              children: updateCardRecursive(card.content.children)
            }
          };
        }
        return card;
      });
    };
    
    onChange(updateCardRecursive(cards));
  }, [cards, onChange]);
  
  // DropZone component for adding cards at specific positions
  const DropZone: React.FC<{ index: number; isVisible: boolean }> = ({ index, isVisible }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
      <Paper
        p="xs"
        withBorder
        style={{
          borderStyle: 'dashed',
          borderColor: isHovered ? '#228be6' : '#e0e0e0',
          backgroundColor: isHovered ? '#f0f8ff' : 'transparent',
          cursor: 'pointer',
          opacity: isVisible || isHovered ? 1 : 0,
          height: isVisible || isHovered ? 'auto' : '4px',
          transition: 'all 0.2s ease',
          marginLeft: nestingLevel * 20
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => handleAddCardAtIndex(index)}
      >
        {(isVisible || isHovered) && (
          <Center>
            <Text size="xs" c="dimmed">
              <IconPlus size={14} style={{ display: 'inline', marginRight: 4 }} />
              Click to add card here
            </Text>
          </Center>
        )}
      </Paper>
    );
  };
  
  return (
    <Stack gap="sm">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`cards-${nestingLevel}`}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {editable && <DropZone index={0} isVisible={cards.length === 0} />}
              
              {cards.map((card, index) => (
                <React.Fragment key={card.id}>
                  <Box mb="sm">
                    <CardItem
                      card={card}
                      index={index}
                      onUpdate={handleUpdateCard}
                      onDelete={handleDeleteCard}
                      onCardClick={onCardClick}
                      onAddChild={nestingLevel < maxNestingLevel ? handleAddChild : undefined}
                      editable={editable}
                      nestingLevel={nestingLevel}
                      maxNestingLevel={maxNestingLevel}
                      EditableCardListComponent={EditableCardList}
                    />
                  </Box>
                  
                  {editable && (
                    <DropZone index={index + 1} isVisible={false} />
                  )}
                </React.Fragment>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      
      {editable && nestingLevel === 0 && (
        <Group justify="space-between">
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddCard}
          >
            Add Card
          </Button>
          
          {onSave && (
            <Button onClick={() => onSave(cards)}>
              Save Collection
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
};

export default EditableCardList;