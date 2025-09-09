import { notifyError, notifyWarning } from '@common/notification';
import { base64ToUint8 } from '@common/utils/base64';
import { RichContent } from 'poml/base';

/**
 * Write RichContent to clipboard with support for both text and images
 */
export async function writeRichContentToClipboard(content: RichContent): Promise<boolean> {
  if (typeof content === 'string') {
    // Simple string content
    await navigator.clipboard.writeText(content);
    return true;
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

    notifyWarning('Multiple images detected. Browser may only copy the first clipboard item.');
  }

  // Write to clipboard
  try {
    await navigator.clipboard.write(clipboardItems);
    return true;
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
        return true;
      } else {
        notifyError(`Failed to write clipboard items, no content available to copy: ${String(error)}`);
      }
    } else {
      notifyError(`Failed to write clipboard items, no content available to copy: ${String(error)}`);
    }
  }
  return false;
}
