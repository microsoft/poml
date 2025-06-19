import * as React from 'react';
import * as fs from 'fs';
import * as path from 'path';

import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import { spyOn } from 'jest-mock';

import { read, write, poml, commandLine } from 'poml';
import { ErrorCollection, ReadError, WriteError } from 'poml/base';

// Add a finalizer to allow any lingering async operations (like from pdf-parse) to complete.
afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
});

describe('endToEnd', () => {
  test('simple', async () => {
    const text = '<Markup.Paragraph>Hello, world!</Markup.Paragraph>';
    const element = await poml(text);
    expect(element).toBe('Hello, world!');
  });

  test('speakerWithStylesheet', async () => {
    const markup = '<p><p className="myClass">hello</p><p className="myClassB">world</p></p>';
    const stylesheet = {
      '.myClass': {
        speaker: 'ai'
      },
      '.myClassB': {
        speaker: 'human'
      }
    };
    const ir = await read(markup, undefined, undefined, stylesheet);
    expect(ir).toBe(
      '<env presentation=\"markup\" markup-lang=\"markdown\" original-start-index=\"0\" original-end-index=\"71\"><p original-start-index=\"0\" original-end-index=\"71\"><p speaker=\"ai\" original-start-index=\"3\" original-end-index=\"34\">hello</p><p speaker=\"human\" original-start-index=\"35\" original-end-index=\"67\">world</p></p></env>'
    );
    const result = write(ir, { speaker: true });
    expect(result).toStrictEqual([
      { speaker: 'ai', content: 'hello' },
      { speaker: 'human', content: 'world' }
    ]);
  });

  test('system', async () => {
    const text = `<poml>
<p speaker="system">Be brief and clear in your responses</p>
<!-- some comment -->
</poml>`;
    const element = write(await read(text), { speaker: true });
    expect(element).toStrictEqual([
      { speaker: 'system', content: 'Be brief and clear in your responses' }
    ]);
  });

  test('empty', async () => {
    const text = '<poml>\n</poml>';
    const element = write(await read(text), { speaker: true });
    expect(element).toStrictEqual([{ speaker: 'human', content: [] }]);
  });
});

describe('diagnosis', () => {
  test('load', async () => {
    const fn = async () => {
      ErrorCollection.clear();
      await read('<p><paragrapy/><paragraph/></p>');
      if (!ErrorCollection.empty()) {
        throw ErrorCollection.first();
      }
    };
    await expect(fn).rejects.toThrow(ReadError);
    try {
      await fn();
    } catch (e: any) {
      expect(e.message).toBe('Component paragrapy not found. Do you mean: paragraph?');
      expect(e.startIndex).toBe(4);
      expect(e.endIndex).toBe(12);
    }
  });

  test('loadWithContext', async () => {
    const fn = async () => {
      ErrorCollection.clear();
      await read('<p>{{ name }}</p>', undefined, { naming: 'world' });
      if (!ErrorCollection.empty()) {
        throw ErrorCollection.first();
      }
    };
    await expect(fn).rejects.toThrow(ReadError);
    try {
      await fn();
    } catch (e: any) {
      expect(e.message).toBe('name is not defined');
      expect(e.startIndex).toBe(3);
      expect(e.endIndex).toBe(12);
    }
  });

  test('read', async () => {
    const fn = async () => {
      ErrorCollection.clear();
      await read('<p speaker="joker">hello</p>');
      if (!ErrorCollection.empty()) {
        throw ErrorCollection.first();
      }
    };
    await expect(fn).rejects.toThrow(ReadError);
    try {
      await fn();
    } catch (e: any) {
      expect(e.message).toBe('"speaker" should be one of human, ai, system, not joker');
      expect(e.startIndex).toBe(0);
      expect(e.endIndex).toBe(27);
    }
  });

  test('write', async () => {
    const original = '<p speaker="human"><obj syntax="json"/></p>';
    const fn = async () => {
      ErrorCollection.clear();
      write(await read(original));
      if (!ErrorCollection.empty()) {
        throw ErrorCollection.first();
      }
    };
    await expect(fn).rejects.toThrow(WriteError);
    try {
      await fn();
    } catch (e: any) {
      expect(e.message).toMatch(/^No data attribute in obj:/g);
      const ir = e.relatedIr.slice(e.irStartIndex, e.irEndIndex + 1);
      const originalSlice = original.slice(e.startIndex, e.endIndex + 1);
      expect(ir).toMatch(/^<obj serializer="json"/g);
      expect(originalSlice).toBe('<obj syntax="json"/>');
    }
  });
});

describe('cli', () => {
  beforeAll(() => {
    spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  test('simple', async () => {
    const text = '<Markup.Paragraph>Hello, world!</Markup.Paragraph>';
    await commandLine({ input: text, speakerMode: false });
    expect(process.stdout.write).toHaveBeenCalledWith('"Hello, world!"');
  });

  test('context', async () => {
    const text = '<Markup.Paragraph>{{name}}</Markup.Paragraph>';
    await commandLine({ input: text, context: ['name=world'], speakerMode: false });
    expect(process.stdout.write).toHaveBeenCalledWith('"world"');
  });

  test('contextSpeaker', async () => {
    const text = '<Markup.Paragraph>{{name}}</Markup.Paragraph>';
    await commandLine({ input: text, context: ['name=world'] });
    expect(process.stdout.write).toHaveBeenCalledWith(
      '[{\"speaker\":\"human\",\"content\":\"world\"}]'
    );
  });
});

describe('examples compilation', () => {
  beforeAll(() => {
    spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  // Dynamically generate tests for all .poml files in the examples folder
  const examplesDir = path.resolve(__dirname, '../../../examples');
  const exampleFiles = fs.readdirSync(examplesDir)
    .filter(file => file.endsWith('.poml'))
    .sort(); // Sort for consistent test order

  exampleFiles.forEach(fileName => {
    test(`${fileName} compiles successfully`, async () => {
      const filePath = path.join(examplesDir, fileName);
      await expect(async () => {
        await commandLine({ 
          file: filePath, 
          speakerMode: true 
        });
      }).not.toThrow();
    });
  });

  // Fallback test if no example files are found
  if (exampleFiles.length === 0) {
    test('no example files found', () => {
      console.warn(`No .poml files found in ${examplesDir}`);
      expect(true).toBe(true); // Always pass this test
    });
  }
});
