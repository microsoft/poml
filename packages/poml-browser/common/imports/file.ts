/**
 * Read local and fetch remote files.
 * Support text and binary files;
 * Support string file paths like file://, /absolute/path, https://... and use fetch API.
 * Support File or Blob objects from file input or drag-and-drop.
 * Support encoding options like NodeJS API: fs.readFile(..., { encoding: 'utf-8' })
 */

import { notifyDebug, notifyDebugVerbose } from '@common/notification';
import { everywhere } from '@common/rpc';
import { TextFile, BinaryFile, CardModel, TextCardContent, ImageCardContent } from '@common/types';
import { lookup } from '@common/utils/mime-types';
import { toPngBase64 } from './image';
import { htmlToCard } from './html';

type TextEncoding = 'utf-8' | 'utf8';
type Base64Encoding = 'base64';
type BinaryEncoding = 'binary';
type SupportedEncoding = TextEncoding | Base64Encoding | BinaryEncoding;

interface TextEncodingOptions {
  encoding: TextEncoding;
}

interface Base64EncodingOptions {
  encoding: Base64Encoding;
}

interface BinaryEncodingOptions {
  encoding: BinaryEncoding;
}

interface NoEncodingOptions {
  encoding?: undefined;
}

type ReadFileOptions = TextEncodingOptions | Base64EncodingOptions | BinaryEncodingOptions | NoEncodingOptions;

// Function overloads for precise type inference
export async function readFile(filePath: string | File | Blob, options: TextEncodingOptions): Promise<TextFile>;
export async function readFile(filePath: string | File | Blob, options: Base64EncodingOptions): Promise<TextFile>;
export async function readFile(filePath: string | File | Blob, options: BinaryEncodingOptions): Promise<BinaryFile>;
export async function readFile(filePath: string | File | Blob, options?: NoEncodingOptions): Promise<BinaryFile>;
export async function readFile(filePath: string | File | Blob): Promise<BinaryFile>;
export async function readFile(
  filePath: string | File | Blob,
  options?: ReadFileOptions,
): Promise<TextFile | BinaryFile> {
  // Handle File or Blob objects directly
  let arrayBuffer: ArrayBuffer;
  let mimeType: string;
  let size: number;

  if (filePath instanceof File || filePath instanceof Blob) {
    notifyDebugVerbose('Reading File/Blob object:', filePath);
    arrayBuffer = await filePath.arrayBuffer();
    mimeType = getMimeType(filePath, options);
    size = filePath.size;
    notifyDebug(`File/Blob metadata: mimeType=${mimeType}, size=${size}`);
    return {
      content: decodeContent(arrayBuffer, options?.encoding),
      mimeType,
      size,
    } as TextFile | BinaryFile;
  } else {
    return await _readFileEverywhere(filePath, options);
  }
}

// Convenience helper functions
export async function readTextFile(filePath: string | File | Blob): Promise<TextFile> {
  return readFile(filePath, { encoding: 'utf-8' });
}

export async function readBinaryFile(filePath: string | File | Blob): Promise<BinaryFile> {
  return readFile(filePath, { encoding: 'binary' });
}

/**
 * Options for fileToCard function
 */
export interface FileToCardOptions {
  /**
   * Encoding option for reading text files
   */
  encoding?: SupportedEncoding;

  /**
   * Minimum image size in pixels (width or height) to include.
   * Images smaller than this will be ignored.
   * @default 64
   */
  minimumImageSize?: number;

  /**
   * Maximum file size in bytes to process.
   * Files larger than this will be rejected.
   * @default 20MB
   */
  maxFileSize?: number;

  /**
   * Source identifier for the card
   * @default 'file'
   */
  source?: 'file' | 'drop' | 'manual' | 'clipboard' | 'generated' | 'webpage';
}

/**
 * Convert a file to a CardModel with appropriate content type detection
 */
export async function fileToCard(filePath: string | File | Blob, options?: FileToCardOptions): Promise<CardModel> {
  const {
    minimumImageSize = 64,
    maxFileSize = 20 * 1024 * 1024, // 20MB
    source = 'file',
    encoding,
  } = options || {};

  // Check file size for File/Blob objects
  if ((filePath instanceof File || filePath instanceof Blob) && filePath.size > maxFileSize) {
    throw new Error(`File too large (${filePath.size} bytes > ${maxFileSize} bytes)`);
  }

  // Determine file type using mime-types inference
  let actualMimeType: string;
  let fileName: string;

  if (filePath instanceof File) {
    const inferredMimeType = lookup(filePath.name) || filePath.type;
    actualMimeType = filePath.type || inferredMimeType;
    fileName = filePath.name;
  } else if (filePath instanceof Blob) {
    actualMimeType = filePath.type || 'application/octet-stream';
    fileName = 'blob';
  } else {
    const inferredMimeType = lookup(filePath);
    actualMimeType = inferredMimeType || 'application/octet-stream';
    fileName = filePath.split('/').pop() || filePath;
  }

  notifyDebugVerbose(`File ${fileName}: using MIME type=${actualMimeType}`);

  // Process based on MIME type
  if (actualMimeType?.startsWith('image/')) {
    return await processImageFile(filePath, fileName, actualMimeType, minimumImageSize, source);
  } else if (actualMimeType?.startsWith('text/')) {
    if (actualMimeType === 'text/html') {
      return await processHtmlFile(filePath, fileName, actualMimeType, source);
    } else {
      return await processTextFile(filePath, fileName, actualMimeType, source, encoding);
    }
  } else {
    // For non-text, non-image files, try to determine if it's actually text
    return await processBinaryOrUnknownFile(filePath, fileName, actualMimeType, source);
  }
}

/**
 * Process an image file and return ImageCardContent
 */
async function processImageFile(
  filePath: string | File | Blob,
  fileName: string,
  mimeType: string,
  minimumImageSize: number,
  source: string,
): Promise<CardModel> {
  notifyDebugVerbose(`Processing image file: ${fileName}`);

  let imageInput: string | { src: string };

  if (filePath instanceof File || filePath instanceof Blob) {
    imageInput = { src: URL.createObjectURL(filePath) };
  } else {
    imageInput = { src: filePath };
  }

  const image = await toPngBase64(imageInput);

  if (image.width < minimumImageSize && image.height < minimumImageSize) {
    throw new Error(`Image too small (${image.width}x${image.height}) below minimum size ${minimumImageSize}px`);
  }

  const content: ImageCardContent = {
    type: 'image',
    base64: image.base64,
    alt: fileName,
    caption: fileName,
  };

  return {
    content,
    source: source as any,
    mimeType,
    timestamp: new Date(),
  };
}

/**
 * Process a text file and return TextCardContent
 */
async function processTextFile(
  filePath: string | File | Blob,
  fileName: string,
  _mimeType: string,
  source: string,
  encoding?: SupportedEncoding,
): Promise<CardModel> {
  notifyDebugVerbose(`Processing text file: ${fileName}`);

  const fileData = (await readFile(filePath, { encoding: (encoding || 'utf-8') as any })) as TextFile;

  if (!fileData.content.trim()) {
    throw new Error(`Empty text file: ${fileName}`);
  }

  const content: TextCardContent = {
    type: 'text',
    text: fileData.content,
    caption: fileName,
  };

  // Determine container type based on file extension
  const extension = fileName.toLowerCase().split('.').pop();
  if (
    ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'xml', 'json', 'yaml', 'yml'].includes(extension || '')
  ) {
    content.container = 'Code';
  }

  return {
    content,
    source: source as any,
    mimeType: fileData.mimeType,
    timestamp: new Date(),
  };
}

/**
 * Process an HTML file using htmlToCard
 */
async function processHtmlFile(
  filePath: string | File | Blob,
  fileName: string,
  _mimeType: string,
  source: string,
): Promise<CardModel> {
  notifyDebugVerbose(`Processing HTML file: ${fileName}`);

  const fileData = (await readFile(filePath, { encoding: 'utf-8' })) as TextFile;

  if (!fileData.content.trim()) {
    throw new Error(`Empty HTML file: ${fileName}`);
  }

  // Try to process as HTML first
  try {
    const htmlCard = await htmlToCard(fileData.content, { parser: 'complex' });
    if (htmlCard) {
      htmlCard.source = source as any;
      htmlCard.mimeType = fileData.mimeType;
      if (!htmlCard.content.caption) {
        htmlCard.content.caption = fileName;
      }
      return htmlCard;
    }
  } catch (htmlError) {
    notifyDebug(`Failed to process as HTML, falling back to text: ${htmlError}`);
  }

  // Fallback to text processing
  const content: TextCardContent = {
    type: 'text',
    text: fileData.content,
    caption: fileName,
    container: 'Code',
  };

  return {
    content,
    source: source as any,
    mimeType: fileData.mimeType,
    timestamp: new Date(),
  };
}

/**
 * Process a file that appears to be binary or of unknown type
 */
async function processBinaryOrUnknownFile(
  filePath: string | File | Blob,
  fileName: string,
  mimeType: string,
  source: string,
): Promise<CardModel> {
  notifyDebugVerbose(`Processing binary/unknown file type: ${fileName} (${mimeType})`);

  // Try to read as text first to see if it's actually readable text
  try {
    const textData = (await readFile(filePath, { encoding: 'utf-8' })) as TextFile;

    // Check if content looks like text (contains printable characters)
    if (isProbablyText(textData.content)) {
      notifyDebug(`File ${fileName} appears to be text despite binary MIME type, treating as text`);

      const content: TextCardContent = {
        type: 'text',
        text: textData.content,
        caption: fileName,
      };

      return {
        content,
        source: source as any,
        mimeType: textData.mimeType,
        timestamp: new Date(),
      };
    }
  } catch (textError) {
    notifyDebugVerbose(`Failed to read as text: ${textError}`);
  }

  // File is truly binary - throw error
  throw new Error(`Cannot process binary file: ${fileName} (${mimeType}). Only text and image files are supported.`);
}

/**
 * Check if content is probably text (contains mostly printable characters)
 */
function isProbablyText(content: string): boolean {
  if (!content) {
    return false;
  }

  // Check for null bytes (strong indicator of binary content)
  if (content.includes('\0')) {
    return false;
  }

  // Count printable characters
  let printableCount = 0;
  for (let i = 0; i < Math.min(content.length, 1000); i++) {
    const char = content.charCodeAt(i);
    if ((char >= 32 && char <= 126) || char === 9 || char === 10 || char === 13) {
      printableCount++;
    }
  }

  const ratio = printableCount / Math.min(content.length, 1000);
  return ratio > 0.8; // If more than 80% of characters are printable, consider it text
}

// Implementation for remote file reading
async function _readFile(filePath: string, options?: ReadFileOptions): Promise<TextFile | BinaryFile> {
  notifyDebugVerbose(`Reading file: ${filePath} with options:`, options);
  // Step 1: Download/retrieve the content as ArrayBuffer
  const arrayBuffer = await downloadContent(filePath);
  notifyDebugVerbose(`Downloaded content for ${filePath}:`, arrayBuffer);

  // Step 2: Get metadata
  const mimeType = getMimeType(filePath, options);
  const size = arrayBuffer.byteLength;
  notifyDebugVerbose(`File metadata for ${filePath}: mimeType=${mimeType}, size=${size}`);

  // Step 3: Decode based on encoding option and return appropriate interface
  const content = decodeContent(arrayBuffer, options?.encoding);
  return {
    content,
    mimeType,
    size,
  } as TextFile | BinaryFile;
}

const _readFileEverywhere = everywhere('_readFile', _readFile, 'background');

/**
 * Normalize a file path to a file:// URL
 */
function normalizeToFileURL(filePath: string): string {
  // Already a file URL
  if (filePath.startsWith('file://')) {
    return filePath;
  }

  // Handle Windows absolute paths (e.g., C:\, D:\, etc.)
  if (/^[A-Za-z]:[\\\/]/.test(filePath)) {
    // Windows absolute path - normalize backslashes to forward slashes
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `file:///${normalizedPath}`;
  }

  // Convert Unix/Linux/Mac absolute path to file URL
  if (filePath.startsWith('/')) {
    return `file://${filePath}`;
  }

  // Handle home directory expansion and relative paths
  if (filePath.startsWith('~/')) {
    throw new Error(`Home directory paths (~/) is not supported. Please provide an absolute path or URL: ${filePath}`);
  } else if (filePath.includes('/') || filePath.includes('\\')) {
    // Relative paths are not supported in this context
    throw new Error(`Relative paths are not supported. Please provide absolute paths or URLs: ${filePath}`);
  } else {
    throw new Error(`Invalid file path format. Please provide absolute paths or URLs: ${filePath}`);
  }
}

/**
 * Download content from various sources and return as ArrayBuffer
 */
async function downloadContent(source: string): Promise<ArrayBuffer> {
  // Handle HTTP/HTTPS URLs
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }

  // Handle file:// URLs and local paths
  // Normalize path to file:// URL
  const fileURL = normalizeToFileURL(source);

  // Try to fetch the file URL
  // Note: This will likely fail in most browsers due to CORS restrictions
  // unless the page itself was loaded from a file:// URL
  const response = await fetch(fileURL);
  if (!response.ok) {
    throw new Error(`Failed to fetch local file: ${response.status}`);
  }
  return await response.arrayBuffer();
}

/**
 * Decode ArrayBuffer content based on encoding option
 */
function decodeContent(arrayBuffer: ArrayBuffer, encoding?: SupportedEncoding): string | ArrayBuffer {
  // No encoding or binary - return raw ArrayBuffer
  if (!encoding || encoding === 'binary') {
    return arrayBuffer;
  }

  // UTF-8 encoding
  if (encoding === 'utf-8' || encoding === 'utf8') {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(arrayBuffer);
  }

  // Base64 encoding
  if (encoding === 'base64') {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 0x8000; // Process in chunks to avoid stack overflow
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  }

  throw new Error(`Unsupported encoding: ${encoding}`);
}

/**
 * Get MIME type from file path or URL
 */
function getMimeType(filePath: string | File | Blob, options?: ReadFileOptions): string {
  if (filePath instanceof File || filePath instanceof Blob) {
    if (filePath.type) {
      return filePath.type;
    }
  } else {
    // Try to infer from file extension
    const type = lookup(filePath);
    if (type) {
      return type;
    }
  }

  notifyDebugVerbose(`Could not determine MIME type from file path: ${filePath}, using fallback.`);
  return options?.encoding === 'binary' || !options?.encoding ? 'application/octet-stream' : 'text/plain';
}
