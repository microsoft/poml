import { expect } from '@playwright/test';

import { test } from './extension.spec';

test.describe('RPC Unit Tests', () => {
  test('sidebar -> background pingPong', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.background('Hello from sidebar', 100);
    });
    expect(result).toBe('Background received: Hello from sidebar');
  });

  test('sidebar -> content pingPong', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.content('Hello from sidebar', 100);
    });
    expect(result).toBe('Content received: Hello from sidebar');
  });

  test('background -> sidebar pingPong', async ({ serviceWorker, sidebarPage }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;
      return await pingPong.sidebar('Hello from background', 100);
    });
    expect(result).toBe('Sidebar received: Hello from background');
  });

  test('background -> content pingPong', async ({ serviceWorker, sidebarPage }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;
      return await pingPong.content('Hello from background', 100);
    });
    expect(result).toBe('Content received: Hello from background');
  });

  test('content -> background pingPong', async ({ contentPage }) => {
    // Click the background ping button
    const button = contentPage.locator('#pingPongBackground');
    await button.click();

    // Wait for the result to appear in the button text
    await contentPage.waitForFunction(
      () => {
        const btn = document.querySelector('#pingPongBackground') as HTMLButtonElement;
        return btn && btn.textContent !== 'Pinging...' && btn.textContent !== 'Ping Background';
      },
      { timeout: 5000 },
    );

    // Get the result from button text
    const buttonText = await button.textContent();
    expect(buttonText).toBe('Result: Background received: Hello from content');
  });

  test('content -> sidebar pingPong', async ({ contentPage, sidebarPage }) => {
    // Click the sidebar ping button
    const button = contentPage.locator('#pingPongSidebar');
    await button.click();

    // Wait for the result to appear in the button text
    await contentPage.waitForFunction(
      () => {
        const btn = document.querySelector('#pingPongSidebar') as HTMLButtonElement;
        return btn && btn.textContent !== 'Pinging...' && btn.textContent !== 'Ping Sidebar';
      },
      { timeout: 5000 },
    );

    // Get the result from button text
    const buttonText = await button.textContent();
    expect(buttonText).toBe('Result: Sidebar received: Hello from content');
  });

  test('sidebar -> sidebar self pingPong', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.sidebar('Hello from sidebar to self', 100);
    });
    expect(result).toBe('Sidebar received: Hello from sidebar to self');
  });

  test('background -> background self pingPong', async ({ serviceWorker, sidebarPage }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;
      return await pingPong.background('Hello from background to self', 100);
    });
    expect(result).toBe('Background received: Hello from background to self');
  });

  test('content -> content self pingPong', async ({ contentPage }) => {
    // Click the content ping button
    const button = contentPage.locator('#pingPongContent');
    await button.click();

    // Wait for the result to appear in the button text
    await contentPage.waitForFunction(
      () => {
        const btn = document.querySelector('#pingPongContent') as HTMLButtonElement;
        return btn && btn.textContent !== 'Pinging...' && btn.textContent !== 'Ping Content';
      },
      { timeout: 5000 },
    );

    // Get the result from button text
    const buttonText = await button.textContent();
    expect(buttonText).toBe('Result: Content received: Hello from content');
  });

  test('content -> content+sidebar pingPong', async ({ contentPage, sidebarPage }) => {
    // Click the sidebar ping button
    const button = contentPage.locator('#pingPongContentSidebar');
    await button.click();

    // Wait for the result to appear in the button text
    await contentPage.waitForFunction(
      () => {
        const btn = document.querySelector('#pingPongContentSidebar') as HTMLButtonElement;
        return btn && btn.textContent !== 'Pinging...' && btn.textContent !== 'Ping Content & Sidebar';
      },
      { timeout: 5000 },
    );

    // Get the result from button text
    const buttonText = await button.textContent();
    expect(buttonText).toBe('Result: content received: Hello from content');
  });

  test('background -> content+sidebar pingPong', async ({ serviceWorker, sidebarPage }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;
      return await pingPong.contentSidebar('Hello from background', 100);
    });
    expect(result).toBe('content received: Hello from background');
  });

  test('sidebar -> content+sidebar pingPong', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { pingPong } = window as any;
      return await pingPong.contentSidebar('Hello from sidebar', 100);
    });
    expect(result).toBe('sidebar received: Hello from sidebar');
  });
});

test.describe('RPC Complex Tests', () => {
  test('sidebar -> content complex data types pingPong', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { pingPong } = window as any;

      const complexData = {
        string: 'test string',
        number: 42,
        boolean: true,
        null_value: null,
        undefined_value: undefined,
        array: [1, 'two', { three: 3 }, null, undefined],
        nested_object: {
          deep: {
            property: 'value',
            count: 123,
          },
        },
        binary_data: new Uint8Array([0, 255, 128, 64, 32]),
        float_array: new Float32Array([Math.PI, -0, 1.5, Infinity, -Infinity]),
        empty_array: [],
        empty_object: {},
      };

      return await pingPong.content(complexData, 100);
    });

    // Verify the structure and data types are preserved
    // Note: undefined values become null during JSON serialization
    expect(result).toEqual({
      content: {
        string: 'test string',
        number: 42,
        boolean: true,
        null_value: null,
        // undefined_value is omitted during serialization
        array: [1, 'two', { three: 3 }, null, null], // undefined becomes null
        nested_object: {
          deep: {
            property: 'value',
            count: 123,
          },
        },
        binary_data: new Uint8Array([0, 255, 128, 64, 32]),
        float_array: new Float32Array([Math.PI, -0, 1.5, Infinity, -Infinity]),
        empty_array: [],
        empty_object: {},
      },
    });

    // Verify binary data integrity with strict comparison
    expect(Array.from(result.content.binary_data)).toStrictEqual([0, 255, 128, 64, 32]);
    expect(result.content.float_array.length).toBe(5);
    expect(result.content.float_array[0]).toBeCloseTo(Math.PI);
    expect(Object.is(result.content.float_array[1], -0)).toBe(true);
    expect(result.content.float_array[2]).toBe(1.5);
    expect(result.content.float_array[3]).toBe(Infinity);
    expect(result.content.float_array[4]).toBe(-Infinity);
  });

  test('background -> content binary array data pingPong', async ({ serviceWorker, sidebarPage }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;

      // Create diverse typed arrays and binary data
      const testData = {
        uint8: new Uint8Array([1, 2, 3, 255]),
        uint16: new Uint16Array([1000, 2000, 65535]),
        uint32: new Uint32Array([100000, 200000, 4294967295]),
        int8: new Int8Array([-128, -1, 0, 127]),
        int16: new Int16Array([-32768, -1, 0, 32767]),
        int32: new Int32Array([-2147483648, -1, 0, 2147483647]),
        float32: new Float32Array([0.1, -0.1, Math.PI, Math.E]),
        float64: new Float64Array([0.123456789, -0.987654321, Number.MAX_VALUE, Number.MIN_VALUE]),
        buffer: (() => {
          const buf = new ArrayBuffer(8);
          const view = new Uint8Array(buf);
          view[0] = 42; // Add some data so it's not empty
          view[7] = 24;
          return buf;
        })(),
        mixed_array: [new Uint8Array([10, 20, 30]), { nested: new Float32Array([1.1, 2.2]) }, 'string_element', 42],
      };

      const result = await pingPong.content(testData, 100);

      // ArrayBuffer will disappear when throwing across playwright
      // This will be the only chance to check ArrayBuffer integrity
      // Verify ArrayBuffer before it gets lost in playwright boundary
      if (!(result.content.buffer instanceof ArrayBuffer)) {
        throw new Error('ArrayBuffer type not preserved');
      }
      if (result.content.buffer.byteLength !== 8) {
        throw new Error(`ArrayBuffer size mismatch: expected 8, got ${result.content.buffer.byteLength}`);
      }
      const bufferView = new Uint8Array(result.content.buffer);
      if (bufferView[0] !== 42) {
        throw new Error(`ArrayBuffer data mismatch at index 0: expected 42, got ${bufferView[0]}`);
      }
      if (bufferView[7] !== 24) {
        throw new Error(`ArrayBuffer data mismatch at index 7: expected 24, got ${bufferView[7]}`);
      }

      return result;
    });

    // Verify each typed array maintains its type and values
    expect(result.content.uint8).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.content.uint8)).toStrictEqual([1, 2, 3, 255]);

    expect(result.content.uint16).toBeInstanceOf(Uint16Array);
    expect(Array.from(result.content.uint16)).toStrictEqual([1000, 2000, 65535]);

    expect(result.content.uint32).toBeInstanceOf(Uint32Array);
    expect(Array.from(result.content.uint32)).toStrictEqual([100000, 200000, 4294967295]);

    expect(result.content.int8).toBeInstanceOf(Int8Array);
    expect(Array.from(result.content.int8)).toStrictEqual([-128, -1, 0, 127]);

    expect(result.content.int16).toBeInstanceOf(Int16Array);
    expect(Array.from(result.content.int16)).toStrictEqual([-32768, -1, 0, 32767]);

    expect(result.content.int32).toBeInstanceOf(Int32Array);
    expect(Array.from(result.content.int32)).toStrictEqual([-2147483648, -1, 0, 2147483647]);

    expect(result.content.float32).toBeInstanceOf(Float32Array);
    expect(result.content.float32[0]).toBeCloseTo(0.1);
    expect(result.content.float32[1]).toBeCloseTo(-0.1);
    expect(result.content.float32[2]).toBeCloseTo(Math.PI);
    expect(result.content.float32[3]).toBeCloseTo(Math.E);

    expect(result.content.float64).toBeInstanceOf(Float64Array);
    expect(result.content.float64[0]).toBeCloseTo(0.123456789);
    expect(result.content.float64[1]).toBeCloseTo(-0.987654321);

    // Verify mixed array with nested binary data
    expect(result.content.mixed_array[0]).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.content.mixed_array[0])).toStrictEqual([10, 20, 30]);
    expect(result.content.mixed_array[1].nested).toBeInstanceOf(Float32Array);
    expect(result.content.mixed_array[1].nested[0]).toBeCloseTo(1.1);
    expect(result.content.mixed_array[1].nested[1]).toBeCloseTo(2.2);
    expect(result.content.mixed_array[2]).toBe('string_element');
    expect(result.content.mixed_array[3]).toBe(42);
  });

  test('sidebar -> background edge case data types pingPong', async ({ sidebarPage }) => {
    const result = await sidebarPage.evaluate(async () => {
      const { pingPong } = window as any;

      // Test edge cases and special values
      const edgeCaseData = {
        numbers: {
          zero: 0,
          negative_zero: -0,
          positive_infinity: Infinity,
          negative_infinity: -Infinity,
          nan: NaN,
          max_safe_integer: Number.MAX_SAFE_INTEGER,
          min_safe_integer: Number.MIN_SAFE_INTEGER,
          epsilon: Number.EPSILON,
        },
        strings: {
          empty: '',
          unicode: '🚀 Unicode test: 你好世界 🌍',
          special_chars: 'Special chars: \n\t\r\\"\\\'',
          long_string: 'a'.repeat(10000),
        },
        arrays: {
          sparse: [1, , , 4, undefined, null], // sparse array
          very_nested: [[[[[['deep']]]]]],
          mixed_types: [true, false, 0, '', null, undefined, Symbol('test').toString()],
        },
        objects: {
          circular_safe: { a: 1, b: { c: 2 } }, // Safe non-circular
          with_functions_removed: {
            data: 'value',
            // Functions should be stripped during serialization
          },
          prototype_safe: Object.create(null), // Object with no prototype
        },
        binary_edge_cases: {
          empty_uint8: new Uint8Array(0),
          single_byte: new Uint8Array([42]),
          large_array: new Uint8Array(1000).fill(255),
          zero_buffer: new ArrayBuffer(0),
        },
      };

      // Add property to prototype-safe object
      edgeCaseData.objects.prototype_safe['key'] = 'value';

      const result = await pingPong.background(edgeCaseData, 100);

      // Verify zero ArrayBuffer before it gets lost in playwright boundary
      if (!(result.content.binary_edge_cases.zero_buffer instanceof ArrayBuffer)) {
        throw new Error('Zero ArrayBuffer type not preserved');
      }
      if (result.content.binary_edge_cases.zero_buffer.byteLength !== 0) {
        throw new Error(
          `Zero ArrayBuffer size mismatch: expected 0, got ${result.content.binary_edge_cases.zero_buffer.byteLength}`,
        );
      }

      return result;
    });

    // Verify numbers including special values
    expect(result.content.numbers.zero).toBe(0);
    // Note: -0 becomes +0 during JSON serialization, this is expected behavior
    expect(result.content.numbers.negative_zero).toBe(0);
    // Note: Infinity and -Infinity become null during JSON serialization
    expect(result.content.numbers.positive_infinity).toBeNull();
    expect(result.content.numbers.negative_infinity).toBeNull();
    // Note: NaN becomes null during JSON serialization
    expect(result.content.numbers.nan).toBeNull();
    expect(result.content.numbers.max_safe_integer).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.content.numbers.min_safe_integer).toBe(Number.MIN_SAFE_INTEGER);
    expect(result.content.numbers.epsilon).toBe(Number.EPSILON);

    // Verify string edge cases
    expect(result.content.strings.empty).toBe('');
    expect(result.content.strings.unicode).toBe('🚀 Unicode test: 你好世界 🌍');
    expect(result.content.strings.special_chars).toBe('Special chars: \n\t\r\\"\\\'');
    expect(result.content.strings.long_string).toBe('a'.repeat(10000));

    // Verify array edge cases
    expect(result.content.arrays.sparse.length).toBe(6);
    expect(result.content.arrays.sparse[0]).toBe(1);
    // Note: sparse array holes become null during JSON serialization
    expect(result.content.arrays.sparse[1]).toBeNull();
    expect(result.content.arrays.sparse[2]).toBeNull();
    expect(result.content.arrays.sparse[3]).toBe(4);
    expect(result.content.arrays.sparse[4]).toBeNull(); // undefined becomes null
    expect(result.content.arrays.sparse[5]).toBeNull();

    expect(result.content.arrays.very_nested).toEqual([[[[[['deep']]]]]]);
    expect(result.content.arrays.mixed_types[0]).toBe(true);
    expect(result.content.arrays.mixed_types[1]).toBe(false);
    expect(result.content.arrays.mixed_types[2]).toBe(0);
    expect(result.content.arrays.mixed_types[3]).toBe('');
    expect(result.content.arrays.mixed_types[4]).toBeNull();
    expect(result.content.arrays.mixed_types[5]).toBeNull(); // undefined becomes null

    // Verify objects
    expect(result.content.objects.circular_safe).toEqual({ a: 1, b: { c: 2 } });
    expect(result.content.objects.with_functions_removed.data).toBe('value');
    expect(result.content.objects.prototype_safe.key).toBe('value');

    // Verify binary edge cases
    expect(result.content.binary_edge_cases.empty_uint8).toBeInstanceOf(Uint8Array);
    expect(result.content.binary_edge_cases.empty_uint8.length).toBe(0);
    expect(result.content.binary_edge_cases.single_byte).toBeInstanceOf(Uint8Array);
    expect(result.content.binary_edge_cases.single_byte[0]).toBe(42);
    expect(result.content.binary_edge_cases.large_array).toBeInstanceOf(Uint8Array);
    expect(result.content.binary_edge_cases.large_array.length).toBe(1000);
    expect(Array.from(result.content.binary_edge_cases.large_array.slice(0, 3))).toStrictEqual([255, 255, 255]);
    // Zero ArrayBuffer integrity was verified within the evaluate function above
  });

  test('background -> background self complex nested data pingPong', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
      const { pingPong } = self as any;

      // Create deeply nested structure with mixed binary and regular data
      const complexNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  data: 'deep value',
                  binary: new Uint16Array([1, 2, 3]),
                  array: [
                    {
                      item: 1,
                      buffer: (() => {
                        const buf = new ArrayBuffer(4);
                        new Uint8Array(buf)[0] = 100;
                        return buf;
                      })(),
                    },
                    { item: 2, floats: new Float64Array([1.1, 2.2, 3.3]) },
                    {
                      item: 3,
                      nested_again: {
                        more_data: true,
                        typed_arrays: {
                          uint8: new Uint8Array([100, 200]),
                          int32: new Int32Array([-1000, 1000]),
                        },
                      },
                    },
                  ],
                },
              },
              parallel_data: {
                strings: ['a', 'b', 'c'],
                numbers: [1, 2, 3],
                mixed: ['string', 42, new Float32Array([Math.PI]), { embedded: new Int8Array([-1, 0, 1]) }],
              },
            },
          },
        },
        root_binary: new Uint32Array([0xffffffff, 0x00000000, 0x12345678]),
        primitive_values: {
          true_val: true,
          false_val: false,
          null_val: null,
          undefined_val: undefined,
          zero_val: 0,
          empty_string: '',
        },
      };

      const result = await pingPong.background(complexNested, 50);

      // Verify ArrayBuffer before it gets lost in playwright boundary
      const level5Array = result.content.level1.level2.level3.level4.level5.array;
      if (!(level5Array[0].buffer instanceof ArrayBuffer)) {
        throw new Error('Nested ArrayBuffer type not preserved');
      }
      if (level5Array[0].buffer.byteLength !== 4) {
        throw new Error(`Nested ArrayBuffer size mismatch: expected 4, got ${level5Array[0].buffer.byteLength}`);
      }
      const nestedBufferView = new Uint8Array(level5Array[0].buffer);
      if (nestedBufferView[0] !== 100) {
        throw new Error(`Nested ArrayBuffer data mismatch: expected 100, got ${nestedBufferView[0]}`);
      }

      return result;
    });

    // Verify deep nested structure is preserved
    expect(result.content.level1.level2.level3.level4.level5.data).toBe('deep value');
    expect(result.content.level1.level2.level3.level4.level5.binary).toBeInstanceOf(Uint16Array);
    expect(Array.from(result.content.level1.level2.level3.level4.level5.binary)).toStrictEqual([1, 2, 3]);

    // Verify nested array with mixed data
    const level5Array = result.content.level1.level2.level3.level4.level5.array;
    expect(level5Array[0].item).toBe(1);
    // ArrayBuffer integrity was verified within the evaluate function above

    expect(level5Array[1].item).toBe(2);
    expect(level5Array[1].floats).toBeInstanceOf(Float64Array);
    expect(level5Array[1].floats[0]).toBeCloseTo(1.1);
    expect(level5Array[1].floats[1]).toBeCloseTo(2.2);
    expect(level5Array[1].floats[2]).toBeCloseTo(3.3);

    expect(level5Array[2].item).toBe(3);
    expect(level5Array[2].nested_again.more_data).toBe(true);
    expect(level5Array[2].nested_again.typed_arrays.uint8).toBeInstanceOf(Uint8Array);
    expect(Array.from(level5Array[2].nested_again.typed_arrays.uint8)).toStrictEqual([100, 200]);
    expect(level5Array[2].nested_again.typed_arrays.int32).toBeInstanceOf(Int32Array);
    expect(Array.from(level5Array[2].nested_again.typed_arrays.int32)).toStrictEqual([-1000, 1000]);

    // Verify parallel data structure
    expect(result.content.level1.level2.level3.parallel_data.strings).toStrictEqual(['a', 'b', 'c']);
    expect(result.content.level1.level2.level3.parallel_data.numbers).toStrictEqual([1, 2, 3]);

    const mixedData = result.content.level1.level2.level3.parallel_data.mixed;
    expect(mixedData[0]).toBe('string');
    expect(mixedData[1]).toBe(42);
    expect(mixedData[2]).toBeInstanceOf(Float32Array);
    expect(mixedData[2][0]).toBeCloseTo(Math.PI);
    expect(mixedData[3].embedded).toBeInstanceOf(Int8Array);
    expect(Array.from(mixedData[3].embedded)).toStrictEqual([-1, 0, 1]);

    // Verify root level data
    expect(result.content.root_binary).toBeInstanceOf(Uint32Array);
    expect(Array.from(result.content.root_binary)).toStrictEqual([0xffffffff, 0x00000000, 0x12345678]);

    // Verify primitive values are preserved exactly
    expect(result.content.primitive_values.true_val).toBe(true);
    expect(result.content.primitive_values.false_val).toBe(false);
    expect(result.content.primitive_values.null_val).toBeNull();
    // Note: undefined_val property is omitted during JSON serialization
    expect(result.content.primitive_values.undefined_val).toBeUndefined();
    expect(result.content.primitive_values.zero_val).toBe(0);
    expect(result.content.primitive_values.empty_string).toBe('');
  });
});
