import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UseListStateHandlers } from '@mantine/hooks';
import { CardModel } from '@common/types';
import { processDropEvent } from '@common/events/drop';
import { processPasteEvent } from '@common/events/paste';
import { notifySuccess } from '@common/notification';

/**
 * Context for coordinating drag state between DroppableDivider components and document-level handlers.
 *
 * **Purpose**: Prevents conflicts between divider drop zones and document-level drop handling.
 * When a divider is being dragged over, document handlers should ignore the drag event.
 */
interface DragContextValue {
  /** Whether any divider is currently being dragged over */
  isDraggingOverDivider: boolean;
  /** Whether document-level drag is active */
  isDraggingOver: boolean;
  /** Callback to pass to EditableCardList's onDragOverDivider prop */
  onDragOverDivider: (isOver: boolean) => void;
}

const DragContext = createContext<DragContextValue | undefined>(undefined);

interface DragProviderProps {
  children: ReactNode;
  /** Card handlers for adding cards from drop/paste events */
  cardsHandlers: UseListStateHandlers<CardModel>;
}

/**
 * Provides centralized drag state management and document-level event handling.
 *
 * Manages both divider-specific drag state and document-level drag/drop/paste events.
 * Only DroppableDivider components should interact with the onDragOverDivider callback.
 */
export const DragPasteProvider: React.FC<DragProviderProps> = ({ children, cardsHandlers }) => {
  const [isDraggingOverDivider, setIsDraggingOverDivider] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleDragOverDivider = (isOver: boolean) => {
    setIsDraggingOverDivider(isOver);
    if (isOver) {
      setIsDraggingOver(false);
    }
  };

  useEffect(() => {
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
  }, [isDraggingOverDivider, cardsHandlers]);

  const value: DragContextValue = {
    isDraggingOverDivider,
    isDraggingOver,
    onDragOverDivider: handleDragOverDivider,
  };

  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
};

/**
 * Access drag/paste context state. Only use in components that need to coordinate with drag behavior.
 * @throws {Error} If used outside of DragProvider
 */
export const useDragPasteContext = (): DragContextValue => {
  const context = useContext(DragPasteContext);
  if (!context) {
    throw new Error('useDragPasteContext must be used within a DragPasteProvider');
  }
  return context;
};
