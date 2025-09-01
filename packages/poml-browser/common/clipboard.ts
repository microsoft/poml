import { useEffect, useRef } from 'react';
import { RichContent } from 'poml';
import { binaryToDataURL, base64ToUint8 } from './utils/base64';

export const readFileContent = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));

    // Try to read as text, but handle different file types
    if (
      file.type.startsWith('text/') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.json') ||
      file.name.endsWith('.js') ||
      file.name.endsWith('.ts') ||
      file.name.endsWith('.tsx') ||
      file.name.endsWith('.jsx') ||
      file.name.endsWith('.css') ||
      file.name.endsWith('.html') ||
      file.name.endsWith('.xml') ||
      file.name.endsWith('.csv')
    ) {
      reader.readAsText(file);
    } else {
      // For other file types, show file info instead of content
      resolve(
        `File: ${file.name}\nType: ${file.type || 'Unknown'}\nSize: ${file.size} bytes\nLast Modified: ${new Date(file.lastModified).toLocaleString()}\n\n[Binary file content not displayed]`,
      );
    }
  });
};

export const getFileExtensionFromType = (mimeType: string): string => {
  const typeMap: { [key: string]: string } = {
    // Images
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/x-icon': 'ico',
    // Documents
    'text/plain': 'txt',
    'text/html': 'html',
    'application/json': 'json',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    // Archives
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    // Media
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
  };
  return typeMap[mimeType] || 'bin';
};

export interface PastedFile {
  name: string;
  type: string;
  size: number;
  lastModified: number;
  content: string | ArrayBuffer;
}

export interface PastedPayload {
  plainText: string;
  files: PastedFile[];
}

// Add paste event listener
export const handlePasteEvent = async (event: ClipboardEvent): Promise<PastedPayload> => {
  const clipboardData = event.clipboardData;
  if (!clipboardData) {
    return { plainText: '', files: [] };
  }

  const items = clipboardData.items;
  const files: PastedFile[] = [];
  let plainText = '';

  // Process all items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        let content: string | ArrayBuffer;

        // Handle images and binary files
        if (file.type.startsWith('image/')) {
          content = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
            reader.onerror = () => reject(new Error(`Failed to read image: ${file.name}`));
            reader.readAsArrayBuffer(file);
          });
        } else {
          // For text files, read as text content
          content = await readFileContent(file);
        }

        files.push({
          name: file.name || `clipboard-${Date.now()}.${getFileExtensionFromType(file.type)}`,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          content,
        });
      }
    } else if (item.type === 'text/plain' && !plainText) {
      plainText = await new Promise<string>((resolve) => {
        item.getAsString(resolve);
      });
    }
  }

  return { plainText: plainText.trim(), files };
};

export const handleDropEvent = async (event: DragEvent): Promise<PastedPayload> => {
  const files: PastedFile[] = [];
  let plainText = '';

  // Process dropped files
  if (event.dataTransfer?.files) {
    const fileList = Array.from(event.dataTransfer.files);
    for (const file of fileList) {
      let content: string | ArrayBuffer;

      // Handle images and binary files
      if (file.type.startsWith('image/')) {
        content = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
          reader.onerror = () => reject(new Error(`Failed to read image: ${file.name}`));
          reader.readAsArrayBuffer(file);
        });
      } else {
        // For text files, read as text content
        content = await readFileContent(file);
      }

      files.push({
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        content,
      });
    }
  }

  // Process text data
  const htmlData = event.dataTransfer?.getData('text/html');
  const textData = event.dataTransfer?.getData('text/plain');
  plainText = (htmlData || textData || '').trim();

  return { plainText, files };
};

export const createGlobalPasteListener = (onPaste: (content: string, files: File[]) => void) => {
  const handleKeyDown = async (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey && !e.altKey) {
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

      try {
        const clipboardItems = await navigator.clipboard.read();
        const files: File[] = [];
        let textContent = '';

        for (const item of clipboardItems) {
          // Check for files first (including images)
          for (const type of item.types) {
            if (type.startsWith('image/') || type.startsWith('application/') || type !== 'text/plain') {
              try {
                const blob = await item.getType(type);
                const file = new File([blob], `clipboard-${Date.now()}.${getFileExtensionFromType(type)}`, { type });
                files.push(file);
              } catch (error) {
                console.warn('Failed to read clipboard file:', error);
              }
            }
          }

          // Fall back to text content
          if (files.length === 0 && item.types.includes('text/plain')) {
            try {
              textContent = await navigator.clipboard.readText();
            } catch (error) {
              console.warn('Failed to read clipboard text:', error);
            }
          }
        }

        if (files.length > 0 || textContent.trim()) {
          onPaste(textContent, files);
        }
      } catch (error) {
        console.error('Paste failed:', error);
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
};

// Hook for global paste functionality
export const useGlobalPasteListener = (onPaste: (content: string, files: File[]) => void, enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

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

      try {
        console.log('Global paste event triggered');
        // Reuse the existing handlePasteEvent function
        const pastedData = await handlePasteEvent(e);

        console.log('Processed paste data:', {
          textLength: pastedData.plainText.length,
          fileCount: pastedData.files.length,
        });

        // Convert PastedFile[] to File[]
        const files: File[] = pastedData.files.map((pf) => pastedFileToFile(pf));

        if (files.length > 0 || pastedData.plainText.trim()) {
          onPaste(pastedData.plainText, files);
        } else {
          console.warn('No clipboard content to paste');
        }
      } catch (error) {
        console.error('Paste failed:', error);
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

    document.addEventListener('paste', handlePaste);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onPaste, enabled]);
};

// Hook for drag and drop functionality
export const useDragDropListener = (
  onDrop: (content: string, files: File[], insertIndex?: number) => void,
  insertIndex?: number,
) => {
  const dragOverRef = useRef(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    dragOverRef.current = true;
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only clear if we're leaving the entire component
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      dragOverRef.current = false;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragOverRef.current = false;

    const files = Array.from(e.dataTransfer.files);
    const htmlData = e.dataTransfer.getData('text/html');
    const textData = e.dataTransfer.getData('text/plain');

    const content = htmlData || textData || '';
    onDrop(content.trim(), files, insertIndex);
  };

  return {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    isDragOver: dragOverRef.current,
  };
};

// Hook for paste event handling in specific components
export const usePasteListener = (
  onPaste: (content: string, files: File[]) => void,
  elementRef: React.RefObject<HTMLElement>,
) => {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const handlePaste = async (e: ClipboardEvent) => {
      e.preventDefault();

      const clipboardData = e.clipboardData;
      if (!clipboardData) {
        return;
      }

      const items = clipboardData.items;
      const files: File[] = [];
      let textContent = '';

      // Process files first
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      // Fall back to text if no files found
      if (files.length === 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type === 'text/plain') {
            textContent = await new Promise<string>((resolve) => {
              item.getAsString(resolve);
            });
            break;
          }
        }
      }

      if (files.length > 0 || textContent.trim()) {
        onPaste(textContent, files);
      }
    };

    element.addEventListener('paste', handlePaste);

    return () => {
      element.removeEventListener('paste', handlePaste);
    };
  }, [onPaste, elementRef]);
};

// Utility to create drag listeners for different components
export const createDragListeners = (
  onDragStart?: (e: React.DragEvent) => void,
  onDragEnd?: (e: React.DragEvent) => void,
) => ({
  onDragStart,
  onDragEnd,
  draggable: true,
});

// Utility to create drop zone listeners
export const createDropZoneListeners = (
  onDrop: (content: string, files: File[], insertIndex?: number) => void,
  insertIndex?: number,
  onDragStateChange?: (isDragOver: boolean) => void,
) => {
  let isDragOver = false;

  return {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      if (!isDragOver) {
        isDragOver = true;
        onDragStateChange?.(true);
      }
    },

    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        isDragOver = false;
        onDragStateChange?.(false);
      }
    },

    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragOver = false;
      onDragStateChange?.(false);

      const files = Array.from(e.dataTransfer.files);
      const htmlData = e.dataTransfer.getData('text/html');
      const textData = e.dataTransfer.getData('text/plain');

      const content = htmlData || textData || '';
      onDrop(content.trim(), files, insertIndex);
    },
  };
};

// Utility to convert ArrayBuffer to data URL for images
export const arrayBufferToDataUrl = (buffer: ArrayBuffer, mimeType: string): string => {
  return binaryToDataURL(buffer, mimeType);
};

// Utility to create File from PastedFile
export const pastedFileToFile = (pastedFile: PastedFile): File => {
  let blob: Blob;

  if (pastedFile.content instanceof ArrayBuffer) {
    blob = new Blob([pastedFile.content], { type: pastedFile.type });
  } else {
    blob = new Blob([pastedFile.content], { type: pastedFile.type || 'text/plain' });
  }

  return new File([blob], pastedFile.name, {
    type: pastedFile.type,
    lastModified: pastedFile.lastModified,
  });
};

/**
 * Convert RichContent to string for text-only clipboard
 */
export function richContentToString(content: RichContent): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      } else if (item && item.type) {
        return `[Image: ${item.type}${(item as any).alt ? ` - ${(item as any).alt}` : ''}]`;
      }
      return '[Unknown media]';
    })
    .join('\n\n');
}

/**
 * Write RichContent to clipboard with support for both text and images
 */
export async function writeRichContentToClipboard(content: RichContent): Promise<void> {
  if (typeof content === 'string') {
    // Simple string content
    await navigator.clipboard.writeText(content);
    return;
  }

  // RichContent with mixed text and media
  const textParts: string[] = [];
  const imageBlobs: Blob[] = [];

  // Process content parts
  for (const item of content) {
    if (typeof item === 'string') {
      textParts.push(item);
    } else if (item && item.type && (item as any).base64) {
      // Handle images
      if (item.type.startsWith('image/')) {
        // Only accept PNG images
        if (item.type !== 'image/png') {
          console.warn(`Image type ${item.type} is not supported. Only PNG images are accepted.`);
          textParts.push(`[Unsupported image type: ${item.type}. Only PNG images are supported.]`);
        } else {
          try {
            const bytes = base64ToUint8(item.base64);
            // Cast to ArrayBuffer to satisfy TypeScript
            const blob = new Blob([bytes.buffer as ArrayBuffer], { type: item.type });
            imageBlobs.push(blob);

            // Also add placeholder text for the image
            textParts.push(item.alt ? `[Image: ${item.alt}]` : `[Image: ${item.type}]`);
          } catch (error) {
            console.warn('Failed to process image for clipboard:', error);
            textParts.push(item.alt ? `[Image: ${item.alt}]` : `[Image: ${item.type}]`);
          }
        }
      } else {
        // Non-image media, add as text placeholder
        textParts.push((item as any).alt ? `[Media: ${(item as any).alt}]` : `[Media: ${item.type}]`);
      }
    }
  }

  // Prepare clipboard items
  const clipboardItems: ClipboardItem[] = [];

  if (imageBlobs.length === 0) {
    // Text only - simple case
    if (textParts.length > 0) {
      const textContent = textParts.join('');
      const clipboardData: Record<string, Blob> = {
        'text/plain': new Blob([textContent], { type: 'text/plain' }),
      };
      clipboardItems.push(new ClipboardItem(clipboardData));
    }
  } else if (imageBlobs.length === 1) {
    // Single image with text - combine in one ClipboardItem
    const clipboardData: Record<string, Blob> = {};

    // Concatenate all text parts
    if (textParts.length > 0) {
      const textContent = textParts.join('');
      clipboardData['text/plain'] = new Blob([textContent], { type: 'text/plain' });
    }

    // Add the single image
    clipboardData['image/png'] = imageBlobs[0];

    clipboardItems.push(new ClipboardItem(clipboardData));
  } else {
    // Multiple images - try using multiple ClipboardItems
    // Note: Browser support for multiple ClipboardItems may vary

    // First item: All text concatenated
    if (textParts.length > 0) {
      const textContent = textParts.join('');
      const textItem = new ClipboardItem({
        'text/plain': new Blob([textContent], { type: 'text/plain' }),
      });
      clipboardItems.push(textItem);
    }

    // Additional items: Each image separately
    // Note: Most browsers may only support writing the first item
    for (const imageBlob of imageBlobs) {
      const imageItem = new ClipboardItem({
        'image/png': imageBlob,
      });
      clipboardItems.push(imageItem);
    }

    console.warn('Multiple images detected. Browser may only copy the first clipboard item.');
  }

  // Write to clipboard
  try {
    await navigator.clipboard.write(clipboardItems);
  } catch (error) {
    // If writing multiple items fails, fall back to writing just the first text and image
    if (clipboardItems.length > 1) {
      console.warn('Failed to write multiple clipboard items, falling back to single item:', error);

      // Create fallback with first text and first image only
      const fallbackData: Record<string, Blob> = {};

      // Add text if available
      if (textParts.length > 0) {
        const textContent = textParts.join('');
        fallbackData['text/plain'] = new Blob([textContent], { type: 'text/plain' });
      }

      // Add first image if available
      if (imageBlobs.length > 0) {
        fallbackData['image/png'] = imageBlobs[0];
      }

      if (Object.keys(fallbackData).length > 0) {
        const fallbackItem = new ClipboardItem(fallbackData);
        await navigator.clipboard.write([fallbackItem]);
      } else {
        throw error; // Re-throw if no fallback content available
      }
    } else {
      throw error; // Re-throw if it's not a multiple items issue
    }
  }
}
