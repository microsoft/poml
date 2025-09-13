import '@mantine/core/styles.css';
import React, { useState, useEffect } from 'react';
import { MantineProvider, Stack, Button, Group, ActionIcon, Title, useMantineTheme, px } from '@mantine/core';
import { useListState } from '@mantine/hooks';
import { IconClipboard, IconSettings, IconHistory, IconBell } from '@tabler/icons-react';
import EditableCardList from './components/card-list';
import Settings from './components/settings';
import { CardModel } from '@common/types';
import { shadcnCssVariableResolver } from './themes/cssVariableResolver';
import { shadcnTheme } from './themes/zinc';
import { NotificationProvider } from './contexts/notification-context';
import { ThemeProvider } from './contexts/theme-context';
import { DragPasteProvider, useDragPasteContext } from './contexts/drag-context';
import TopNotifications from './components/notifications-top';
import BottomNotifications from './components/notifications-bottom';

import './themes/style.css';
import { notifyError, notifySuccess } from '@common/notification';
import { processTabEvent } from '@common/events/tab';
import { renderCardsByPoml } from '@common/poml-helper';
import { writeRichContentToClipboard } from '@common/events/copy';

// Drag overlay component
const DragOverlay: React.FC = () => {
  const { isDraggingOver } = useDragPasteContext();
  const theme = useMantineTheme();

  if (!isDraggingOver) {
    return null;
  }

  return (
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
  );
};

// Inner component that uses the notification system
const AppContent: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [cards, cardsHandlers] = useListState<CardModel>([]);
  const [showSettings, setShowSettings] = useState(false);

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
    }
    hideLoading();
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
    <DragPasteProvider cardsHandlers={cardsHandlers}>
      <Stack
        p='md'
        style={{
          width: '100%',
          minWidth: 350,
          height: '100vh',
          overflow: 'auto',
          position: 'relative',
        }}>
        <DragOverlay />

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

        <EditableCardList cards={cards} onChange={handleCardsChange} editable={true} />

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
    </DragPasteProvider>
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
