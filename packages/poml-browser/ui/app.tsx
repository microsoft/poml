import React, { useState, useEffect } from 'react';
import { MantineProvider, Stack, Button, Group, Alert } from '@mantine/core';
import { useListState } from '@mantine/hooks';
import { IconClipboard } from '@tabler/icons-react';
import EditableCardList from './components/EditableCardList';
import CardModal from './components/CardModal';
import { ExtractedContent } from '@functions/types';
import { CardModel, generateId, isTextContent } from '@functions/cardModel';
import { shadcnTheme } from './themes/zinc';
import { googleDocsManager } from '@functions/gdoc';
import { msWordManager } from '@functions/msword';
import {
  readFileContent,
  useGlobalPasteListener,
  arrayBufferToDataUrl
} from '@functions/clipboard';
import { extractPageContent } from '@functions/html';

import '@mantine/core/styles.css';
import pomlHelper from '@functions/pomlHelper';

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [topError, setTopError] = useState(''); // For edit errors
  const [bottomError, setBottomError] = useState(''); // For command errors
  const [copySuccess, setCopySuccess] = useState(false);
  const [cards, cardsHandlers] = useListState<CardModel>([]);
  const [selectedCard, setSelectedCard] = useState<ExtractedContent | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

  // Add global paste listener
  useGlobalPasteListener((textContent, files) => {
    handlePastedContent(textContent, files);
  });

  const showLoading = () => {
    setLoading(true);
    setBottomError('');
    setCopySuccess(false);
  };

  const showError = (errorMsg: string) => {
    setBottomError(errorMsg);
    setLoading(false);
  };

  // Auto-hide alerts after 5 seconds
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

  useEffect(() => {
    if (bottomError) {
      const timer = setTimeout(() => setBottomError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [bottomError]);

  useEffect(() => {
    if (topError) {
      const timer = setTimeout(() => setTopError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [topError]);

  const handleExtractContent = async () => {
    try {
      showLoading();
      let content: string;
      if (await googleDocsManager.checkGoogleDocsTab()) {
        content = await googleDocsManager.fetchGoogleDocsContent();
      } else if (await msWordManager.checkMsWordTab()) {
        content = await msWordManager.fetchMsWordContent();
      } else {
        content = await extractPageContent();
      }

      if (content.trim()) {
        // Get current tab URL
        let currentUrl = '';
        try {
          if (chrome.tabs) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            currentUrl = tab?.url || '';
          }
        } catch (e) {
          // Ignore URL extraction errors
        }

        // Extract title and create excerpt
        const lines = content.split('\n').filter(line => line.trim());
        const title = lines[0]?.substring(0, 100) || 'Extracted Content';
        const excerpt = content.substring(0, 200) + (content.length > 200 ? '...' : '');

        // Create new content card
        const newCard: CardModel = {
          id: generateId(),
          title,
          content: { type: 'text', value: content },
          metadata: {
            source: 'web',
            excerpt,
            url: currentUrl
          },
          timestamp: new Date()
        };

        // Add to card list
        cardsHandlers.append(newCard);
        setLoading(false);
      } else {
        throw new Error('No readable content found');
      }
    } catch (error) {
      showError((error as Error).message);
    }
  };

  const handleCardsChange = (newCards: CardModel[]) => {
    cardsHandlers.setState(newCards);
  };

  const handleCopyAllCards = async () => {
    try {
      if (cards.length === 0) {
        setBottomError('No cards to copy');
        return;
      }

      // Use pomlHelper to convert cards to POML format
      const pomlContent = await pomlHelper(cards);
      console.log('POML content:', pomlContent);

      // Copy to clipboard
      await navigator.clipboard.writeText(pomlContent);
      setCopySuccess(true);
      setBottomError(pomlContent);
    } catch (error) {
      showError(`Failed to copy cards: ${(error as Error).message}`);
    }
  };

  const handleCardClick = (card: CardModel) => {
    // Convert CardModel back to ExtractedContent for modal compatibility
    const extractedContent: ExtractedContent = {
      id: card.id,
      title: card.title || '',
      content: isTextContent(card.content) ? card.content.value : '',
      excerpt: card.metadata?.excerpt || '',
      url: card.metadata?.url,
      timestamp: card.timestamp || new Date(),
      isManual: card.metadata?.source === 'manual',
      debug: card.metadata?.debug
    };
    
    setSelectedCard(extractedContent);
    setModalOpened(true);
  };

  const handleSaveCard = (id: string, newContent: string) => {
    const index = cards.findIndex(card => card.id === id);
    if (index !== -1) {
      const updatedCard: CardModel = {
        ...cards[index],
        content: { type: 'text', value: newContent }
      };
      cardsHandlers.setItem(index, updatedCard);
    }
  };

  const handleDeleteCard = (id: string) => {
    const index = cards.findIndex(card => card.id === id);
    if (index !== -1) {
      cardsHandlers.remove(index);
    }
  };

  const handlePastedContent = async (textContent: string, files: File[]) => {
    try {
      if (!textContent && (!files || files.length === 0)) {
        return;
      }

      const createCard = (title: string, content: string, metadata: any = {}): CardModel => ({
        id: generateId(),
        title,
        content: { type: 'text', value: content },
        metadata: {
          source: 'clipboard',
          excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          ...metadata
        },
        timestamp: new Date()
      });

      // Handle text content
      if (textContent) {
        const lines = textContent.split('\n').filter(line => line.trim());
        const title = lines[0]?.substring(0, 100) || 'Pasted Content';
        cardsHandlers.append(createCard(title, textContent));
      }

      // Handle files
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            if (file.type.startsWith('image/')) {
              const dataUrl = await arrayBufferToDataUrl(await file.arrayBuffer(), file.type);
              const card: CardModel = {
                id: generateId(),
                title: file.name,
                content: { 
                  type: 'binary', 
                  value: dataUrl.split(',')[1], // Remove data:image/...;base64, prefix
                  mimeType: file.type,
                  encoding: 'base64'
                },
                componentType: 'Image',
                metadata: {
                  source: 'clipboard'
                },
                timestamp: new Date()
              };
              cardsHandlers.append(card);
            } else {
              const content = await readFileContent(file);
              const title = file.name || 'Pasted File';
              cardsHandlers.append(createCard(title, content, { fileName: file.name }));
            }
          } catch (error) {
            console.error('Failed to process file:', error);
            setTopError(`Failed to process file: ${file.name}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to handle pasted content:', error);
      setTopError('Failed to process pasted content');
    }
  };

  const handleDropFile = async (file: File, insertIndex?: number) => {
    try {
      const content = await readFileContent(file);
      const title = file.name || 'Dropped File';
      const newCard: CardModel = {
        id: generateId(),
        title,
        content: { type: 'text', value: content },
        metadata: {
          source: 'file',
          fileName: file.name,
          excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : '')
        },
        timestamp: new Date()
      };

      if (insertIndex !== undefined) {
        cardsHandlers.insert(insertIndex, newCard);
      } else {
        cardsHandlers.append(newCard);
      }
    } catch (error) {
      console.error('Failed to handle dropped file:', error);
      setTopError(`Failed to process dropped file: ${file.name}`);
    }
  };

  return (
    <MantineProvider theme={shadcnTheme} defaultColorScheme="light">
      <Stack
        style={{
          width: '100%',
          minWidth: '600px',
          height: '100vh',
          padding: '16px',
          overflow: 'auto'
        }}
      >
        {/* Top error alert */}
        {topError && (
          <Alert
            variant="light"
            color="red"
            title="Error"
            withCloseButton
            onClose={() => setTopError('')}
          >
            {topError}
          </Alert>
        )}

        <EditableCardList
          cards={cards}
          onChange={handleCardsChange}
          onCardClick={handleCardClick}
          editable={true}
          nestingLevel={0}
          maxNestingLevel={3}
        />

        <Group>
          <Button
            fullWidth
            variant="outline"
            color="primary"
            loading={loading}
            onClick={handleExtractContent}
          >
            Extract Page Content
          </Button>
          <Button
            fullWidth
            variant="filled"
            color="primary"
            leftSection={<IconClipboard size={16} />}
            disabled={cards.length === 0}
            onClick={handleCopyAllCards}
          >
            Copy All Cards ({cards.length})
          </Button>
        </Group>

        {/* Bottom alerts */}
        {copySuccess && (
          <Alert variant="light" color="green" title="Success">
            All cards copied to clipboard!
          </Alert>
        )}

        {bottomError && (
          <Alert
            variant="light"
            color="red"
            title="Error"
            withCloseButton
            onClose={() => setBottomError('')}
          >
            {bottomError}
          </Alert>
        )}
      </Stack>

      {/* Card Modal */}
      <CardModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        content={selectedCard}
        onSave={handleSaveCard}
      />
    </MantineProvider>
  );
};

export default App;