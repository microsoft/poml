/**
 * DroppableDivider Component
 * A double-line divider with plus sign that transforms into a droppable area when dragging
 */

import React, { useState } from 'react';
import { Box, Paper, Text, useMantineTheme, useMantineColorScheme } from '@mantine/core';
import { px } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { handleDropEvent } from '@common/clipboard';
import { CardModel, createCard } from '@common/cardModel';
import { useNotifications } from '../contexts/NotificationContext';

interface DroppableDividerProps {
  index: number;
  alwaysHovered: boolean;
  onClick: (index: number) => void;
  onDrop: (cards: CardModel[], index: number) => void;
  onDragOver?: (isOver: boolean) => void;
}

const DraggableOverlay: React.FC = () => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const borderWidth = 2; // in pixels for the dashed border
  const borderColor = isDark ? theme.colors.blue[4] : theme.colors.blue[6];

  return (
    <Paper
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isDark
          ? `${theme.colors.blue[8]}20` // Darker blue with more opacity for dark mode
          : `${theme.colors.blue[5]}15`, // Lighter blue with less opacity for light mode
        border: `${borderWidth}px dashed ${borderColor}`,
        borderRadius: theme.radius.sm,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text size='md' lh='lg' c='blue' fw={500}>
        Drop to add card here
      </Text>
    </Paper>
  );
};

const StyledDivider: React.FC<{ isHovered: boolean }> = ({ isHovered }) => {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Adaptive colors for light and dark mode
  const inactiveColor = isDark ? theme.colors.gray[7] : theme.colors.gray[3];
  const hoveredColor = isDark ? theme.colors.gray[3] : theme.colors.gray[6];
  const plusIconColor = isDark ? theme.colors.dark[9] : theme.white;

  // Border width for consistency
  const borderWidth = 1; // in pixels

  return !isHovered ? (
    // Single line with very low opacity when inactive
    <Box
      style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        transform: 'translateY(-50%)',
        height: `${borderWidth}px`,
        backgroundColor: inactiveColor,
        opacity: isDark ? 0.6 : 0.3,
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
          height: `${borderWidth}px`,
          backgroundColor: hoveredColor,
          transition: 'background-color 0.2s ease',
        }}
      />

      {/* Plus sign */}
      <Box
        style={{
          margin: `0 ${theme.spacing.sm}`,
          width: theme.lineHeights.lg,
          height: theme.lineHeights.lg,
          borderRadius: '50%',
          backgroundColor: hoveredColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}>
        <IconPlus size={px(theme.fontSizes.lg)} color={plusIconColor} stroke={3} />
      </Box>

      {/* Second line */}
      <Box
        style={{
          flex: 1,
          height: `${borderWidth}px`,
          backgroundColor: hoveredColor,
          transition: 'background-color 0.2s ease',
        }}
      />
    </Box>
  );
};

export const DroppableDivider: React.FC<DroppableDividerProps> = ({
  index,
  alwaysHovered,
  onClick,
  onDrop,
  onDragOver,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const { showError, showSuccess } = useNotifications();
  const theme = useMantineTheme();

  return (
    <Box
      data-droppable-divider='true'
      style={{
        position: 'relative',
        height: alwaysHovered || isHovered || isDragActive ? theme.lineHeights.md : theme.spacing.sm,
        transition: 'all 0.2s ease',
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
        cursor: 'pointer',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(index)}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragActive(true);
        onDragOver?.(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragActive(false);
        onDragOver?.(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        onDragOver?.(false);

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
            onDrop(newCards, index);
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
          onClick(index);
        }
      }}>
      {/* Single line when not active, double line with plus when active, hidden when drop area is visible */}
      {!isDragActive && <StyledDivider isHovered={isHovered || alwaysHovered} />}

      {/* Droppable area overlay when dragging */}
      {isDragActive && <DraggableOverlay />}
    </Box>
  );
};

export default DroppableDivider;
