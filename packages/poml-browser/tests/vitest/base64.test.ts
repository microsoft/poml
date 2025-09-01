import { describe, it, expect } from 'vitest';
import {
  base64ToBinary,
  base64ToUint8,
  binaryToBase64,
  binaryToDataURL,
  serializeBinaryData,
  deserializeBinaryData,
} from '@common/utils/base64';

// Small helper
const toUint8 = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe('binary/base64 utilities with happy-dom', () => {
  it('decodes base64 to bytes (base64ToBinary) for a simple string', () => {
    // "Hello"
    const bytes = base64ToBinary('SGVsbG8=');
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it('decodes base64 to bytes (base64ToUint8) and matches base64ToBinary', () => {
    const b1 = base64ToBinary('U29tZSBiYXNlNjQ='); // "Some base64"
    const b2 = base64ToUint8('U29tZSBiYXNlNjQ=');
    expect(Array.from(b2)).toEqual(Array.from(b1));
  });

  it('encodes Uint8Array to base64 (binaryToBase64)', () => {
    const u8 = toUint8('Hello');
    const b64 = binaryToBase64(u8);
    expect(b64).toBe('SGVsbG8=');
  });

  it('accepts ArrayBuffer input in binaryToBase64', () => {
    const u8 = toUint8('ABCD'); // 65,66,67,68
    const b64 = binaryToBase64(u8.buffer);
    expect(b64).toBe('QUJDRA==');
  });

  it('binaryToDataURL creates correct data URL with mime type', () => {
    const u8 = toUint8('png?');
    const url = binaryToDataURL(u8.buffer, 'image/png');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect(url).toBe('data:image/png;base64,cG5nPw==');
  });

  it('serialize/deserialize preserves ArrayBuffer contents', () => {
    const original = toUint8('buffer-123').buffer;
    const serialized = serializeBinaryData(original);
    // shape check
    expect(serialized && typeof serialized === 'object').toBe(true);
    expect((serialized as any).__RPC_B64__).toBe(true);
    expect(typeof (serialized as any).data).toBe('string');
    expect((serialized as any).type).toBe('ArrayBuffer');

    const roundtrip = deserializeBinaryData(serialized) as ArrayBuffer;
    expect(roundtrip instanceof ArrayBuffer).toBe(true);
    expect(Array.from(new Uint8Array(roundtrip))).toEqual(Array.from(new Uint8Array(original)));
  });

  it('serialize/deserialize preserves typed array types and values (Uint8Array)', () => {
    const u8 = new Uint8Array([0, 1, 255, 16, 32]);
    const serialized = serializeBinaryData(u8);
    expect((serialized as any).type).toBe('Uint8Array');
    const restored = deserializeBinaryData(serialized);
    expect(restored instanceof Uint8Array).toBe(true);
    expect(Array.from(restored)).toEqual([0, 1, 255, 16, 32]);
  });

  it('serialize/deserialize preserves typed array types and values (Float32Array)', () => {
    const f32 = new Float32Array([Math.PI, -0, 1.5]);
    const serialized = serializeBinaryData(f32);
    expect((serialized as any).type).toBe('Float32Array');
    const restored = deserializeBinaryData(serialized);
    expect(restored instanceof Float32Array).toBe(true);
    // Use toBeCloseTo for floats
    expect(restored.length).toBe(3);
    expect(restored[0]).toBeCloseTo(Math.PI);
    expect(Object.is(restored[1], -0)).toBe(true);
    expect(restored[2]).toBeCloseTo(1.5);
  });

  it('handles nested objects/arrays containing buffers and other primitives', () => {
    const payload = {
      name: 'file.bin',
      meta: { size: 5, ok: true },
      chunks: [new Uint8Array([1, 2, 3]), { inner: new Uint8Array([4, 5]) }, null, 'leave-me'],
    };

    const serialized = serializeBinaryData(payload);
    // Check markers are present only where expected
    expect((serialized.chunks[0] as any).__RPC_B64__).toBe(true);
    expect((serialized.chunks[1].inner as any).__RPC_B64__).toBe(true);
    expect(serialized.chunks[2]).toBeNull();
    expect(serialized.chunks[3]).toBe('leave-me');

    const restored = deserializeBinaryData(serialized);
    expect(restored.name).toBe('file.bin');
    expect(restored.meta.size).toBe(5);
    expect(restored.meta.ok).toBe(true);
    expect(Array.from(restored.chunks[0])).toEqual([1, 2, 3]);
    expect(Array.from(restored.chunks[1].inner)).toEqual([4, 5]);
    expect(restored.chunks[2]).toBeNull();
    expect(restored.chunks[3]).toBe('leave-me');
  });

  it('passes through null and undefined unchanged during (de)serialization', () => {
    expect(serializeBinaryData(null)).toBeNull();
    expect(serializeBinaryData(undefined)).toBeUndefined();
    expect(deserializeBinaryData(null)).toBeNull();
    expect(deserializeBinaryData(undefined)).toBeUndefined();
  });

  it('chunked encoding works for arrays larger than CHUNK_SIZE (8192)', () => {
    // Make a buffer of length > 8192 to exercise chunking branch
    const bigLen = 8192 * 100; // 819,200 bytes
    const big = new Uint8Array(bigLen);
    for (let i = 0; i < bigLen; i++) {
      big[i] = i % 256;
    }

    const b64 = binaryToBase64(big);
    const decoded = base64ToUint8(b64);

    expect(decoded.length).toBe(bigLen);
    expect(Array.from(decoded.slice(0, 64))).toEqual(Array.from(big.slice(0, 64)));
    expect(Array.from(decoded.slice(-64))).toEqual(Array.from(big.slice(-64)));
  });

  it('serializing an already-serialized payload is idempotent (no double-wrapping)', () => {
    const original = new Uint8Array([10, 20, 30]);
    const once = serializeBinaryData(original);
    const twice = serializeBinaryData(once);
    expect(twice).toEqual(once);
    // And it still deserializes correctly
    const restored = deserializeBinaryData(twice);
    expect(Array.from(restored)).toEqual([10, 20, 30]);
  });

  it('non-plain objects (e.g., Date) are returned as-is by serializer', () => {
    const d = new Date('2025-01-02T03:04:05.000Z');
    const serialized = serializeBinaryData(d);
    expect(serialized).toBe(d); // same reference
    const deserialized = deserializeBinaryData(d);
    expect(deserialized).toBe(d);
  });

  it('handles empty ArrayBuffer correctly in serialization and deserialization', () => {
    const empty = new ArrayBuffer(0);
    const serialized = serializeBinaryData(empty);
    expect((serialized as any).__RPC_B64__).toBe(true);
    expect((serialized as any).data).toBe(''); // base64 of empty string is empty
    const restored = deserializeBinaryData(serialized);
    expect(restored).toBeInstanceOf(ArrayBuffer);
    expect((restored as ArrayBuffer).byteLength).toBe(0);
  });

  it('roundtrips ArrayBuffer with non-ASCII bytes', () => {
    const buf = new Uint8Array([0, 128, 255]).buffer;
    const serialized = serializeBinaryData(buf);
    const restored = deserializeBinaryData(serialized) as ArrayBuffer;
    expect(Array.from(new Uint8Array(restored))).toEqual([0, 128, 255]);
  });
});
