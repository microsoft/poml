import { lookup } from './mime-types';

export interface PathInfo {
  name: string;
  mimeType: string;
  url?: string;
}

/**
 * Extracts the file name from a given file path, File object, or Blob.
 */
export function basename(filePath: string | File | Blob): string {
  if (filePath instanceof File) {
    return filePath.name;
  } else if (filePath instanceof Blob) {
    return 'blob';
  } else {
    return filePath.replace(/\\/g, '/').split('/').pop() || filePath;
  }
}

/**
 * Converts a File, Blob, or string path to a string path if possible.
 */
export function fileToPath(file: File | Blob | string): string | undefined {
  if (typeof file === 'string') {
    return file;
  } else if (file instanceof File) {
    return file.name;
  } else {
    // Blob has no path
    return undefined;
  }
}

/**
 * Get the MIME type of a file path, File object, or Blob.
 * Defaults to 'application/octet-stream' if type cannot be determined.
 *
 * It can't infer whether it's probably text or binary if the file has an unknown extension.
 */
export function mimeType(filePath: string | File | Blob): string {
  if (filePath instanceof File) {
    return lookup(filePath.name) || filePath.type || 'application/octet-stream';
  } else if (filePath instanceof Blob) {
    return filePath.type || 'application/octet-stream';
  } else {
    return lookup(filePath) || 'application/octet-stream';
  }
}

/**
 * All the guessed information we can get from a file path, File object, or Blob.
 */
export function pathInfo(filePath: string | File | Blob): PathInfo {
  return {
    name: basename(filePath),
    mimeType: mimeType(filePath),
    url: fileToPath(filePath),
  };
}
