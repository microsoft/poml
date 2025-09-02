const CHUNK_SIZE = 8192; // Process in chunks to avoid stack overflow

export function base64ToBinary(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function base64ToUint8(base64: string): Uint8Array {
  const binaryString = atob(base64);
  // Create a proper ArrayBuffer to ensure compatibility
  const buffer = new ArrayBuffer(binaryString.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function binaryToBase64(binary: Uint8Array | ArrayBuffer): string {
  const uint8Array = binary instanceof ArrayBuffer ? new Uint8Array(binary) : binary;

  // Use chunked approach for large arrays to avoid stack overflow
  let binaryString = '';
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
    binaryString += String.fromCharCode(...chunk);
  }

  return btoa(binaryString);
}

export function arrayBufferToDataURL(buffer: ArrayBuffer | Uint8Array, mimeType: string): string {
  const base64 = binaryToBase64(buffer);
  return `data:${mimeType};base64,${base64}`;
}
