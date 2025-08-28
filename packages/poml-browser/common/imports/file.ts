/**
 * Read local and fetch remote files.
 * Support text and binary files;
 * Support string file paths like file://, /absolute/path, ~/relative/path, https://... and use fetch API.
 * Support File or Blob objects from file input or drag-and-drop.
 * Support encoding options like NodeJS API: fs.readFile(..., { encoding: 'utf-8' })
 */

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
async function readFile(filePath: string | File | Blob, options: TextEncodingOptions): Promise<string>;
async function readFile(filePath: string | File | Blob, options: Base64EncodingOptions): Promise<string>;
async function readFile(filePath: string | File | Blob, options: BinaryEncodingOptions): Promise<ArrayBuffer>;
async function readFile(filePath: string | File | Blob, options?: NoEncodingOptions): Promise<ArrayBuffer>;
async function readFile(filePath: string | File | Blob): Promise<ArrayBuffer>;

// Implementation
async function readFile(filePath: string | File | Blob, options?: ReadFileOptions): Promise<string | ArrayBuffer> {
  // Step 1: Download/retrieve the content as ArrayBuffer
  const arrayBuffer = await downloadContent(filePath);

  // Step 2: Decode based on encoding option
  return decodeContent(arrayBuffer, options?.encoding);
}

// Alternative implementation using File System Access API (requires user interaction)
async function readFileWithPermission(options?: ReadFileOptions): Promise<string | ArrayBuffer> {
  if (!('showOpenFilePicker' in window)) {
    throw new Error('File System Access API not supported in this browser');
  }

  // This requires user interaction (e.g., button click)
  const [fileHandle] = await (window as any).showOpenFilePicker({
    types: [
      {
        description: 'All Files',
        accept: { '*/*': ['*'] },
      },
    ],
    multiple: false,
  });

  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();

  return decodeContent(arrayBuffer, options?.encoding);
}

/**
 * Normalize a file path to a file:// URL
 */
function normalizeToFileURL(filePath: string): string {
  // Already a file URL
  if (filePath.startsWith('file://')) {
    return filePath;
  }

  // Handle home directory expansion
  if (filePath.startsWith('~/')) {
    // In browser context, we can't reliably get home directory
    // This would need to be handled by the file system API
    throw new Error('Home directory paths (~/) require platform-specific implementation');
  }

  // Convert absolute path to file URL
  if (filePath.startsWith('/')) {
    // On Windows, this might need adjustment for drive letters
    return `file://${filePath}`;
  }

  // Relative paths need to be resolved relative to current location
  // In browser, this would be relative to current page URL
  if (!filePath.includes('://')) {
    // For browser environment, could resolve relative to window.location
    // For now, treat as relative file path
    const currentPath =
      typeof window !== 'undefined'
        ? window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))
        : '/';
    return `file://${currentPath}/${filePath}`;
  }

  return filePath;
}

/**
 * Download content from various sources and return as ArrayBuffer
 */
async function downloadContent(source: string | File | Blob): Promise<ArrayBuffer> {
  // Handle File or Blob objects directly
  if (source instanceof File || source instanceof Blob) {
    return await source.arrayBuffer();
  }

  // Handle string paths
  if (typeof source !== 'string') {
    throw new TypeError('Source must be a string path, File, or Blob object');
  }

  // Handle HTTP/HTTPS URLs
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
    return await response.arrayBuffer();
  }

  // Handle file:// URLs and local paths
  try {
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
  } catch (error) {
    // If it's not a recognizable path pattern, try as relative URL
    if (!source.includes('://') && !source.startsWith('/')) {
      try {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        return await response.arrayBuffer();
      } catch (fetchError) {
        throw new Error(`Unable to read file from path: ${source}. ${fetchError}`);
      }
    } else {
      throw error;
    }
  }
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
