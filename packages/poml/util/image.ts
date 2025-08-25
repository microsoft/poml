import sharp from 'sharp';

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

function resizeImage(image: sharp.Sharp, metadata: sharp.Metadata, maxWidth?: number, maxHeight?: number, resize?: number): sharp.Sharp {
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

export async function preprocessImage(args: PreprocessImageArgs): Promise<ProcessedImage> {
  const { src, base64, type, maxWidth, maxHeight, resize } = args;
  let sharpObj = await readImage(src, base64);
  const metadata = await sharpObj.metadata();
  const resizedImage = resizeImage(sharpObj, metadata, maxWidth, maxHeight, resize);
  const [converted, fileType] = convertType(resizedImage, metadata, type);

  return {
    base64: await converted.toBuffer().then(buffer => buffer.toString('base64')),
    mimeType: 'image/' + fileType
  }
}

export async function getImageWidthHeight(base64: string): Promise<{ width: number; height: number }> {
  const image = sharp(Buffer.from(base64, 'base64'));
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Cannot determine image dimensions');
  }
  return { width: metadata.width, height: metadata.height };
}
