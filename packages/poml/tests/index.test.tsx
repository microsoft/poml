import * as React from 'react';
import * as fs from 'fs';
import * as path from 'path';

import { beforeAll, afterAll, describe, expect, test, jest } from '@jest/globals';
import { spyOn } from 'jest-mock';

import { read, write, writeWithSourceMap, poml, commandLine, _readWithFile } from 'poml';
import { Markup } from 'poml/presentation';
import { ErrorCollection, ReadError, WriteError } from 'poml/base';

// Add a finalizer to allow any lingering async operations (like from pdf-parse) to complete.
afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
});

describe('endToEnd', () => {
  test('simple', async () => {
    const text = '<Markup.Paragraph>Hello, world!</Markup.Paragraph>';
    const element = await poml(text);
    expect(element).toBe('Hello, world!');
  });

  test('whiteSpace', async () => {
    const text = `<poml>
  <!-- Preserve exact formatting with 'pre' -->
  <p whiteSpace="pre">This text    has multiple
  spaces and
      indentation preserved.


      You can also include endless new lines.</p>

  <!-- Normalize whitespace with 'filter' -->
  <p whiteSpace="filter">This text    will have
  normalized    spacing.

  New lines will also be reduced to a space.
  </p>

  <!-- Trim whitespace with 'trim' -->
  <p whiteSpace="trim">   This text will have leading    and trailing spaces removed.   </p>
</poml>`;
    const element = await poml(text);
    expect(element).toBe(
      `This text    has multiple
  spaces and
      indentation preserved.


      You can also include endless new lines.

This text will have normalized spacing. New lines will also be reduced to a space.

This text will have leading    and trailing spaces removed.`,
    );
  });

  test('charLimitEndToEnd', async () => {
    const text = '<p charLimit="4">abcdefg</p>';
    const element = await poml(text);
    expect(element).toBe('abcd (...truncated)');
  });

  test('tokenLimitEndToEnd', async () => {
    const text = '<p tokenLimit="1">hello world</p>';
    const element = await poml(text);
    expect(element).toBe('hello (...truncated)');
  });

  test('customTruncationOptions', async () => {
    const element = await poml(
      <Markup.Paragraph charLimit={3} writerOptions={{ truncateDirection: 'start', truncateMarker: '[cut]' }}>
        abcdef
      </Markup.Paragraph>,
    );
    expect(element).toBe('[cut]def');
  });

  test('priorityEndToEnd', async () => {
    const text = '<p charLimit="5"><span priority="1">hello</span><span priority="2">world</span></p>';
    const element = await poml(text);
    expect(element).toBe('world');
  });

  test('priorityTokenEndToEnd', async () => {
    const text = '<p tokenLimit="1"><span priority="1">hello</span><span priority="2">world</span></p>';
    const element = await poml(text);
    expect(element).toBe('world');
  });

  test('tokenControlDocExample1', async () => {
    const text = `<poml>
  <!-- Limit content to 100 characters -->
  <p charLimit="100">This is a very long paragraph that will be truncated if it exceeds the character limit. The truncation will add a marker to indicate that content was cut off.</p>
  
  <!-- Limit content to 50 tokens -->
  <p tokenLimit="10">This paragraph will be truncated based on token count rather than character count, which is more accurate for AI model processing.</p>
</poml>`;
    const element = await poml(text);
    expect(element)
      .toBe(`This is a very long paragraph that will be truncated if it exceeds the character limit. The truncati (...truncated)

This paragraph will be truncated based on token count rather (...truncated)`);
  });

  test('tokenControlDocExample2', async () => {
    const element = await poml(
      <Markup.Paragraph charLimit={20} writerOptions={{ truncateMarker: ' [...] ', truncateDirection: 'middle' }}>
        This is a very long paragraph that will be truncated if it exceeds the character limit. The truncation will add
        a marker to indicate that content was cut off.
      </Markup.Paragraph>,
    );
    expect(element).toBe('This is a  [...] s cut off.');
  });

  test('tokenControlDocExample3', async () => {
    const text = `<poml tokenLimit="40">
  <p priority="1">This content has low priority and may be removed first to save space.</p>
  
  <p priority="3">This content has high priority and will be preserved longer.</p>
  
  <p priority="2">This content has medium priority.</p>
  
  <!-- Content without priority defaults to priority 0 (lowest) -->
  <p>This content will be truncated first since it has no explicit priority.</p>
</poml>`;
    const element = await poml(text);
    const expected = `This content has low priority and may be removed first to save space.

This content has high priority and will be preserved longer.

This content has medium priority.`;
    expect(element).toBe(expected);
  });

  test('tokenControlDocExample4', async () => {
    const text = `<poml tokenLimit="40">
  <h priority="5">Critical Section Header</h>
  
  <p priority="4" charLimit="10">
    Important introduction that should be preserved but can be shortened individually.
  </p>
  
  <list priority="2">
    <item priority="3">High priority item</item>
    <item priority="1">Lower priority item</item>
    <item>Lowest priority item (no explicit priority)</item>
  </list>

  <p priority="3" tokenLimit="5">Optional additional context that can be truncated aggressively.</p>
</poml>`;
    const element = await poml(text);
    const expected = `# Critical Section Header

Important  (...truncated)

Optional additional context that can (...truncated)`;
    expect(element).toBe(expected);
  });

  test('speakerWithStylesheet', async () => {
    const markup = '<p><p className="myClass">hello</p><p className="myClassB">world</p></p>';
    const stylesheet = {
      '.myClass': {
        speaker: 'ai',
      },
      '.myClassB': {
        speaker: 'human',
      },
    };
    const ir = await read(markup, undefined, undefined, stylesheet);
    expect(ir).toBe(
      '<env presentation="markup" markup-lang="markdown" original-start-index="0" original-end-index="71"><p original-start-index="0" original-end-index="71"><p speaker="ai" original-start-index="3" original-end-index="34">hello</p><p speaker="human" original-start-index="35" original-end-index="67">world</p></p></env>',
    );
    const result = write(ir, { speaker: true });
    expect(result).toStrictEqual([
      { speaker: 'ai', content: 'hello' },
      { speaker: 'human', content: 'world' },
    ]);
  });

  test('system', async () => {
    const text = `<poml>
<p speaker="system">Be brief and clear in your responses</p>
<!-- some comment -->
</poml>`;
    const element = write(await read(text), { speaker: true });
    expect(element).toStrictEqual([{ speaker: 'system', content: 'Be brief and clear in your responses' }]);
  });

  test('empty', async () => {
    const text = '<poml>\n</poml>';
    const element = write(await read(text), { speaker: true });
    expect(element).toStrictEqual([{ speaker: 'human', content: [] }]);
  });

  test('inlineSerializeEndToEnd', async () => {
    const text =
      '<Markup.Environment><Serialize.Environment inline="true"><Serialize.Any name="hello">world</Serialize.Any></Serialize.Environment></Markup.Environment>';
    const result = await poml(text);
    expect(result).toBe('`{\n  "hello": "world"\n}`');
  });

  test('blockSerializeEndToEnd', async () => {
    const text =
      '<Markup.Environment><Serialize.Environment><Serialize.Any name="hello">world</Serialize.Any></Serialize.Environment></Markup.Environment>';
    const result = await poml(text);
    expect(result).toBe('```json\n{\n  "hello": "world"\n}\n```');
  });

  test('inlineFreeEndToEnd', async () => {
    const text =
      '<Markup.Environment><Free.Environment inline="true">hello world</Free.Environment></Markup.Environment>';
    const result = await poml(text);
    expect(result).toBe('`hello world`');
  });

  test('blockFreeEndToEnd', async () => {
    const text = '<Markup.Environment><Free.Environment>hello world</Free.Environment></Markup.Environment>';
    const result = await poml(text);
    expect(result).toBe('```\nhello world\n```');
  });

  test('toolRequest', async () => {
    const text = '<tool-request id="test-123" name="search" parameters="{{ { query: \'hello\', limit: 10 } }}" />';
    const result = await poml(text);
    expect(result).toHaveLength(1);
    expect((result[0] as any).type).toBe('application/vnd.poml.toolrequest');
    expect((result[0] as any).id).toBe('test-123');
    expect((result[0] as any).name).toBe('search');
    expect((result[0] as any).content).toEqual({ query: 'hello', limit: 10 });
  });

  test('toolResponse', async () => {
    const text = `<tool-response id="test-123" name="search">
      <p>Found results:</p>
      <list>
        <item>Result 1</item>
        <item>Result 2</item>
      </list>
    </tool-response>`;
    const result = await poml(text);
    expect(result).toHaveLength(1);
    expect((result[0] as any).type).toBe('application/vnd.poml.toolresponse');
    expect((result[0] as any).id).toBe('test-123');
    expect((result[0] as any).name).toBe('search');
    expect((result[0] as any).content).toMatch(/Found results:/);
    expect((result[0] as any).content).toMatch(/- Result 1/);
  });

  test('toolsInConversation', async () => {
    const text = `<poml>
      <p speaker="human">Search for information about TypeScript</p>
      <tool-request id="search-1" name="web_search" parameters={{ query: "TypeScript programming language" }} />
      <tool-response id="search-1" name="web_search" speaker="tool">
        <p>TypeScript is a strongly typed programming language that builds on JavaScript.</p>
      </tool-response>
      <p speaker="ai">Based on the search results, TypeScript is a typed superset of JavaScript.</p>
    </poml>`;
    const element = write(await read(text), { speaker: true });
    expect(element).toHaveLength(4);
    expect(element[0].speaker).toBe('human');
    expect(element[0].content).toBe('Search for information about TypeScript');
    expect(element[1].speaker).toBe('ai');
    expect((element[1].content[0] as any).type).toBe('application/vnd.poml.toolrequest');
    expect(element[2].speaker).toBe('tool');
    expect((element[2].content[0] as any).type).toBe('application/vnd.poml.toolresponse');
    expect(element[3].speaker).toBe('ai');
  });

  test('toolResponseWithImage', async () => {
    const text = `<tool-response id="img-123" name="generate_image">
      <p>Generated image:</p>
      <image base64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="/>
      <p>A simple test image</p>
    </tool-response>`;
    const result = await poml(text);
    expect(result).toHaveLength(1);
    const response = result[0] as any;
    expect(response.type).toBe('application/vnd.poml.toolresponse');
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content).toHaveLength(3);
    expect(response.content[1].type).toBe('image/png');
  });

  test('toolResponseComplex', async () => {
    const text = `<poml>
<tool name="get_horoscope">
{
    "type": "object",
    "properties": {
        "sign": {
            "type": "string",
            "description": "An astrological sign like Taurus or Aquarius"
        }
    },
    "required": ["sign"]
}</tool>

<p>What is my horoscope? I am an Aquarius.</p>
<tool-request name="get_horoscope" id="call_rui1PrufCQS25KZxLkt7hXWA" parameters='{"sign":"Aquarius"}'/>
<tool-response name="get_horoscope" id="call_rui1PrufCQS25KZxLkt7hXWA" syntax="json">
<cp caption="horoscope">: Next Tuesday you will befriend a baby otter.</cp>
</tool-response>
</poml>`;
    const result = await write(await read(text), { speaker: true });
    expect(result).toStrictEqual([
      {
        speaker: 'system',
        content: 'What is my horoscope? I am an Aquarius.',
      },
      {
        speaker: 'ai',
        content: [
          {
            type: 'application/vnd.poml.toolrequest',
            content: { sign: 'Aquarius' },
            id: 'call_rui1PrufCQS25KZxLkt7hXWA',
            name: 'get_horoscope',
          },
        ],
      },
      {
        speaker: 'tool',
        content: [
          {
            type: 'application/vnd.poml.toolresponse',
            content: '{\n  "horoscope": ": Next Tuesday you will befriend a baby otter."\n}',
            id: 'call_rui1PrufCQS25KZxLkt7hXWA',
            name: 'get_horoscope',
          },
        ],
      },
    ]);
  });

  test('dynamicTools', async () => {
    const text = `<poml>
  <system-msg>{{ system }}</system-msg>
  <p>{{ input }}</p>

  <div for="tool in tools">
    <tool-definition name="{{ tool.name }}" description="{{ tool.description }}">
      {{ tool.schema }}
    </tool-definition>
  </div>

  <div for="i in interactions">
    <tool-request for="res in i" id="{{ res.id }}" name="{{ res.name }}" parameters="{{ res.input }}" />
    <tool-response for="res in i" id="{{ res.id }}" name="{{ res.name }}">
      <object data="{{ res.output }}"/>
    </tool-response>
  </div>

  <runtime model="gpt-5"/>

</poml>`;
    const context = {
      system: 'You are a helpful DM assistant. Use the dice-rolling tool when needed.',
      input: 'Roll 2d4+1',
      tools: [
        {
          name: 'roll',
          description:
            '\n  Given a string of text describing a dice roll in \n  Dungeons and Dragons, provide a result of the roll.\n\n  Example input: 2d6 + 1d4\n  Example output: 14\n',
          schema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            properties: {
              diceRollExpression: {
                type: 'string',
              },
            },
            required: ['diceRollExpression'],
            additionalProperties: false,
          },
        },
      ],
      interactions: [] as any,
    };
    ErrorCollection.clear();
    const result = await write(await read(text, undefined, context), { speaker: true });
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toStrictEqual([
      {
        speaker: 'system',
        content: 'You are a helpful DM assistant. Use the dice-rolling tool when needed.\n' + '\n' + 'Roll 2d4+1',
      },
    ]);

    context.interactions.push([
      {
        id: 'call_FFzB6ZTXqOsaKeSN5x6KyXyC',
        name: 'roll',
        input: {
          diceRollExpression: '2d4+1',
        },
        output: {
          meta: null,
          content: [
            {
              type: 'text',
              text: '5',
              annotations: null,
              meta: null,
            },
          ],
          structuredContent: null,
          isError: false,
        },
      },
    ]);
    ErrorCollection.clear();
    const result2 = await write(await read(text, undefined, context), { speaker: true });
    expect(ErrorCollection.empty()).toBe(true);
    expect(result2.slice(-2)).toStrictEqual([
      {
        speaker: 'ai',
        content: [
          {
            type: 'application/vnd.poml.toolrequest',
            content: { diceRollExpression: '2d4+1' },
            id: 'call_FFzB6ZTXqOsaKeSN5x6KyXyC',
            name: 'roll',
          },
        ],
      },
      {
        speaker: 'tool',
        content: [
          {
            type: 'application/vnd.poml.toolresponse',
            content:
              '{"meta":null,"content":[{"type":"text","text":"5","annotations":null,"meta":null}],"structuredContent":null,"isError":false}',
            id: 'call_FFzB6ZTXqOsaKeSN5x6KyXyC',
            name: 'roll',
          },
        ],
      },
    ]);
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

  test('writeWithSourceMap', async () => {
    const original = '<poml><p>hello <b>world</b></p><p speaker="human">how are you?</p></poml>';
    const fn = async () => {
      ErrorCollection.clear();
      const ir = await read(original);
      const segments = writeWithSourceMap(ir, { speaker: true });
      if (!ErrorCollection.empty()) {
        throw ErrorCollection.first();
      }
      return segments;
    };
    const segments = await fn();
    const p1Start = original.indexOf('<p>');
    const p1End = original.indexOf('</p>') + 4 - 1; // +4 for '</p>', -1 for inclusive end
    const bStart = original.indexOf('<b>');
    const bEnd = original.indexOf('</b>') + 4 - 1;
    const p2Start = original.indexOf('<p speaker="human">');
    const p2End = original.lastIndexOf('</p>') + 4 - 1;
    const expects = [
      {
        startIndex: p1Start,
        endIndex: p1End,
        irStartIndex: 170,
        irEndIndex: 293,
        speaker: 'system',
        content: [
          {
            startIndex: p1Start,
            endIndex: p1End,
            irStartIndex: 170,
            irEndIndex: 293,
            content: 'hello ',
          },
          {
            startIndex: bStart,
            endIndex: bEnd,
            irStartIndex: 228,
            irEndIndex: 289,
            content: '**world**',
          },
        ],
      },
      {
        startIndex: p2Start,
        endIndex: p2End,
        irStartIndex: 294,
        irEndIndex: 378,
        speaker: 'human',
        content: [
          {
            startIndex: p2Start,
            endIndex: p2End,
            irStartIndex: 294,
            irEndIndex: 378,
            content: 'how are you?',
          },
        ],
      },
    ];
    expect(segments).toStrictEqual(expects);
  });

  test('writeWithSourceMapWithTask', async () => {
    const original = '<poml><p>hello</p><task>123</task></poml>';
    const fn = async () => {
      ErrorCollection.clear();
      const ir = await read(original);
      const segments = writeWithSourceMap(ir, { speaker: true });
      if (!ErrorCollection.empty()) {
        throw ErrorCollection.first();
      }
      return segments;
    };
    const segments = await fn();
    const pStart = original.indexOf('<p>');
    const pEnd = original.indexOf('</p>') + 4 - 1;
    const taskStart = original.indexOf('<task>');
    const taskEnd = original.indexOf('</task>') + 7 - 1;
    const expects = [
      {
        startIndex: pStart,
        endIndex: taskEnd,
        irStartIndex: 170,
        irEndIndex: 431,
        speaker: 'human',
        content: [
          {
            startIndex: pStart,
            endIndex: pEnd,
            irStartIndex: 170,
            irEndIndex: 230,
            content: 'hello',
          },
          {
            startIndex: 0,
            endIndex: original.length - 1,
            irStartIndex: 99,
            irEndIndex: 439,
            content: '\n\n',
          },
          {
            startIndex: taskStart,
            endIndex: taskEnd,
            irStartIndex: 325,
            irEndIndex: 421,
            content: '# Task',
          },
          {
            startIndex: taskStart,
            endIndex: taskEnd,
            irStartIndex: 231,
            irEndIndex: 435,
            content: '\n\n',
          },
          {
            startIndex: taskStart,
            endIndex: taskEnd,
            irStartIndex: 422,
            irEndIndex: 431,
            content: '123',
          },
        ],
      },
    ];
    expect(segments).toStrictEqual(expects);
  });
});

describe('cli', () => {
  beforeAll(() => {
    spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  test('simple', async () => {
    const text = '<Markup.Paragraph>Hello, world!</Markup.Paragraph>';
    await commandLine({ input: text, speakerMode: false });
    expect(process.stdout.write).toHaveBeenCalledWith('{"messages":"Hello, world!"}');
  });

  test('context', async () => {
    const text = '<Markup.Paragraph>{{name}}</Markup.Paragraph>';
    await commandLine({ input: text, context: ['name=world'], speakerMode: false });
    expect(process.stdout.write).toHaveBeenCalledWith('{"messages":"world"}');
  });

  test('contextSpeaker', async () => {
    const text = '<Markup.Paragraph>{{name}}</Markup.Paragraph>';
    await commandLine({ input: text, context: ['name=world'] });
    expect(process.stdout.write).toHaveBeenCalledWith('{"messages":[{"speaker":"human","content":"world"}]}');
  });

  test('contentWithResponseSchema', async () => {
    const text =
      '<poml>Hello, world!<output-schema>z.object({ operation: z.enum(["add", "subtract"]), a: z.number(), b: z.number() })</output-schema></poml>';
    await commandLine({ input: text, speakerMode: true });
    expect(process.stdout.write).toHaveBeenCalledWith(
      '{"messages":[{"speaker":"human","content":"Hello, world!"}],"schema":{"type":"object","properties":{"operation":{"type":"string","enum":["add","subtract"]},"a":{"type":"number"},"b":{"type":"number"}},"required":["operation","a","b"],"additionalProperties":false}}',
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

describe('message components', () => {
  test('MessageContent with toolrequest', async () => {
    const toolRequest = {
      type: 'application/vnd.poml.toolrequest' as const,
      id: 'test-123',
      name: 'search',
      content: { query: 'hello', limit: 10 },
    };

    const text = '<MessageContent content="{{toolRequestContent}}" />';
    const ir = await read(text, undefined, { toolRequestContent: [toolRequest] });
    const element = write(ir);
    expect(element).toHaveLength(1);
    expect((element[0] as any).type).toBe('application/vnd.poml.toolrequest');
    expect((element[0] as any).id).toBe('test-123');
    expect((element[0] as any).name).toBe('search');
    expect((element[0] as any).content).toEqual({ query: 'hello', limit: 10 });
  });

  test('MessageContent with toolresponse', async () => {
    const toolResponse = {
      type: 'application/vnd.poml.toolresponse' as const,
      id: 'test-123',
      name: 'search',
      content: 'Search completed successfully',
    };

    const text = '<MessageContent content="{{toolResponseContent}}" />';
    const ir = await read(text, undefined, { toolResponseContent: [toolResponse] });
    const messages = write(ir, { speaker: true });
    expect(messages).toHaveLength(1);
    expect(messages[0].speaker).toBe('tool');
    const element = messages[0].content;
    expect(element).toHaveLength(1);
    expect((element[0] as any).type).toBe('application/vnd.poml.toolresponse');
    expect((element[0] as any).id).toBe('test-123');
    expect((element[0] as any).name).toBe('search');
    expect((element[0] as any).content).toBe('Search completed successfully');
  });

  test('MessageContent with mixed content including tools', async () => {
    const toolRequest = {
      type: 'application/vnd.poml.toolrequest' as const,
      id: 'req-456',
      name: 'calculate',
      content: { expression: '2+2' },
    };

    const mixedContent = ['Making a calculation: ', toolRequest, ' Please wait...'];

    const text = '<MessageContent content="{{mixedContent}}" />';
    ErrorCollection.clear();
    const ir = await read(text, undefined, { mixedContent: mixedContent });
    const element = write(ir);
    expect(ErrorCollection.empty()).toBe(true);
    expect(element).toHaveLength(3);
    expect(element[0]).toBe('Making a calculation:');
    expect((element[1] as any).type).toBe('application/vnd.poml.toolrequest');
    expect((element[1] as any).id).toBe('req-456');
    expect((element[1] as any).name).toBe('calculate');
    expect(element[2]).toBe('Please wait...');
  });

  test('Conversation with tool messages', async () => {
    const toolRequest = {
      type: 'application/vnd.poml.toolrequest' as const,
      id: 'search-789',
      name: 'web_search',
      content: { query: 'TypeScript', limit: 5 },
    };

    const toolResponse = {
      type: 'application/vnd.poml.toolresponse' as const,
      id: 'search-789',
      name: 'web_search',
      content: 'Found 5 results about TypeScript',
    };

    const messages = [
      { speaker: 'human', content: 'Search for TypeScript information' },
      { speaker: 'ai', content: [toolRequest] },
      { speaker: 'tool', content: [toolResponse] },
      { speaker: 'ai', content: 'Based on the search results, TypeScript is great!' },
    ];

    const text = '<Conversation messages="{{messages}}" />';
    const element = write(await read(text, undefined, { messages }), { speaker: true });
    expect(element).toHaveLength(4);
    expect(element[0].speaker).toBe('human');
    expect(element[1].speaker).toBe('ai');
    expect((element[1].content[0] as any).type).toBe('application/vnd.poml.toolrequest');
    expect(element[2].speaker).toBe('tool');
    expect((element[2].content[0] as any).type).toBe('application/vnd.poml.toolresponse');
    expect(element[3].speaker).toBe('ai');
  });

  test('tool with runtime parameters and template variables', async () => {
    const tool_name = 'get_weather';
    const tool_schema = {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'The unit of temperature',
        },
      },
      required: ['location'],
    };

    const text = `<poml>
<p>What is the weather in San Francisco?</p>
<tool parser="eval" name="{{ tool_name }}" description="Get the current weather in a specified location.">
{{ tool_schema }}
</tool>
<runtime model="gpt-4.1" provider="microsoft" />
</poml>`;

    ErrorCollection.clear();
    const [ir, file] = await _readWithFile(text, undefined, { tool_name, tool_schema });
    const result = write(ir, { speaker: true });
    const runtime = file?.getRuntimeParameters();
    const tools = file?.getToolsSchema()?.toOpenAI();
    expect(ErrorCollection.empty()).toBe(true);

    // Check runtime parameters
    expect(runtime).toBeDefined();
    expect(runtime?.model).toBe('gpt-4.1');
    expect(runtime?.provider).toBe('microsoft');

    // Check tool definition
    expect(tools).toHaveLength(1);
    expect(tools?.[0].name).toBe('get_weather');
    expect(tools?.[0].description).toBe('Get the current weather in a specified location.');
    expect(tools?.[0].parameters).toBeDefined();

    // Verify the schema was properly parsed
    const schema = tools?.[0].parameters;
    expect(schema?.type).toBe('object');
    expect(schema?.properties?.location).toBeDefined();
    expect(schema?.properties?.location?.type).toBe('string');
    expect(schema?.properties?.unit?.enum).toEqual(['celsius', 'fahrenheit']);
    expect(schema?.required).toEqual(['location']);

    // Check the rendered message
    const messages = write(ir, { speaker: true });
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('What is the weather in San Francisco?');
  });

  test('pomlMessagesToVercelMessage conversion', () => {
    // Mock helper function for rich content conversion
    const richContentToToolResult = (content: any) => {
      if (typeof content === 'string') {
        return content;
      }
      const convertedContent = content.map((part: any) => {
        if (typeof part === 'string') {
          return { type: 'text', text: part };
        } else if (part.type?.startsWith('image/')) {
          return { type: 'image', image: part.base64 };
        } else if (part.type === 'application/json') {
          return { type: 'text', text: JSON.stringify(part.content, null, 2) };
        } else {
          return { type: 'text', text: `[${part.type}]` };
        }
      });
      if (convertedContent.length === 1 && convertedContent[0].type === 'text') {
        return convertedContent[0].text;
      }
      return convertedContent;
    };

    // Mock a simplified version of the conversion function
    const convertMessage = (messages: any[]) => {
      const speakerToRole = {
        ai: 'assistant',
        human: 'user',
        system: 'system',
        tool: 'tool',
      };
      return messages.map((msg) => {
        const role = speakerToRole[msg.speaker as keyof typeof speakerToRole];
        const contents =
          typeof msg.content === 'string'
            ? msg.content
            : msg.content.map((part: any) => {
                if (typeof part === 'string') {
                  return { type: 'text', text: part };
                } else if (part.type === 'application/vnd.poml.toolrequest') {
                  return {
                    type: 'tool-call',
                    toolCallId: part.id,
                    toolName: part.name,
                    input: part.content,
                  };
                } else if (part.type === 'application/vnd.poml.toolresponse') {
                  return {
                    type: 'tool-result',
                    toolCallId: part.id,
                    toolName: part.name,
                    result: richContentToToolResult(part.content),
                  };
                }
                return part;
              });
        return { role, content: contents };
      });
    };

    const toolRequest = {
      type: 'application/vnd.poml.toolrequest' as const,
      id: 'req-123',
      name: 'search',
      content: { query: 'test', limit: 10 },
    };

    const toolResponse = {
      type: 'application/vnd.poml.toolresponse' as const,
      id: 'req-123',
      name: 'search',
      content: 'Search completed successfully',
    };

    const messages = [
      { speaker: 'human', content: 'Please search for something' },
      { speaker: 'ai', content: [toolRequest] },
      { speaker: 'tool', content: [toolResponse] },
      { speaker: 'ai', content: 'Here are the results' },
    ];

    const converted = convertMessage(messages);

    expect(converted).toHaveLength(4);
    expect(converted[0].role).toBe('user');
    expect(converted[0].content).toBe('Please search for something');

    expect(converted[1].role).toBe('assistant');
    expect(converted[1].content[0].type).toBe('tool-call');
    expect(converted[1].content[0].toolCallId).toBe('req-123');
    expect(converted[1].content[0].toolName).toBe('search');
    expect(converted[1].content[0].input).toEqual({ query: 'test', limit: 10 });

    expect(converted[2].role).toBe('tool');
    expect(converted[2].content[0].type).toBe('tool-result');
    expect(converted[2].content[0].toolCallId).toBe('req-123');
    expect(converted[2].content[0].toolName).toBe('search');
    expect(converted[2].content[0].result).toBe('Search completed successfully');

    expect(converted[3].role).toBe('assistant');
    expect(converted[3].content).toBe('Here are the results');
  });

  test('pomlMessagesToVercelMessage with rich content tool response', () => {
    // Mock helper function for rich content conversion
    const richContentToToolResult = (content: any) => {
      if (typeof content === 'string') {
        return content;
      }
      const convertedContent = content.map((part: any) => {
        if (typeof part === 'string') {
          return { type: 'text', text: part };
        } else if (part.type?.startsWith('image/')) {
          return { type: 'image', image: part.base64 };
        } else if (part.type === 'application/json') {
          return { type: 'text', text: JSON.stringify(part.content, null, 2) };
        } else {
          return { type: 'text', text: `[${part.type}]` };
        }
      });
      if (convertedContent.length === 1 && convertedContent[0].type === 'text') {
        return convertedContent[0].text;
      }
      return convertedContent;
    };

    // Test tool response with mixed rich content
    const toolResponseWithRichContent = {
      type: 'application/vnd.poml.toolresponse' as const,
      id: 'req-456',
      name: 'analyze_image',
      content: [
        'Analysis results:',
        {
          type: 'image/png',
          base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          alt: 'chart',
        },
        'The trend is positive.',
      ],
    };

    const result = richContentToToolResult(toolResponseWithRichContent.content);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'text', text: 'Analysis results:' });
    expect(result[1]).toEqual({
      type: 'image',
      image: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    });
    expect(result[2]).toEqual({ type: 'text', text: 'The trend is positive.' });

    // Test tool response with single text content
    const toolResponseWithText = {
      type: 'application/vnd.poml.toolresponse' as const,
      id: 'req-789',
      name: 'search',
      content: 'Simple text result',
    };

    const textResult = richContentToToolResult(toolResponseWithText.content);
    expect(textResult).toBe('Simple text result');

    // Test tool response with single text in array (should be simplified)
    const toolResponseWithSingleText = {
      type: 'application/vnd.poml.toolresponse' as const,
      id: 'req-999',
      name: 'process',
      content: ['Single line result'],
    };

    const singleTextResult = richContentToToolResult(toolResponseWithSingleText.content);
    expect(singleTextResult).toBe('Single line result');
  });
});

describe('examples correctness', () => {
  beforeAll(() => {
    spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  // Dynamically generate tests for all .poml files in the examples folder
  const examplesDir = path.resolve(__dirname, '../../../examples');
  const expectsDir = path.join(examplesDir, 'expects');
  const exampleFiles = fs
    .readdirSync(examplesDir)
    .filter((file) => file.endsWith('.poml'))
    .sort(); // Sort for consistent test order

  exampleFiles.forEach((fileName) => {
    test(`${fileName} produces correct output`, async () => {
      // FIXME: Skip 301_generate_poml on Windows due to CRLF handling issue
      if (process.platform === 'win32' && fileName === '301_generate_poml.poml') {
        console.warn('Skipping 301_generate_poml on Windows due to CRLF handling issue in txt files');
        return;
      }

      const filePath = path.join(examplesDir, fileName);
      const expectFile = path.join(expectsDir, fileName.replace('.poml', '.txt'));

      if (!fs.existsSync(expectFile)) {
        throw new Error(`Expected output file not found: ${expectFile}`);
      }

      // Get actual result
      let actualResult: any;
      const originalWrite = process.stdout.write;
      const outputs: string[] = [];

      const contextFilePath = path.join(examplesDir, fileName.replace('.poml', '.context.json'));

      process.stdout.write = jest.fn((str: string) => {
        outputs.push(str);
        return true;
      });

      try {
        await commandLine({
          file: filePath,
          speakerMode: true,
          contextFile: fs.existsSync(contextFilePath) ? contextFilePath : undefined,
        });

        const output = outputs.join('');
        actualResult = JSON.parse(output)['messages'];
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
