import '@mantine/core/styles.css';
import React, { useState, useEffect } from 'react';
import { MantineProvider, Stack, Button, Group, ActionIcon, Title, useMantineTheme, px } from '@mantine/core';
import { useListState, UseListStateHandlers } from '@mantine/hooks';
import { IconClipboard, IconSettings, IconHistory, IconBell } from '@tabler/icons-react';
import EditableCardList from './components/card-list';
import Settings from './components/settings';
import { CardModel } from '@common/types';
import { shadcnCssVariableResolver } from './themes/cssVariableResolver';
import { shadcnTheme } from './themes/zinc';
import { NotificationProvider } from './contexts/notification-context';
import { ThemeProvider } from './contexts/theme-context';
import TopNotifications from './components/notifications-top';
import BottomNotifications from './components/notifications-bottom';

import './themes/style.css';
import { notifyError, notifySuccess } from '@common/notification';
import { processDropEvent } from '@common/events/drop';
import { processPasteEvent } from '@common/events/paste';
import { processTabEvent } from '@common/events/tab';
import { renderCardsByPoml } from '@common/poml-helper';
import { writeRichContentToClipboard } from '@common/events/copy';

function useGlobalEventListeners(
  cardsHandlers: UseListStateHandlers<CardModel>,
  isDraggingOverDivider: boolean,
  setIsDraggingOver: (isDraggingOver: boolean) => void,
  setIsDraggingOverDivider: (isDraggingOverDivider: boolean) => void,
) {
  // The paste handler for a global paste event
  const handlePaste = async (e: ClipboardEvent) => {
    // Only trigger if not focused on an input/textarea
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true')
    ) {
      return; // Let browser handle normal paste
    }

    e.preventDefault();

    const newCards = await processPasteEvent(e);
    if (newCards && newCards.length > 0) {
      cardsHandlers.append(...newCards);
      notifySuccess(`Added ${newCards.length} card${newCards.length > 1 ? 's' : ''} from paste`);
    }
  };

  // Add a keydown listener to ensure the document can receive paste events
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey && !e.altKey) {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).contentEditable === 'true')
      ) {
        return;
      }

      // Make sure document.body has focus to receive paste events
      if (document.activeElement !== document.body) {
        document.body.focus();
      }
    }
  };

  // Add document-level drag and drop handlers
  const handleDocumentDragOver = (e: DragEvent) => {
    // Prevent default to allow drop
    e.preventDefault();
    // Only show the document drop indicator if not over a divider
    if (!isDraggingOverDivider) {
      setIsDraggingOver(true);
    }
  };

  const handleDocumentDragLeave = (e: DragEvent) => {
    // Check if we're actually leaving the document
    if (e.clientX === 0 && e.clientY === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDocumentDrop = async (e: DragEvent) => {
    // Always reset the drag state on drop
    setIsDraggingOver(false);
    setIsDraggingOverDivider(false);

    // Only handle drops if not over a divider (dividers handle their own drops)
    if (!isDraggingOverDivider) {
      e.preventDefault();
      e.stopPropagation();
      const newCards = await processDropEvent(e);
      if (newCards && newCards.length > 0) {
        // Add all new cards at the end
        cardsHandlers.append(...newCards);
        notifySuccess(`Added ${newCards.length} card${newCards.length > 1 ? 's' : ''} from drop`);
      }
    }
  };

  // Add event listeners to document
  document.addEventListener('dragover', handleDocumentDragOver);
  document.addEventListener('dragleave', handleDocumentDragLeave);
  document.addEventListener('drop', handleDocumentDrop);
  document.addEventListener('paste', handlePaste);
  document.addEventListener('keydown', handleKeyDown);

  // Cleanup
  return () => {
    document.removeEventListener('dragover', handleDocumentDragOver);
    document.removeEventListener('dragleave', handleDocumentDragLeave);
    document.removeEventListener('drop', handleDocumentDrop);
    document.removeEventListener('paste', handlePaste);
    document.removeEventListener('keydown', handleKeyDown);
  };
}

// Inner component that uses the notification system
const AppContent: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [cards, cardsHandlers] = useListState<CardModel>([]);
  // Is dragging over the document
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // Is dragging over an inner divider, should escalate the event to the divider
  const [isDraggingOverDivider, setIsDraggingOverDivider] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    useGlobalEventListeners(cardsHandlers, isDraggingOverDivider, setIsDraggingOver, setIsDraggingOverDivider);
  }, [cards, isDraggingOverDivider]);

  const showLoading = () => {
    setLoading(true);
  };

  const hideLoading = () => {
    setLoading(false);
  };

  const handleExtractTab = async () => {
    showLoading();
    const newCards = await processTabEvent();
    if (newCards && newCards.length > 0) {
      cardsHandlers.append(...newCards);
      notifySuccess(`Extracted ${newCards.length} card${newCards.length > 1 ? 's' : ''} from active tab`);
      hideLoading();
    }
  };

  const handleCardsChange = (newCards: CardModel[]) => {
    cardsHandlers.setState(newCards);
  };

  const handleCopyAllCards = async () => {
    if (cards.length === 0) {
      notifyError('No active cards to copy');
      return;
    }

    // Use pomlHelper to convert cards to POML format
    const pomlContent = await renderCardsByPoml(cards);

    if (pomlContent) {
      const success = await writeRichContentToClipboard(pomlContent);
      if (success) {
        notifySuccess(`Copied ${cards.length} cards to clipboard`);
      }
      // Error has already been notified
    }
  };

  // Show settings page if requested
  if (showSettings) {
    return <Settings onBack={() => setShowSettings(false)} />;
  }

  const theme = useMantineTheme();
  return (
    <Stack
      p='md'
      style={{
        width: '100%',
        minWidth: 350,
        height: '100vh',
        overflow: 'auto',
        position: 'relative',
      }}>
      {/* Drag overlay */}
      {isDraggingOver && (
        <div
          style={{
            position: 'absolute',
            top: theme.spacing.md,
            left: theme.spacing.md,
            right: theme.spacing.md,
            bottom: theme.spacing.md,
            backgroundColor: `${theme.colors.purple[5]}15`,
            border: `3px dashed ${theme.colors.purple[6]}`,
            borderRadius: theme.radius.md,
            zIndex: 1000,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: theme.fontSizes.lg,
            color: theme.colors.purple[8],
            fontWeight: 600,
          }}>
          Drop Files to Add them as Cards
        </div>
      )}

      {/* Header with title and action buttons */}
      <Group justify='space-between' mb='md'>
        <Title order={4}>Prompt Orchestration Scratchpad</Title>
        <Group gap='xs'>
          <ActionIcon variant='subtle' onClick={() => console.log('Open history')} aria-label='History'>
            <IconHistory size={px(theme.fontSizes.lg)} />
          </ActionIcon>
          <ActionIcon variant='subtle' onClick={() => console.log('Open notifications')} aria-label='Notifications'>
            <IconBell size={px(theme.fontSizes.lg)} />
          </ActionIcon>
          <ActionIcon variant='subtle' onClick={() => setShowSettings(true)} aria-label='Settings'>
            <IconSettings size={px(theme.fontSizes.lg)} />
          </ActionIcon>
        </Group>
      </Group>

      <EditableCardList
        cards={cards}
        onChange={handleCardsChange}
        editable={true}
        onDragOverDivider={(isOver: boolean) => {
          setIsDraggingOverDivider(isOver);
          if (isOver) {
            setIsDraggingOver(false);
          }
        }}
      />

      <Group>
        <Button fullWidth variant='outline' fz='md' loading={loading} onClick={handleExtractTab}>
          Extract Page Content
        </Button>
        <Button
          fullWidth
          variant='filled'
          fz='md'
          leftSection={<IconClipboard />}
          disabled={cards.length === 0}
          onClick={handleCopyAllCards}>
          Export to Clipboard
        </Button>
      </Group>

      {/* Bottom notifications appended to content */}
      <BottomNotifications />
    </Stack>
  );
};

// Main App component with providers
const App: React.FC = () => {
  useEffect(() => {
    (window as any).__pomlUIReady = true; // Indicate that the UI has loaded
  }, []);

  return (
    <MantineProvider theme={shadcnTheme} cssVariablesResolver={shadcnCssVariableResolver} defaultColorScheme='auto'>
      <ThemeProvider>
        <NotificationProvider>
          <AppContent />
          {/* Top notifications overlay */}
          <TopNotifications />
        </NotificationProvider>
      </ThemeProvider>
    </MantineProvider>
  );
};

export default App;
