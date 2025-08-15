/**
 * Editable Card List Component
 * Provides an editable, reorderable, nestable list of cards
 */

import React, { useCallback } from 'react';
import {
  Stack,
  Box,
  Button,
  Group
} from '@mantine/core';
import {
  IconPlus
} from '@tabler/icons-react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import {
  CardModel,
  isNestedContent,
  createCard
} from '@functions/cardModel';
import { CardItem } from './CardItem';
import { DroppableDivider } from './DroppableDivider';

interface EditableCardListProps {
  cards: CardModel[];
  onChange: (cards: CardModel[]) => void;
  onCardClick?: (card: CardModel) => void;
  editable?: boolean;
  nestingLevel?: number;
  maxNestingLevel?: number;
  onDragOverDivider?: (isOver: boolean) => void;
}

export const EditableCardList: React.FC<EditableCardListProps> = ({
  cards,
  onChange,
  onCardClick,
  editable = true,
  nestingLevel = 0,
  maxNestingLevel = 3,
  onDragOverDivider
}) => {
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) {
      return;
    }
    
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
    const newCard = createCard({
      content: { type: 'text', value: '' },
      order: cards.length
    });
    onChange([...cards, newCard]);
  }, [cards, onChange]);
  
  const handleAddCardAtIndex = useCallback((index: number) => {
    const newCard = createCard({
      content: { type: 'text', value: '' },
      order: index
    });
    const newCards = [...cards];
    newCards.splice(index, 0, newCard);
    
    // Update order property for all cards after insertion
    const updatedCards = newCards.map((card, idx) => ({
      ...card,
      order: idx
    }));
    
    onChange(updatedCards);
  }, [cards, onChange]);

  const handleDropContent = useCallback((droppedCards: CardModel[], index: number) => {
    const newCards = [...cards];
    
    // Insert all dropped cards at the specified index
    const cardsWithOrder = droppedCards.map((card, idx) => ({
      ...card,
      order: index + idx
    }));
    
    newCards.splice(index, 0, ...cardsWithOrder);
    
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
  
  
  return (
    <Stack gap="sm">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={`cards-${nestingLevel}`}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {editable && (
                <DroppableDivider 
                  index={0} 
                  isVisible={cards.length === 0}
                  nestingLevel={nestingLevel}
                  onAddCard={handleAddCardAtIndex}
                  onDropContent={handleDropContent}
                  onDragOverDivider={onDragOverDivider}
                />
              )}
              
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
                    <DroppableDivider 
                      index={index + 1} 
                      isVisible={false}
                      nestingLevel={nestingLevel}
                      onAddCard={handleAddCardAtIndex}
                      onDropContent={handleDropContent}
                      onDragOverDivider={onDragOverDivider}
                    />
                  )}
                </React.Fragment>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

    </Stack>
  );
};

export default EditableCardList;