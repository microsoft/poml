import { everywhere } from '@common/rpc';
import { arrayBufferToDataURL } from '@common/utils/base64';

function _toPngBase64(base64: ArrayBuffer | string, mimeType: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    try {
      let dataUrl: string;
      if (base64 instanceof ArrayBuffer) {
        // Convert ArrayBuffer to base64 string if needed
        dataUrl = arrayBufferToDataURL(base64, mimeType);
      } else if (typeof base64 === 'string') {
        if (base64.match(/^data:.*?;base64,/)) {
          // It's already a data URL
          dataUrl = base64;
        } else {
          // Assume it's a raw base64 string
          dataUrl = `data:${mimeType};base64,${base64}`;
        }
      } else {
        throw new Error('Input must be ArrayBuffer or base64 string');
      }

      if (mimeType === 'image/png') {
        // Already PNG, just strip data URL prefix if present
        const base64Data = dataUrl.replace(/^data:.*?;base64,/, '');
        resolve(base64Data);
        return;
      }

      // Create image element
      const img = new Image();

      img.onload = () => {
        try {
          // Create canvas with image dimensions
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // For PNG output, we might want to preserve transparency
          // Clear canvas with transparent background
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw image onto canvas
          ctx.drawImage(img, 0, 0);

          // Convert canvas to PNG base64
          canvas.toBlob(
            (blob: Blob | null) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }

              const reader = new FileReader();
              reader.onloadend = () => {
                // Return just the base64 string without data URL prefix
                const result = reader.result;
                if (typeof result === 'string') {
                  const base64Result = result.replace(/^data:.*?;base64,/, '');
                  resolve(base64Result);
                } else {
                  reject(new Error('Failed to read blob as base64'));
                }
              };
              reader.onerror = () => reject(new Error('Failed to read blob'));
              reader.readAsDataURL(blob);
            },
            'image/png',
            1.0,
          ); // Maximum quality for PNG
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image with MIME type: ${mimeType}`));
      };

      // Start loading the image
      img.src = dataUrl;
    } catch (error) {
      reject(error);
    }
  });
}

export const toPngBase64 = everywhere('_toPngBase64', _toPngBase64, ['sidebar', 'content']);
