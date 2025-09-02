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

export function binaryToDataURL(buffer: ArrayBuffer | Uint8Array, mimeType: string): string {
  const base64 = binaryToBase64(buffer);
  return `data:${mimeType};base64,${base64}`;
}

export function stringToBase64(str: string): string {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(str);
  return binaryToBase64(uint8Array);
}

// Special marker to distinguish system-generated base64 from user-provided base64
const SYSTEM_BASE64_MARKER = '__RPC_B64__';

interface SerializedBinary {
  [SYSTEM_BASE64_MARKER]: true;
  data: string;
  type:
    | 'ArrayBuffer'
    | 'Uint8Array'
    | 'Uint16Array'
    | 'Uint32Array'
    | 'Int8Array'
    | 'Int16Array'
    | 'Int32Array'
    | 'Float32Array'
    | 'Float64Array';
}

function isTypedArray(value: any): boolean {
  return (
    value instanceof Uint8Array ||
    value instanceof Uint16Array ||
    value instanceof Uint32Array ||
    value instanceof Int8Array ||
    value instanceof Int16Array ||
    value instanceof Int32Array ||
    value instanceof Float32Array ||
    value instanceof Float64Array
  );
}

function getTypedArrayType(value: any): SerializedBinary['type'] {
  if (value instanceof Uint8Array) {
    return 'Uint8Array';
  }
  if (value instanceof Uint16Array) {
    return 'Uint16Array';
  }
  if (value instanceof Uint32Array) {
    return 'Uint32Array';
  }
  if (value instanceof Int8Array) {
    return 'Int8Array';
  }
  if (value instanceof Int16Array) {
    return 'Int16Array';
  }
  if (value instanceof Int32Array) {
    return 'Int32Array';
  }
  if (value instanceof Float32Array) {
    return 'Float32Array';
  }
  if (value instanceof Float64Array) {
    return 'Float64Array';
  }
  return 'ArrayBuffer';
}

function reconstructTypedArray(buffer: ArrayBuffer, type: SerializedBinary['type']): ArrayBuffer | any {
  switch (type) {
    case 'Uint8Array':
      return new Uint8Array(buffer);
    case 'Uint16Array':
      return new Uint16Array(buffer);
    case 'Uint32Array':
      return new Uint32Array(buffer);
    case 'Int8Array':
      return new Int8Array(buffer);
    case 'Int16Array':
      return new Int16Array(buffer);
    case 'Int32Array':
      return new Int32Array(buffer);
    case 'Float32Array':
      return new Float32Array(buffer);
    case 'Float64Array':
      return new Float64Array(buffer);
    case 'ArrayBuffer':
    default:
      return buffer;
  }
}

// Serialize binary data in objects/arrays to base64
export function serializeBinaryData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle ArrayBuffer and typed arrays
  if (data instanceof ArrayBuffer || isTypedArray(data)) {
    // For typed arrays, use their buffer, but ensure we get the full buffer
    const buffer =
      data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const base64 = binaryToBase64(buffer);
    return {
      [SYSTEM_BASE64_MARKER]: true,
      data: base64,
      type: getTypedArrayType(data),
    } as SerializedBinary;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => serializeBinaryData(item));
  }

  // Handle plain objects
  if (typeof data === 'object' && data.constructor === Object) {
    const result: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        result[key] = serializeBinaryData(data[key]);
      }
    }
    return result;
  }

  // Return primitives and other types as-is
  return data;
}

// Deserialize base64 back to binary data
export function deserializeBinaryData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // Check if this is our serialized binary marker
  if (typeof data === 'object' && data[SYSTEM_BASE64_MARKER] === true) {
    const serialized = data as SerializedBinary;
    const uint8Array = base64ToUint8(serialized.data);
    return reconstructTypedArray(uint8Array.buffer as ArrayBuffer, serialized.type);
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => deserializeBinaryData(item));
  }

  // Handle plain objects
  if (typeof data === 'object' && data.constructor === Object) {
    const result: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        result[key] = deserializeBinaryData(data[key]);
      }
    }
    return result;
  }

  // Return primitives and other types as-is
  return data;
}
