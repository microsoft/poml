/**
 * DroppableDivider Component
 * A double-line divider with plus sign that transforms into a droppable area when dragging
 */

import React, { useState } from 'react';
import { Box, Paper, Text, useMantineTheme, useMantineColorScheme } from '@mantine/core';
import { px } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { processDropEvent } from '@common/events/drop';
import { CardModel } from '@common/types';
import { notifySuccess } from '@common/notification';
import { computedThemeVariables } from '../themes/helper';

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
        Drop to Add Contents
      </Text>
    </Paper>
  );
};

const StyledDivider: React.FC<{ isHovered: boolean }> = ({ isHovered }) => {
  const { colors } = computedThemeVariables();
  const theme = useMantineTheme();

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
        backgroundColor: colors.border.inactive,
        opacity: colors.border.opacity,
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
          backgroundColor: colors.border.active,
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
          backgroundColor: colors.border.active,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}>
        <IconPlus size={px(theme.fontSizes.lg)} color={theme.primaryColor} stroke={3} />
      </Box>

      {/* Second line */}
      <Box
        style={{
          flex: 1,
          height: `${borderWidth}px`,
          backgroundColor: colors.border.active,
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

        const cards = await processDropEvent(e.nativeEvent);
        if (cards && cards.length > 0) {
          onDrop(cards, index);
          notifySuccess(`Added ${cards.length} card${cards.length > 1 ? 's' : ''} from drop`, 'Content Added');
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
