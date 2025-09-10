/**
 * Read local and fetch remote files.
 * Support text and binary files;
 * Support string file paths like file://, /absolute/path, https://... and use fetch API.
 * Support File or Blob objects from file input or drag-and-drop.
 * Support encoding options like NodeJS API: fs.readFile(..., { encoding: 'utf-8' })
 */

import { notifyDebug, notifyDebugMoreVerbose, notifyDebugVerbose, notifyInfo } from '@common/notification';
import { everywhere } from '@common/rpc';
import {
  TextFile,
  BinaryFile,
  CardModel,
  CardFromHtmlOptions,
  CardSource,
  CreateCardOptions,
  TextCardContent,
} from '@common/types';
import { category, lookup } from '@common/utils/mime-types';
import { cardFromImage } from './image';
import { cardFromHtml } from './html';
import { pathInfo, mimeType } from '@common/utils/path';
import { createCard } from '@common/utils/card';

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
    mimeType = inferMimeType(filePath, arrayBuffer);
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
 * Options for cardFromFile function
 */
export interface CardFromFileOptions extends CreateCardOptions {
  /**
   * Encoding option for reading text files
   */
  textEncoding?: TextEncoding;

  /**
   * Options for HtmlToCards processing if the file is HTML
   * @default undefined
   */
  html?: CardFromHtmlOptions;

  /**
   * Maximum file size in bytes to process.
   * Files larger than this will be rejected.
   * @default 20MB
   */
  maxFileSize?: number;
}

/**
 * Convert a file to a CardModel with appropriate content type detection
 */
export async function cardFromFile(filePath: string | File | Blob, options?: CardFromFileOptions): Promise<CardModel> {
  const {
    html,
    maxFileSize = 20 * 1024 * 1024, // 20MB
    source = 'file',
    textEncoding = 'utf-8',
  } = options || {};

  if (textEncoding && ['base64', 'binary'].includes(textEncoding)) {
    throw new Error(
      `Do not support textEncoding=${textEncoding} for cardFromFile; only text encodings like utf-8 are supported.`,
    );
  }

  // Check file size for File/Blob objects
  if ((filePath instanceof File || filePath instanceof Blob) && filePath.size > maxFileSize) {
    throw new Error(`File too large (${filePath.size} bytes > ${maxFileSize} bytes)`);
  }

  // Get a coarse-grained mime type purely from the file path
  const coarseMimeType = mimeType(filePath);

  // Process based on MIME type
  if (coarseMimeType.startsWith('image/')) {
    return await cardFromImage(filePath, { source });
  } else if (coarseMimeType.startsWith('text/')) {
    // What I'm good at
    const content = await readFile(filePath, { encoding: textEncoding });
    if (content.size > maxFileSize) {
      throw new Error(`File too large (${content.size} bytes > ${maxFileSize} bytes)`);
    }

    if (coarseMimeType === 'text/html') {
      return await createHtmlCardFromText(filePath, content, { ...html, source: html?.source || source });
    } else {
      return await createTextCard(filePath, content, source);
    }
  } else {
    // For non-text, non-image files, try to determine if it's actually text
    const content = await readFile(filePath, { encoding: 'binary' });
    if (content.size > maxFileSize) {
      throw new Error(`File too large (${content.size} bytes > ${maxFileSize} bytes)`);
    }

    const info = pathInfo(filePath);
    if (['plain', 'code'].includes(category(content.mimeType) || '')) {
      // It's actually text
      notifyInfo(`File ${info.name} has MIME type ${content.mimeType} but appears to be text; treating as text.`);
      const decodedContent = decodeContent(content.content, textEncoding);
      return await createTextCard(filePath, { ...content, content: decodedContent as string }, source);
    } else {
      // Truly binary or unknown type
      notifyInfo(`File ${info.name} has binary or unknown MIME type (${content.mimeType}); cannot create card.`);
      throw new Error(`Cannot create card from binary or unknown file type: ${info.name} (${content.mimeType})`);
    }
  }
}

/**
 * Process a text file and return TextCardContent
 */
async function createTextCard(
  filePath: string | File | Blob,
  fileData: TextFile,
  source: CardSource,
): Promise<CardModel> {
  const metadata = pathInfo(filePath);
  notifyDebugVerbose(
    `Creating text card with name: ${metadata.name}, inferred type: ${fileData.mimeType}, url: ${metadata.url}, size: ${fileData.size}`,
  );
  const typeCategory = category(fileData.mimeType);

  const content: TextCardContent = {
    type: 'text',
    text: fileData.content,
    caption: metadata.name === 'blob' ? undefined : metadata.name,
    container: typeCategory === 'code' ? 'Code' : 'Text',
  };

  return createCard(content, {
    url: metadata.url,
    source: source,
    mimeType: fileData.mimeType,
  });
}

/**
 * Process an HTML file using cardFromHtml
 */
async function createHtmlCardFromText(
  filePath: string | File | Blob,
  fileData: TextFile,
  options: CardFromHtmlOptions,
): Promise<CardModel> {
  const metadata = pathInfo(filePath);
  notifyDebugVerbose(
    `Creating HTML card with file name: ${metadata.name}, inferred type: ${fileData.mimeType}, ` +
      `url: ${metadata.url}, size: ${fileData.size}`,
  );

  // Try to process as HTML first
  try {
    const htmlCard = await cardFromHtml(fileData.content, options);
    if (htmlCard) {
      if (!htmlCard.url) {
        htmlCard.url = metadata.url;
      }
      return htmlCard;
    }
  } catch (htmlError) {
    notifyInfo(`Failed to process as HTML, falling back to text: ${htmlError}`);
  }

  // Fallback to text processing
  return createTextCard(filePath, fileData, options.source || 'file');
}

// Implementation for remote file reading
async function _readFile(filePath: string, options?: ReadFileOptions): Promise<TextFile | BinaryFile> {
  notifyDebugVerbose(`Reading file: ${filePath} with options:`, options);
  // Step 1: Download/retrieve the content as ArrayBuffer
  const arrayBuffer = await downloadContent(filePath);
  notifyDebugVerbose(`Downloaded content for ${filePath}:`, arrayBuffer);

  // Step 2: Get metadata
  const mimeType = inferMimeType(filePath, arrayBuffer);
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
 * Infer the MIME type from file path or its content.
 * Priority:
 * 1) Respect an explicit textual type on File/Blob.
 * 2) Respect an obvious textual type from extension.
 * 3) If unknown or application/octet-stream, try to decode bytes with UTF-8
 *    If decoding yields mostly printable chars => "text/plain"
 * 4) Else return a safe binary default.
 */
export function inferMimeType(filePath: string | File | Blob, content: ArrayBuffer): string {
  let type: string | undefined;

  // 1) From File/Blob metadata
  if (filePath instanceof Blob) {
    type = filePath.type || undefined;
  } else {
    // 2) From extension (best-effort)
    const t = lookup(filePath) || undefined;
    if (t) {
      type = t;
    }
  }

  // Short-circuit if we already have a clearly-textual type
  if (type && ['plain', 'code'].includes(category(type) || '')) {
    notifyDebugMoreVerbose(`Returning explicit textual MIME type: ${type}`);
    return type;
  }

  // If unknown or generic binary, try to prove it's text by decoding
  if (!type || type === 'application/octet-stream') {
    const bytes = new Uint8Array(content);
    const sample = bytes.subarray(0, Math.min(bytes.length, 8192));

    try {
      const dec = new TextDecoder('utf-8', { fatal: true });
      dec.decode(sample);
      return 'text/plain';
    } catch {}
  }

  // 4) If we had a (non-text) type from metadata/extension, return it. Else default binary.
  if (type) {
    // optional: log that we're returning a non-text type
    notifyDebugMoreVerbose(`Returning non-text MIME type: ${type}`);
    return type;
  }

  notifyDebugVerbose(
    `Could not determine textual MIME type for: ${String(filePath)}; returning application/octet-stream.`,
  );
  return 'application/octet-stream';
}
