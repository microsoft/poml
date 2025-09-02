import sharp from 'sharp';

// Browser detection utility
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

interface PreprocessImageArgs {
  src?: string;
  base64?: string;
  type?: string;
  maxWidth?: number;
  maxHeight?: number;
  resize?: number;
}

interface ProcessedImage {
  base64: string;
  mimeType: string;
}

async function readImage(src?: string, base64?: string): Promise<sharp.Sharp> {
  if (src) {
    const isUrl = /^https?:\/\//i.test(src);
    if (isUrl) {
      // Fetch from URL
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`Failed to fetch image from URL: ${src} (${response.status} ${response.statusText})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return sharp(buffer);
    } else {
      // Local file path
      return sharp(src);
    }
  }
  if (base64) {
    return sharp(Buffer.from(base64, 'base64'));
  }
  throw new Error('src or base64 is required');
}

function resizeImage(
  image: sharp.Sharp,
  metadata: sharp.Metadata,
  maxWidth?: number,
  maxHeight?: number,
  resize?: number,
): sharp.Sharp {
  let width = metadata.width || 1;
  let height = metadata.height || 1;
  const resizes: number[] = [];
  if (resize) {
    resizes.push(resize);
  }
  if (maxWidth) {
    resizes.push(maxWidth / width);
  }
  if (maxHeight) {
    resizes.push(maxHeight / height);
  }
  if (resizes.length === 0) {
    return image;
  }
  const resizeFactor = Math.min(...resizes);
  return image.resize(Math.round(width * resizeFactor), Math.round(height * resizeFactor));
}

function convertType(image: sharp.Sharp, metadata: sharp.Metadata, type?: string): [sharp.Sharp, string] {
  let fileType: string = metadata.format || '';
  if (!fileType) {
    throw new Error('Cannot determine image format');
  }

  if (type) {
    fileType = type.startsWith('image/') ? type.split('/', 2)[1] : type;
    image = image.toFormat(fileType as any);
  }

  return [image, fileType];
}

// Browser-specific image loading helper
function loadImageInBrowser(src?: string, base64?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));

    if (src) {
      img.src = src;
    } else if (base64) {
      img.src = `data:image/png;base64,${base64}`;
    } else {
      reject(new Error('src or base64 is required'));
    }
  });
}

// Browser-specific image processing using Canvas
function processImageInBrowser(img: HTMLImageElement, maxWidth?: number, maxHeight?: number, resize?: number): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Cannot get canvas context');
  }

  let { width, height } = img;
  const resizes: number[] = [];

  if (resize) {
    resizes.push(resize);
  }
  if (maxWidth) {
    resizes.push(maxWidth / width);
  }
  if (maxHeight) {
    resizes.push(maxHeight / height);
  }

  if (resizes.length > 0) {
    const resizeFactor = Math.min(...resizes);
    width = Math.round(width * resizeFactor);
    height = Math.round(height * resizeFactor);
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/png').split(',')[1];
}

// Browser implementation of preprocessImage
async function preprocessImageBrowser(args: PreprocessImageArgs): Promise<ProcessedImage> {
  const { src, base64, maxWidth, maxHeight, resize } = args;

  try {
    const img = await loadImageInBrowser(src, base64);
    const processedBase64 = processImageInBrowser(img, maxWidth, maxHeight, resize);

    return {
      base64: processedBase64,
      mimeType: 'image/png',
    };
  } catch (error) {
    throw new Error(`Image preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Browser implementation of getImageWidthHeight
async function getImageWidthHeightBrowser(base64: string): Promise<{ width: number; height: number }> {
  try {
    const img = await loadImageInBrowser(undefined, base64);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  } catch (error) {
    throw new Error(`Failed to get image dimensions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function preprocessImage(args: PreprocessImageArgs): Promise<ProcessedImage> {
  if (isBrowser()) {
    return preprocessImageBrowser(args);
  }

  // Node.js implementation
  const { src, base64, type, maxWidth, maxHeight, resize } = args;
  let sharpObj = await readImage(src, base64);
  const metadata = await sharpObj.metadata();
  const resizedImage = resizeImage(sharpObj, metadata, maxWidth, maxHeight, resize);
  const [converted, fileType] = convertType(resizedImage, metadata, type);

  return {
    base64: await converted.toBuffer().then((buffer) => buffer.toString('base64')),
    mimeType: 'image/' + fileType,
  };
}

export async function getImageWidthHeight(base64: string): Promise<{ width: number; height: number }> {
  if (isBrowser()) {
    return getImageWidthHeightBrowser(base64);
  }

  // Node.js implementation
  const image = sharp(Buffer.from(base64, 'base64'));
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Cannot determine image dimensions');
  }
  return { width: metadata.width, height: metadata.height };
}
