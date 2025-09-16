/**
 * Editable Card List Component
 * Provides an editable, reorderable, nestable list of cards
 */

import React, { useCallback } from 'react';
import { Stack, Box, Button, Group, Divider } from '@mantine/core';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { CardModel } from '@common/types';
import { CardItem } from './card-item';
import { DroppableDivider } from './droppable-divider';
import { createEmptyTextCard } from '@common/utils/card';

export interface EditableCardListProps {
  cards: CardModel[];
  onChange: (cards: CardModel[]) => void;
  // Edit mode is on. Edit mode is not controlled by the current comp.
  editable?: boolean;
}

export const EditableCardList: React.FC<EditableCardListProps> = ({
  cards,
  onChange,
  editable = true,
}: EditableCardListProps) => {
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) {
        return;
      }

      const newCards = Array.from(cards);
      const [reorderedItem] = newCards.splice(result.source.index, 1);
      newCards.splice(result.destination.index, 0, reorderedItem);

      // Update order property
      const updatedCards = newCards.map((card, index) => ({
        ...card,
      }));

      onChange(updatedCards);
    },
    [cards, onChange],
  );

  const handleUpdateCard = useCallback(
    (updatedCard: CardModel) => {
      const newCards = cards.map((card) => (card.id === updatedCard.id ? updatedCard : card));
      onChange(newCards);
    },
    [cards, onChange],
  );

  const handleDeleteCard = useCallback(
    (id: string) => {
      const newCards = cards.filter((card) => card.id !== id);
      onChange(newCards);
    },
    [cards, onChange],
  );

  const handleAddCardAtIndex = useCallback(
    (index: number) => {
      // Copy and insert a new empty text card
      const newCards = [...cards];
      newCards.splice(index, 0, createEmptyTextCard());

      onChange(newCards);
    },
    [cards, onChange],
  );

  const handleDropContent = useCallback(
    (droppedCards: CardModel[], index: number) => {
      const newCards = [...cards];

      // Insert all dropped cards at the specified index
      const cardsWithOrder = droppedCards.map((card, idx) => ({
        ...card,
      }));

      newCards.splice(index, 0, ...cardsWithOrder);

      // Update order property for all cards after insertion
      const updatedCards = newCards.map((card, idx) => ({
        ...card,
      }));

      onChange(updatedCards);
    },
    [cards, onChange],
  );

  return (
    <Stack gap='sm'>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId='cards'>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {editable && (
                <DroppableDivider
                  index={0}
                  alwaysHovered={cards.length === 0}
                  onClick={handleAddCardAtIndex}
                  onDrop={handleDropContent}
                />
              )}

              {cards.map((card, index) => (
                <React.Fragment key={card.id}>
                  <Box mb='sm'>
                    <CardItem
                      card={card}
                      index={index}
                      onUpdate={handleUpdateCard}
                      onDelete={handleDeleteCard}
                      parentEditable={editable}
                      EditableCardListComponent={EditableCardList}
                    />
                  </Box>

                  {editable ? (
                    <DroppableDivider
                      index={index + 1}
                      alwaysHovered={false}
                      onClick={handleAddCardAtIndex}
                      onDrop={handleDropContent}
                    />
                  ) : index + 1 !== cards.length ? (
                    <Divider my='xs' />
                  ) : null}
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
