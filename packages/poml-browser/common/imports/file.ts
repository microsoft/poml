/**
 * Read local and fetch remote files.
 * Support text and binary files;
 * Support string file paths like file://, /absolute/path, https://... and use fetch API.
 * Support File or Blob objects from file input or drag-and-drop.
 * Support encoding options like NodeJS API: fs.readFile(..., { encoding: 'utf-8' })
 */

import { notifyDebug, notifyDebugVerbose } from '@common/notification';
import { everywhere } from '@common/rpc';
import { TextFile, BinaryFile } from '@common/types';
import { lookup } from 'mime-types';

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
