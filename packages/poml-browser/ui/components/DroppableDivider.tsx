/**
 * DroppableDivider Component
 * A double-line divider with plus sign that transforms into a droppable area when dragging
 */

import React, { useState } from 'react';
import { Box, Paper, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { handleDropEvent } from '@common/clipboard';
import { CardModel, createCard } from '@common/cardModel';
import { useNotifications } from '../contexts/NotificationContext';

interface DroppableDividerProps {
  index: number;
  isVisible: boolean;
  nestingLevel: number;
  onAddCard: (index: number) => void;
  onDropContent: (cards: CardModel[], index: number) => void;
  onDragOverDivider?: (isOver: boolean) => void;
}

const DraggableOverlay: React.FC = () => {
  return (
    <Paper
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(34, 139, 230, 0.1)',
        border: '2px dashed #228be6',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text size='xs' c='blue' fw={500}>
        Drop to add card here
      </Text>
    </Paper>
  );
};

const StyledDivider: React.FC<{ isHovered: boolean }> = ({ isHovered }) => {
  return !isHovered ? (
    // Single line with very low opacity when inactive
    <Box
      style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        transform: 'translateY(-50%)',
        height: '1px',
        backgroundColor: '#e0e0e0',
        opacity: 0.3,
      }}
    />
  ) : (
    // Double line divider with plus sign when active
    <Box
      style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
      }}>
      {/* First line */}
      <Box
        style={{
          flex: 1,
          height: '1px',
          backgroundColor: isHovered ? '#666' : '#ddd',
          transition: 'background-color 0.2s ease',
        }}
      />

      {/* Plus sign */}
      <Box
        style={{
          margin: '0 12px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: isHovered ? '#666' : '#ddd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}>
        <IconPlus size={12} color='white' />
      </Box>

      {/* Second line */}
      <Box
        style={{
          flex: 1,
          height: '1px',
          backgroundColor: isHovered ? '#666' : '#ddd',
          transition: 'background-color 0.2s ease',
        }}
      />
    </Box>
  );
};

export const DroppableDivider: React.FC<DroppableDividerProps> = ({
  index,
  isVisible,
  nestingLevel,
  onAddCard,
  onDropContent,
  onDragOverDivider,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const { showError, showSuccess } = useNotifications();

  return (
    <Box
      data-droppable-divider='true'
      style={{
        position: 'relative',
        height: isVisible || isHovered || isDragActive ? '40px' : '12px',
        transition: 'all 0.2s ease',
        marginLeft: nestingLevel * 20,
        marginTop: '8px',
        marginBottom: '8px',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onAddCard(index)}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragActive(true);
        onDragOverDivider?.(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragActive(false);
        onDragOverDivider?.(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        onDragOverDivider?.(false);

        try {
          const dropData = await handleDropEvent(e.nativeEvent as DragEvent);
          const newCards: CardModel[] = [];

          // Create cards for dropped files
          for (const file of dropData.files) {
            const card = createCard({
              content:
                file.content instanceof ArrayBuffer
                  ? {
                      type: 'binary',
                      value: file.content,
                      mimeType: file.type,
                      encoding: 'binary',
                    }
                  : {
                      type: 'text',
                      value: file.content as string,
                    },
              title: file.name,
              metadata: {
                source: 'file',
              },
            });
            newCards.push(card);
          }

          // Create card for text content if no files
          if (dropData.files.length === 0 && dropData.plainText) {
            const card = createCard({
              content: {
                type: 'text',
                value: dropData.plainText,
              },
              metadata: {
                source: 'clipboard',
              },
            });
            newCards.push(card);
          }

          if (newCards.length > 0) {
            onDropContent(newCards, index);
            showSuccess(
              `Added ${newCards.length} card${newCards.length > 1 ? 's' : ''} from drop`,
              'Content Added',
              undefined,
              'top',
            );
          }
        } catch (error) {
          console.error('Failed to handle drop:', error);
          showError('Failed to process dropped content', 'Drop Error');
          // Fall back to regular add card
          onAddCard(index);
        }
      }}>
      {/* Single line when not active, double line with plus when active, hidden when drop area is visible */}
      {!isDragActive && !isVisible && <StyledDivider isHovered={isHovered} />}

      {/* Droppable area overlay when dragging */}
      {isDragActive && <DraggableOverlay />}
    </Box>
  );
};

export default DroppableDivider;
