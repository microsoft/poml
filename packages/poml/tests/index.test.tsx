import * as React from 'react';
import * as fs from 'fs';
import * as path from 'path';

import { beforeAll, afterAll, describe, expect, test, jest } from '@jest/globals';
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

interface ExpectMessage {
  speaker: string;
  contents: string[];
}

function stripEndline(str: string): string {
  return str.replace(/\n+$/, '').replace(/^\n+/, '').replace(/\r\n/g, '\n').replace(/\r/g, '');
}

function parseExpects(expectFile: string): ExpectMessage[] {
  const content = fs.readFileSync(expectFile, 'utf-8').replace(/\r\n/g, '\n');

  // Split by speaker headers (===== speaker =====)
  const sections = content.split(/===== (\w+) =====\n\n/);

  const messages: ExpectMessage[] = [];

  // Process sections in pairs (speaker, content)
  for (let i = 1; i < sections.length; i += 2) {
    if (i + 1 < sections.length) {
      const speaker = sections[i];
      const rawContent = stripEndline(sections[i + 1]);

      // Parse content for mixed text and images
      const contents: string[] = [];

      // Find all JSON image objects first
      const imagePattern = /\{"type":"[^"]+","base64":"[^\n"]+?(\n|$)/g;

      // Split content while keeping track of positions
      let lastEnd = 0;
      let match;

      while ((match = imagePattern.exec(rawContent)) !== null) {
        // Add text before this image (if any)
        const textBefore = stripEndline(rawContent.slice(lastEnd, match.index));
        if (textBefore) {
          contents.push(textBefore);
        }

        // Add image (first 50 chars of base64)
        try {
          const imgData = JSON.parse(match[0]);
          const base64Content = imgData.base64 || '';
          const prefix = base64Content.slice(0, 50);
          contents.push(prefix);
        } catch (e) {
          // Fallback: extract base64 with regex
          const base64Match = match[0].match(/"base64":"([^"\.]+)/);
          if (base64Match) {
            const prefix = base64Match[1].slice(0, 50);
            contents.push(prefix);
          }
        }

        lastEnd = match.index + match[0].length;
      }

      // Add any remaining text after the last image
      const remainingText = stripEndline(rawContent.slice(lastEnd));
      if (remainingText) {
        contents.push(remainingText);
      }

      messages.push({ speaker, contents });
    }
  }

  return messages;
}

function diffMessages(expected: ExpectMessage[], actual: any): string {
  if (!Array.isArray(actual)) {
    return `Expected a list of messages, got ${typeof actual}`;
  }
  if (expected.length !== actual.length) {
    return `Expected ${expected.length} messages, got ${actual.length}`;
  }

  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i];
    const act = actual[i];

    if (typeof act !== 'object' || act === null) {
      return `Message ${i} is not an object: ${typeof act}`;
    }
    if (exp.speaker !== act.speaker) {
      return `Message ${i} speaker mismatch: expected '${exp.speaker}', got '${act.speaker}'`;
    }
    if (!('content' in act)) {
      return `Message ${i} missing 'content' key`;
    }
    if (typeof act.content === 'string') {
      if (exp.contents.length !== 1 || exp.contents[0] !== stripEndline(act.content)) {
        return `Message ${i} contents mismatch: expected ${JSON.stringify(exp.contents)}, got ${JSON.stringify(act.content)}`;
      }
      continue;
    }
    if (!Array.isArray(act.content)) {
      return `Message ${i} contents is not an array: ${typeof act.content}`;
    }
    if (exp.contents.length !== act.content.length) {
      return `Message ${i} content length mismatch: expected ${exp.contents.length}, got ${act.content.length}`;
    }
    for (let j = 0; j < exp.contents.length; j++) {
      const expContent = exp.contents[j];
      const actContent = act.content[j];

      if (typeof actContent === 'string' && expContent === stripEndline(actContent)) {
        continue;
      }
      if (typeof actContent === 'object' && actContent !== null) {
        if ('base64' in actContent && actContent.base64.startsWith(expContent)) {
          continue;
        }
      }
      return `Message ${i} content ${j} mismatch: expected '${expContent}', got '${actContent}'`;
    }
  }
  return '';
}

describe('examples correctness', () => {
  beforeAll(() => {
    spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  // Dynamically generate tests for all .poml files in the examples folder
  const examplesDir = path.resolve(__dirname, '../../../examples');
  const expectsDir = path.join(examplesDir, 'expects');
  const exampleFiles = fs
    .readdirSync(examplesDir)
    .filter(file => file.endsWith('.poml'))
    .sort(); // Sort for consistent test order

  exampleFiles.forEach(fileName => {
    test(`${fileName} produces correct output`, async () => {
      const filePath = path.join(examplesDir, fileName);
      const expectFile = path.join(expectsDir, fileName.replace('.poml', '.txt'));

      if (!fs.existsSync(expectFile)) {
        throw new Error(`Expected output file not found: ${expectFile}`);
      }

      // Get actual result
      let actualResult: any;
      const originalWrite = process.stdout.write;
      const outputs: string[] = [];

      process.stdout.write = jest.fn((str: string) => {
        outputs.push(str);
        return true;
      });

      try {
        await commandLine({
          file: filePath,
          speakerMode: true
        });

        const output = outputs.join('');
        actualResult = JSON.parse(output);
      } finally {
        process.stdout.write = originalWrite;
      }

      // Parse expected output
      const expectedMessages = parseExpects(expectFile);
      const diff = diffMessages(expectedMessages, actualResult);

      if (diff) {
        throw new Error(`Example ${fileName} failed:\n${diff}`);
      }
    });
  });

  // Fallback test if no example files are found
  if (exampleFiles.length === 0) {
    test('no .poml files found', () => {
      console.warn(`No .poml files found in ${examplesDir}`);
      expect(true).toBe(true); // Always pass this test
    });
  }
});
