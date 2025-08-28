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

export function waitForChromeRuntime(): Promise<void> {
  // If we are not on an extension page, this will never resolve — keep the timeout guard.
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const iv = setInterval(() => {
      // console.log(chrome);
      // console.log(chrome.runtime);
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - started > 5000) {
        // 5s guard
        clearInterval(iv);
        console.log(chrome);
        console.log(chrome?.runtime);
        reject(new Error('chrome.runtime not available (timeout)'));
      }
    }, 50);
  });
}
