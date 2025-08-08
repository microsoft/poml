import { useEffect, useRef } from 'react';

export const readFileContent = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) || '');
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
        `File: ${file.name}\nType: ${file.type || 'Unknown'}\nSize: ${file.size} bytes\nLast Modified: ${new Date(file.lastModified).toLocaleString()}\n\n[Binary file content not displayed]`
      );
    }
  });
};

export const getFileExtensionFromType = (mimeType: string): string => {
  const typeMap: { [key: string]: string } = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'text/plain': 'txt',
    'text/html': 'html',
    'application/json': 'json',
    'application/pdf': 'pdf',
    'application/zip': 'zip'
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
            reader.onload = e => resolve(e.target?.result as ArrayBuffer);
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
          content
        });
      }
    } else if (item.type === 'text/plain' && !plainText) {
      plainText = await new Promise<string>(resolve => {
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
          reader.onload = e => resolve(e.target?.result as ArrayBuffer);
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
        content
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
            if (
              type.startsWith('image/') ||
              type.startsWith('application/') ||
              type !== 'text/plain'
            ) {
              try {
                const blob = await item.getType(type);
                const file = new File(
                  [blob],
                  `clipboard-${Date.now()}.${getFileExtensionFromType(type)}`,
                  { type }
                );
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
export const useGlobalPasteListener = (
  onPaste: (content: string, files: File[]) => void,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

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
            // Check for files first
            for (const type of item.types) {
              if (type.startsWith('image/') || type.startsWith('application/')) {
                try {
                  const blob = await item.getType(type);
                  const file = new File(
                    [blob],
                    `clipboard-${Date.now()}.${getFileExtensionFromType(type)}`,
                    { type }
                  );
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
  }, [onPaste, enabled]);
};

// Hook for drag and drop functionality
export const useDragDropListener = (
  onDrop: (content: string, files: File[], insertIndex?: number) => void,
  insertIndex?: number
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
    isDragOver: dragOverRef.current
  };
};

// Hook for paste event handling in specific components
export const usePasteListener = (
  onPaste: (content: string, files: File[]) => void,
  elementRef: React.RefObject<HTMLElement>
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
            textContent = await new Promise<string>(resolve => {
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
  onDragEnd?: (e: React.DragEvent) => void
) => ({
  onDragStart,
  onDragEnd,
  draggable: true
});

// Utility to create drop zone listeners
export const createDropZoneListeners = (
  onDrop: (content: string, files: File[], insertIndex?: number) => void,
  insertIndex?: number,
  onDragStateChange?: (isDragOver: boolean) => void
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
    }
  };
};

// Utility to convert ArrayBuffer to data URL for images
export const arrayBufferToDataUrl = (buffer: ArrayBuffer, mimeType: string): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
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
    lastModified: pastedFile.lastModified
  });
};
