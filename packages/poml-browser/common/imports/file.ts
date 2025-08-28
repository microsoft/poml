/**
 * Read local and fetch remote files.
 * Support text and binary files;
 * Support string file paths like file://, /absolute/path, https://... and use fetch API.
 * Support File or Blob objects from file input or drag-and-drop.
 * Support encoding options like NodeJS API: fs.readFile(..., { encoding: 'utf-8' })
 */

import { everywhere } from '@common/rpc';

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

// Type helper to determine return type based on encoding
type FileContent<T extends ReadFileOptions | undefined> = T extends TextEncodingOptions
  ? string
  : T extends Base64EncodingOptions
    ? string
    : T extends BinaryEncodingOptions
      ? ArrayBuffer
      : T extends NoEncodingOptions
        ? string
        : T extends undefined
          ? string
          : never;

// Function overloads for precise type inference
export async function readFile(filePath: string | File | Blob, options: TextEncodingOptions): Promise<string>;
export async function readFile(filePath: string | File | Blob, options: Base64EncodingOptions): Promise<string>;
export async function readFile(filePath: string | File | Blob, options: BinaryEncodingOptions): Promise<ArrayBuffer>;
export async function readFile(filePath: string | File | Blob, options?: NoEncodingOptions): Promise<ArrayBuffer>;
export async function readFile(filePath: string | File | Blob): Promise<ArrayBuffer>;
export async function readFile(
  filePath: string | File | Blob,
  options?: ReadFileOptions,
): Promise<string | ArrayBuffer> {
  // Handle File or Blob objects directly
  if (filePath instanceof File || filePath instanceof Blob) {
    return decodeContent(await filePath.arrayBuffer(), options?.encoding);
  }
  return await _readFileEverywhere(filePath, options);
}

// Implementation
async function _readFile(filePath: string, options?: ReadFileOptions): Promise<string | ArrayBuffer> {
  console.log(`Reading file: ${filePath} with options:`, options);
  // Step 1: Download/retrieve the content as ArrayBuffer
  const arrayBuffer = await downloadContent(filePath);
  console.log(`Downloaded content for ${filePath}:`, arrayBuffer);

  // Step 2: Decode based on encoding option
  return decodeContent(arrayBuffer, options?.encoding);
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
