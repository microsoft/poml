import '@mantine/core/styles.css';
import React, { useState, useEffect, use } from 'react';
import { MantineProvider, Stack, Button, Group, ActionIcon, Title, useMantineTheme, px } from '@mantine/core';
import { useListState } from '@mantine/hooks';
import { IconClipboard, IconSettings, IconHistory, IconBell } from '@tabler/icons-react';
import EditableCardList from './components/EditableCardList';
import CardModal from './components/CardModal';
import Settings from './components/Settings';
import { CardModel, createCard } from '@common/cardModel';
import { shadcnCssVariableResolver } from './themes/cssVariableResolver';
import { shadcnTheme } from './themes/zinc';
import { googleDocsManager } from '@common/gdoc';
import {
  readFileContent,
  useGlobalPasteListener,
  arrayBufferToDataUrl,
  writeRichContentToClipboard,
  handleDropEvent,
} from '@common/clipboard';
import { contentManager } from '@common/html';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import TopNotifications from './components/TopNotifications';
import BottomNotifications from './components/BottomNotifications';
import pomlHelper from '@common/pomlHelper';

import { readFile } from '../common/imports/file';

import './themes/style.css';

// Inner component that uses the notification system
const AppContent: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [cards, cardsHandlers] = useListState<CardModel>([]);
  const [selectedCard, setSelectedCard] = useState<CardModel | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverDivider, setIsDraggingOverDivider] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Use the notification system
  const { showError, showSuccess, showWarning } = useNotifications();

  // Add global paste listener
  useGlobalPasteListener((textContent, files) => {
    handlePastedContent(textContent, files);
  });

  // Add document-level drag and drop handlers
  useEffect(() => {
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

        try {
          const dropData = await handleDropEvent(e);
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
            // Add all new cards at the end
            cardsHandlers.append(...newCards);
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
        }
      }
    };

    // Add event listeners to document
    document.addEventListener('dragover', handleDocumentDragOver);
    document.addEventListener('dragleave', handleDocumentDragLeave);
    document.addEventListener('drop', handleDocumentDrop);

    // Cleanup
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver);
      document.removeEventListener('dragleave', handleDocumentDragLeave);
      document.removeEventListener('drop', handleDocumentDrop);
    };
  }, [cards, cardsHandlers, showError, showSuccess, isDraggingOverDivider]);

  const showLoading = () => {
    setLoading(true);
  };

  const hideLoading = () => {
    setLoading(false);
  };

  const handleExtractContent = async () => {
    try {
      showLoading();
      let extractedCards: CardModel[];
      if (await googleDocsManager.checkGoogleDocsTab()) {
        extractedCards = await googleDocsManager.fetchGoogleDocsContent();
      } else {
        extractedCards = await contentManager.fetchContent();
      }

      if (extractedCards && extractedCards.length > 0) {
        // Add the extracted cards to the cards state
        extractedCards.forEach((card) => {
          cardsHandlers.append(card);
        });

        hideLoading();
        showSuccess(`Extracted ${extractedCards.length} content cards successfully`);
      } else {
        throw new Error('No readable content found');
      }
    } catch (error) {
      hideLoading();
      showError((error as Error).message, 'Extract Content Failed');
    }
  };

  const handleCardsChange = (newCards: CardModel[]) => {
    cardsHandlers.setState(newCards);
  };

  const handleCopyAllCards = async () => {
    try {
      if (cards.length === 0) {
        showWarning('No cards to copy');
        return;
      }

      // Use pomlHelper to convert cards to POML format
      const pomlContent = await pomlHelper(cards);
      console.log('POML content:', pomlContent);

      if (!pomlContent) {
        showError('Failed to generate POML content', 'Copy Failed');
        return;
      }

      // Copy to clipboard with support for images and text
      await writeRichContentToClipboard(pomlContent);
      showSuccess(`Copied ${cards.length} cards to clipboard`, 'POML Content Copied', undefined, 'bottom');
    } catch (error) {
      showError(`Failed to copy cards: ${(error as Error).message}`, 'Copy Failed');
    }
  };

  const handleCardClick = (card: CardModel) => {
    setSelectedCard(card);
    setModalOpened(true);
  };

  const handleSaveCard = (id: string, newContent: string) => {
    const index = cards.findIndex((card) => card.id === id);
    if (index !== -1) {
      const updatedCard: CardModel = {
        ...cards[index],
        content: { type: 'text', value: newContent },
      };
      cardsHandlers.setItem(index, updatedCard);
    }
  };

  const handlePastedContent = async (textContent: string, files: File[]) => {
    try {
      if (!textContent && (!files || files.length === 0)) {
        return;
      }

      const createCardHelper = (title: string, content: string, metadata: any = {}): CardModel =>
        createCard({
          title,
          content: { type: 'text', value: content },
          metadata: {
            source: 'clipboard',
            excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            ...metadata,
          },
        });

      // Handle text content
      if (textContent) {
        const lines = textContent.split('\n').filter((line) => line.trim());
        const title = lines[0]?.substring(0, 100) || 'Pasted Content';
        cardsHandlers.append(createCardHelper(title, textContent));
      }

      // Handle files
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            if (file.type.startsWith('image/')) {
              const dataUrl = await arrayBufferToDataUrl(await file.arrayBuffer(), file.type);
              const card = createCard({
                title: file.name,
                content: {
                  type: 'binary',
                  value: dataUrl.split(',')[1], // Remove data:image/...;base64, prefix
                  mimeType: file.type,
                  encoding: 'base64',
                },
                metadata: {
                  source: 'clipboard',
                },
              });
              cardsHandlers.append(card);
            } else {
              const content = await readFileContent(file);
              const title = file.name || 'Pasted File';
              cardsHandlers.append(createCardHelper(title, content, { fileName: file.name }));
            }
          } catch (error) {
            console.error('Failed to process file:', error);
            showError(`Failed to process file: ${file.name}`, 'File Processing Error');
          }
        }
      }
    } catch (error) {
      console.error('Failed to handle pasted content:', error);
      showError('Failed to process pasted content', 'Paste Error');
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
          Drop files here to add them as cards
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
        onCardClick={handleCardClick}
        editable={true}
        onDragOverDivider={(isOver: boolean) => {
          setIsDraggingOverDivider(isOver);
          if (isOver) {
            setIsDraggingOver(false);
          }
        }}
      />

      <Group>
        <Button fullWidth variant='outline' fz='md' loading={loading} onClick={handleExtractContent}>
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

      {/* Card Modal */}
      <CardModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        content={selectedCard}
        onSave={handleSaveCard}
      />

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
