import { everywhere } from '@common/rpc';
import { binaryToBase64 } from '@common/utils/base64';
import { Image } from '@common/types';

/**
 * Options for the toPngBase64 function
 */
export interface ToPngBase64Options {
  /**
   * MIME type of the input image (e.g., 'image/jpeg', 'image/png', 'image/gif')
   * Optional because it may already be embedded in a base64 data URL or can be inferred from the source
   */
  mimeType?: string;
}

type DownloadImageInput =
  | string // URL
  | { base64: ArrayBuffer | string } // Object with base64 data
  | { src: string }; // Object with src URL

/**
 * Downloads/processes an image from various sources and returns partial image data
 * @param input Can be a base64 string, ArrayBuffer, data URL, HTTP URL, or object with base64/src
 * @param options Optional MIME type hint
 * @returns Partial image data (may not include width/height until loaded into DOM)
 */
async function downloadImage(input: DownloadImageInput, options?: ToPngBase64Options): Promise<Partial<Image>> {
  let base64Data: string;
  let mimeType: string | undefined = options?.mimeType;
  let width: number | undefined;
  let height: number | undefined;

  if (typeof input === 'string') {
    // String input is treated as src
    const dataUrlMatch = input.match(/^data:(.*?);base64,(.*)$/);
    if (dataUrlMatch) {
      // It's a data URL - extract MIME type and base64
      mimeType = mimeType || dataUrlMatch[1];
      base64Data = dataUrlMatch[2];
    } else if (input.startsWith('http://') || input.startsWith('https://')) {
      // It's a URL - try fetch first, then fall back to canvas method for CORS issues
      try {
        const response = await fetch(input, { mode: 'cors' as RequestMode });
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        mimeType = mimeType || blob.type;

        base64Data = binaryToBase64(arrayBuffer);
      } catch (fetchError) {
        // Canvas fallback for CORS-restricted images
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new window.Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = input;
          });

          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas 2D context unavailable');
          }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
          mimeType = 'image/png'; // Canvas always outputs PNG
          width = canvas.width;
          height = canvas.height;
        } catch (canvasError) {
          throw new Error(`Failed to load image from URL: ${fetchError}. Canvas fallback also failed: ${canvasError}`);
        }
      }
    } else {
      // Assume it's already a raw base64 string
      base64Data = input;
      // mimeType must be provided for raw base64 strings
    }
  } else if (typeof input === 'object' && 'base64' in input) {
    // Handle { base64: ArrayBuffer | string } input
    if (input.base64 instanceof ArrayBuffer) {
      base64Data = binaryToBase64(input.base64);
    } else if (typeof input.base64 === 'string') {
      const dataUrlMatch = input.base64.match(/^data:(.*?);base64,(.*)$/);
      if (dataUrlMatch) {
        mimeType = mimeType || dataUrlMatch[1];
        base64Data = dataUrlMatch[2];
      } else {
        base64Data = input.base64;
        // mimeType must be provided for raw base64 strings
      }
    } else {
      throw new Error('base64 must be ArrayBuffer or string');
    }
  } else if (typeof input === 'object' && 'src' in input) {
    // Recursively handle src
    return downloadImage(input.src, options);
  } else {
    throw new Error(`Invalid input format: ${input}`);
  }

  // Validate that mimeType was determined
  if (!mimeType) {
    throw new Error('Could not determine MIME type. Please provide mimeType in options.');
  }

  return {
    base64: base64Data,
    mimeType: mimeType,
    width,
    height,
  };
}

/**
 * Converts an image to PNG format using canvas, getting dimensions in the process
 * @param partialImage Partial image data with base64 and mimeType
 * @returns Complete Image object with PNG data and dimensions
 */
async function convertToPng(partialImage: Partial<Image>): Promise<Image> {
  if (!partialImage.base64 || !partialImage.mimeType) {
    throw new Error('base64 and mimeType are required');
  }

  // If already PNG and has dimensions, return as-is
  if (partialImage.base64 && partialImage.mimeType === 'image/png' && partialImage.width && partialImage.height) {
    return partialImage as Image;
  }

  return new Promise<Image>((resolve, reject) => {
    const img = new window.Image();
    const dataUrl = `data:${partialImage.mimeType};base64,${partialImage.base64}`;

    img.onload = () => {
      try {
        // If already PNG, just return with dimensions without re-encoding
        if (partialImage.mimeType === 'image/png' && partialImage.base64) {
          resolve({
            base64: partialImage.base64 as string,
            mimeType: 'image/png',
            width: img.width,
            height: img.height,
          });
          return;
        }

        // Need to convert to PNG
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Clear canvas with transparent background for PNG
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
              const result = reader.result;
              if (typeof result === 'string') {
                const base64Result = result.replace(/^data:.*?;base64,/, '');
                resolve({
                  base64: base64Result,
                  mimeType: 'image/png',
                  width: img.width,
                  height: img.height,
                });
              } else {
                reject(new Error('Failed to read blob as base64'));
              }
            };
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsDataURL(blob);
          },
          'image/png',
          1.0,
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image with MIME type: ${partialImage.mimeType}`));
    };

    img.src = dataUrl;
  });
}

async function _toPngBase64(input: DownloadImageInput, options?: ToPngBase64Options): Promise<Image> {
  // Step 1: Download/process the image to get base64 and mimeType
  const partialImage = await downloadImage(input, options);

  // Step 2: Convert to PNG and get dimensions
  return convertToPng(partialImage);
}

export const toPngBase64 = everywhere('_toPngBase64', _toPngBase64, ['sidebar', 'content']);
