import * as React from 'react';

import { describe, expect, test } from '@jest/globals';
import { MarkdownWriter, JsonWriter, MultiMediaWriter, YamlWriter, XmlWriter } from 'poml/writer';
import * as cheerio from 'cheerio';
import { readFileSync } from 'fs';
import {
  ContentMultiMediaBinary,
  ContentMultiMediaToolResponse,
  ErrorCollection,
  richContentFromSourceMap,
} from 'poml/base';

describe('markdown', () => {
  test('markdownSimple', () => {
    const writer = new MarkdownWriter();
    const testIr = `<p><p>hello <b>world</b><nl count="4"/>hahaha</p><h level="3">heading</h><p>new paragraph <code inline="false"> this code </code></p><code lang="ts">console.log("hello world")</code></p>`;
    const result = writer.write(testIr);
    expect(result).toBe(
      'hello **world**\n\n\n\nhahaha\n\n### heading\n\nnew paragraph \n\n```\n this code \n```\n\n`console.log("hello world")`',
    );
  });

  // test('markdownSpace', () => {
  //   const tests = [
  //     {
  //       ir: '<p>hello <!-- comment --> <b>world</b></p>',
  //       result: 'hello **world**'
  //     },
  //     {
  //       ir: '<p>hello <b>world</b>foo</p>',
  //       result: 'hello **world**foo'
  //     },
  //     {
  //       ir: '<p>hello <nl count="2"/> world</p>',
  //       result: 'hello\n\nworld'
  //     },
  //     {
  //       ir: '<p><p>hello <nl count="1"/></p><p>world</p></p>',
  //       result: 'hello\n\nworld'
  //     },
  //     {
  //       ir: '<p><p>hello</p>  <nl count="3"/>  <!-- --> <p> <!-- --> world</p></p>',
  //       result: 'hello\n\n\nworld'
  //     }
  //   ];

  //   for (const test of tests) {
  //     const writer = new MarkdownWriter();
  //     const result = writer.write(test.ir);
  //     // expect(result).toBe(test.result);
  //     console.log(result);
  //   }
  // })

  test('markdownWithEnv', () => {
    const writer = new MarkdownWriter();
    const testEnv = `<p>hello world<code inline="false"><env presentation="serialize"><any name="hello">world</any></p>`;
    const result = writer.write(testEnv);
    expect(result).toBe('hello world\n\n```\n{\n  "hello": "world"\n}\n```');
  });

  test('markdownSourceMapSimple', () => {
    const writer = new MarkdownWriter();
    const simple = `<p>hello world <b>foo</b></p>`;
    const result = writer.writeWithSourceMap(simple);
    expect(result).toStrictEqual([
      { startIndex: 0, endIndex: 0, irStartIndex: 0, irEndIndex: 28, content: 'hello world ' },
      { startIndex: 0, endIndex: 0, irStartIndex: 15, irEndIndex: 24, content: '**foo**' },
    ]);
  });

  test('markdownSourceMapWithSpeaker', () => {
    const writer = new MarkdownWriter();
    const withSpeaker = `<p><p speaker="system">hello world</p><p speaker="human">foo bar</p><p>something</p></p>`;
    const result = writer.writeWithSourceMap(withSpeaker);
    expect(result).toStrictEqual([
      { startIndex: 0, endIndex: 0, irStartIndex: 3, irEndIndex: 37, content: 'hello world' },
      { startIndex: 0, endIndex: 0, irStartIndex: 0, irEndIndex: 87, content: '\n\n' },
      { startIndex: 0, endIndex: 0, irStartIndex: 38, irEndIndex: 67, content: 'foo bar' },
      { startIndex: 0, endIndex: 0, irStartIndex: 0, irEndIndex: 87, content: '\n\n' },
      { startIndex: 0, endIndex: 0, irStartIndex: 68, irEndIndex: 83, content: 'something' },
    ]);
  });

  test('markdownMessagesSourceMap', () => {
    const writer = new MarkdownWriter();
    const withSpeaker = `<p><p speaker="system">hello world</p><p speaker="human">foo bar</p><p>something</p></p>`;
    const result = writer.writeMessagesWithSourceMap(withSpeaker);
    expect(result).toStrictEqual([
      {
        startIndex: 0,
        endIndex: 0,
        irStartIndex: 3,
        irEndIndex: 37,
        speaker: 'system',
        content: [{ startIndex: 0, endIndex: 0, irStartIndex: 3, irEndIndex: 37, content: 'hello world' }],
      },
      {
        startIndex: 0,
        endIndex: 0,
        irStartIndex: 38,
        irEndIndex: 83,
        speaker: 'human',
        content: [
          { startIndex: 0, endIndex: 0, irStartIndex: 38, irEndIndex: 67, content: 'foo bar' },
          { startIndex: 0, endIndex: 0, irStartIndex: 0, irEndIndex: 87, content: '\n\n' },
          { startIndex: 0, endIndex: 0, irStartIndex: 68, irEndIndex: 83, content: 'something' },
        ],
      },
    ]);
  });

  test('emptyMessages', () => {
    // Turn off console.warn in this test case.
    const originalWarn = console.warn;
    try {
      console.warn = (m, ...a) => {
        if (m.includes('output')) {
          return;
        }
        originalWarn(m, ...a);
      };
      const writer = new MarkdownWriter();
      const ir = `<p><p speaker="human"></p><p speaker="ai"></p></p>`;
      const direct = writer.writeMessages(ir);
      const segs = writer.writeMessagesWithSourceMap(ir);
      const reconstructed = segs.map((m) => ({
        speaker: m.speaker,
        content: richContentFromSourceMap(m.content),
      }));
      expect(direct).toStrictEqual(reconstructed);
      expect(segs).toStrictEqual([
        { startIndex: 0, endIndex: 0, irStartIndex: 0, irEndIndex: 0, speaker: 'human', content: [] },
      ]);
    } finally {
      console.warn = originalWarn; // Restore console.warn
    }
  });

  test('markdownWriteMatchesSegments', () => {
    const writer = new MarkdownWriter();
    const ir = `<p><p speaker="human">hello</p><p>world</p></p>`;
    const direct = writer.write(ir);
    const segs = writer.writeWithSourceMap(ir);
    const reconstructed = richContentFromSourceMap(segs);
    expect(direct).toStrictEqual(reconstructed);
  });

  test('markdownWriteMessagesMatchesSegments', () => {
    const writer = new MarkdownWriter();
    const ir = `<p><p speaker="system">hello</p><p speaker="ai">world</p></p>`;
    const direct = writer.writeMessages(ir);
    const segs = writer.writeMessagesWithSourceMap(ir);
    const reconstructed = segs.map((m) => ({
      speaker: m.speaker,
      content: richContentFromSourceMap(m.content),
    }));
    expect(direct).toStrictEqual(reconstructed);
  });

  test('markdownSourceMapMultimedia', () => {
    const writer = new MarkdownWriter();
    const base64 = readFileSync(__dirname + '/assets/tomCat.jpg').toString('base64');
    const ir = `<p>hello<env presentation="multimedia"><img base64="${base64}" alt="img"/></env>world</p>`;
    const segs = writer.writeWithSourceMap(ir);
    const rootEnd = ir.length - 1;
    const imgStart = ir.indexOf('<img');
    const imgEnd = ir.indexOf('/>', imgStart) + 1;
    expect(segs).toStrictEqual([
      { startIndex: 0, endIndex: 0, irStartIndex: 0, irEndIndex: rootEnd, content: 'hello' },
      {
        startIndex: 0,
        endIndex: 0,
        irStartIndex: imgStart,
        irEndIndex: imgEnd,
        content: [{ type: 'image', base64, alt: 'img' }],
      },
      { startIndex: 0, endIndex: 0, irStartIndex: 0, irEndIndex: rootEnd, content: 'world' },
    ]);
  });

  test('markdownMessagesSourceMapMultimedia', () => {
    const writer = new MarkdownWriter();
    const base64 = readFileSync(__dirname + '/assets/tomCat.jpg').toString('base64');
    const ir = `<p><p speaker="human">hello</p><p speaker="ai"><env presentation="multimedia"><img base64="${base64}" alt="img"/></env>world</p></p>`;
    const segs = writer.writeMessagesWithSourceMap(ir);
    const humanStart = ir.indexOf('<p speaker="human"');
    const humanEnd = ir.indexOf('</p>', humanStart) + '</p>'.length - 1;
    const aiStart = ir.indexOf('<p speaker="ai"');
    const aiEnd = ir.indexOf('</p>', aiStart) + '</p>'.length - 1;
    const imgStart = ir.indexOf('<img');
    const imgEnd = ir.indexOf('/>', imgStart) + 1;
    const rootEnd = ir.length - 1;
    expect(segs).toStrictEqual([
      {
        startIndex: 0,
        endIndex: 0,
        irStartIndex: humanStart,
        irEndIndex: humanEnd,
        speaker: 'human',
        content: [
          {
            startIndex: 0,
            endIndex: 0,
            irStartIndex: humanStart,
            irEndIndex: humanEnd,
            content: 'hello',
          },
        ],
      },
      {
        startIndex: 0,
        endIndex: 0,
        irStartIndex: aiStart,
        irEndIndex: aiEnd,
        speaker: 'ai',
        content: [
          {
            startIndex: 0,
            endIndex: 0,
            irStartIndex: imgStart,
            irEndIndex: imgEnd,
            content: [{ type: 'image', base64, alt: 'img' }],
          },
          { startIndex: 0, endIndex: 0, irStartIndex: aiStart, irEndIndex: aiEnd, content: 'world' },
        ],
      },
    ]);
  });

  test('markdownMessagesSourceMapImagePosition', () => {
    const writer = new MarkdownWriter();
    const base64 = readFileSync(__dirname + '/assets/tomCat.jpg').toString('base64');
    const ir = `<p><p speaker="human"><env presentation="multimedia"><img base64="${base64}" alt="img1" position="top"/></env>Hello</p><p speaker="ai"><env presentation="multimedia"><img base64="${base64}" alt="img2" position="top"/></env>World</p></p>`;
    const segs = writer.writeMessagesWithSourceMap(ir);
    const humanStart = ir.indexOf('<p speaker="human"');
    const humanEnd = ir.indexOf('</p>', humanStart) + '</p>'.length - 1;
    const aiStart = ir.indexOf('<p speaker="ai"');
    const aiEnd = ir.indexOf('</p>', aiStart) + '</p>'.length - 1;
    const img1Start = ir.indexOf('<img', humanStart);
    const img1End = ir.indexOf('/>', img1Start) + 1;
    const img2Start = ir.indexOf('<img', aiStart);
    const img2End = ir.indexOf('/>', img2Start) + 1;
    expect(segs).toStrictEqual([
      {
        startIndex: 0,
        endIndex: 0,
        irStartIndex: humanStart,
        irEndIndex: humanEnd,
        speaker: 'human',
        content: [
          {
            startIndex: 0,
            endIndex: 0,
            irStartIndex: img1Start,
            irEndIndex: img1End,
            content: [{ type: 'image', base64, alt: 'img1' }],
          },
          {
            startIndex: 0,
            endIndex: 0,
            irStartIndex: humanStart,
            irEndIndex: humanEnd,
            content: 'Hello',
          },
        ],
      },
      {
        startIndex: 0,
        endIndex: 0,
        irStartIndex: aiStart,
        irEndIndex: aiEnd,
        speaker: 'ai',
        content: [
          {
            startIndex: 0,
            endIndex: 0,
            irStartIndex: img2Start,
            irEndIndex: img2End,
            content: [{ type: 'image', base64, alt: 'img2' }],
          },
          { startIndex: 0, endIndex: 0, irStartIndex: aiStart, irEndIndex: aiEnd, content: 'World' },
        ],
      },
    ]);
  });

  test('markdownCharLimit', () => {
    const writer = new MarkdownWriter();
    const ir = `<p char-limit="5">helloworld</p>`;
    const result = writer.write(ir);
    expect(result).toBe('hello (...truncated)');
  });

  test('freeCharLimit', () => {
    const writer = new MarkdownWriter();
    const ir = `<p><env presentation="free" char-limit="4">abcdefg</env></p>`;
    const result = writer.write(ir);
    expect(result).toBe('abcd (...truncated)');
  });

  test('markdownCharLimitStart', () => {
    const writer = new MarkdownWriter(undefined, { truncateDirection: 'start' } as any);
    const ir = `<p char-limit="5">helloworld</p>`;
    const result = writer.write(ir);
    expect(result).toBe(' (...truncated)world');
  });

  test('markdownCharLimitMiddleCustomMarker', () => {
    const writer = new MarkdownWriter(undefined, { truncateDirection: 'middle', truncateMarker: '[cut]' } as any);
    const ir = `<p char-limit="5">helloworld</p>`;
    const result = writer.write(ir);
    expect(result).toBe('hel[cut]ld');
  });

  test('markdownPriorityProperty', () => {
    const writer: any = new MarkdownWriter();
    const $ = cheerio.load(
      '<p priority="2">abc</p>',
      { xml: { xmlMode: true, withStartIndices: true, withEndIndices: true } },
      false,
    );
    const box = writer.makeBox('abc', 'inline', $('p'));
    expect(box.priority).toBe(2);
  });

  test('markdownPriorityRemoval', () => {
    const writer = new MarkdownWriter();
    const ir = '<p char-limit="5"><span priority="1">hello</span><span priority="2">world</span></p>';
    const result = writer.write(ir);
    expect(result).toBe('world');
  });

  test('markdownPriorityTruncateAfterRemoval', () => {
    const writer = new MarkdownWriter();
    const ir = '<p char-limit="3"><span priority="1">ab</span><span priority="1">cd</span></p>';
    const result = writer.write(ir);
    expect(result).toBe('abc (...truncated)');
  });

  test('markdownTokenLimit', () => {
    const writer = new MarkdownWriter();
    const ir = `<p token-limit="1">hello world</p>`;
    const result = writer.write(ir);
    expect(result).toBe('hello (...truncated)');
  });

  test('freeTokenLimit', () => {
    const writer = new MarkdownWriter();
    const ir = `<p><env presentation="free" token-limit="1">hello world</env></p>`;
    const result = writer.write(ir);
    expect(result).toBe('hello (...truncated)');
  });

  test('markdownPriorityRemovalToken', () => {
    const writer = new MarkdownWriter();
    const ir = '<p token-limit="1"><span priority="1">hello</span><span priority="2">world</span></p>';
    const result = writer.write(ir);
    expect(result).toBe('world');
  });

  test('markdownPriorityTokenTruncateAfterRemoval', () => {
    const writer = new MarkdownWriter();
    const ir = '<p token-limit="1"><span priority="1">hi</span><span priority="1">there</span></p>';
    const result = writer.write(ir);
    expect(result).toBe('h (...truncated)');
  });
});

describe('serialize', () => {
  test('jsonSimple', () => {
    const writer = new JsonWriter();
    const testIr = `<any><any name="hello">world</any><any name="foo"><any type="integer">123</any><any type="boolean">false</any></any></any>`;
    const result = writer.write(testIr);
    expect(result).toBe('{\n  "hello": "world",\n  "foo": [\n    123,\n    false\n  ]\n}');
  });

  test('jsonDataObject', () => {
    const writer = new JsonWriter();
    const testIr = `<obj data="{&quot;hello&quot;:&quot;world&quot;,&quot;foo&quot;:[123,false]}"/>`;
    const result = writer.write(testIr);
    expect(result).toBe('{\n  "hello": "world",\n  "foo": [\n    123,\n    false\n  ]\n}');
  });

  test('yaml', () => {
    const writer = new YamlWriter();
    const testIr = `<any><any name="hello">world</any><any name="foo"><any type="integer">123</any><any type="boolean">false</any></any></any>`;
    const result = writer.write(testIr);
    expect(result).toBe('hello: world\nfoo:\n  - 123\n  - false');
  });

  test('xml', () => {
    const writer = new XmlWriter();
    const testIr = `<any><any name="hello">world</any><any name="foo"><any type="integer">123</any><any type="boolean">false</any></any></any>`;
    const result = writer.write(testIr);
    expect(result).toBe('<hello>world</hello>\n<foo>\n  <item>123</item>\n  <item>false</item>\n</foo>');
  });

  test('xmlNestMultimedia', async () => {
    const writer = new XmlWriter();
    const base64 = readFileSync(__dirname + '/assets/tomCat.jpg').toString('base64');
    const imageIr = `<env presentation="multimedia"><img base64="${base64}" alt="example"/></env>`;
    const testIr = `<env presentation="serialize" serializer="xml"><any>${imageIr}</any></env>`;
    ErrorCollection.clear();
    writer.write(testIr);
    expect(ErrorCollection.first().message).toMatch('Invalid presentation:');
  });
});

describe('free', () => {
  test('freeText', () => {
    const writer = new MarkdownWriter();
    const testIr = `<env presentation="free">hello\nworld</env>`;
    const result = writer.write(testIr);
    expect(result).toBe('hello\nworld');

    const testIr2 = `<env presentation="free">hello\nworld<text>\n\n</text>hahaha</env>`;
    const result2 = writer.write(testIr2);
    expect(result2).toBe('hello\nworld\n\nhahaha');
  });

  test('textWithEnv', () => {
    const writer = new MarkdownWriter();
    const testIr = `<env presentation="free">hello\nworld<env presentation="serialize"><any name="hello">world</any></env></env>`;
    const result = writer.write(testIr);
    expect(result).toBe('hello\nworld{\n  "hello": "world"\n}');
  });
});

describe('multimedia', () => {
  test('image', () => {
    const writer = new MultiMediaWriter();
    const base64 = readFileSync(__dirname + '/assets/tomCat.jpg').toString('base64');
    const testIr = `<env presentation="multimedia"><img base64="${base64}" alt="example"/></env>`;
    ErrorCollection.clear();
    const result = writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toStrictEqual([{ type: 'image', base64, alt: 'example' }]);
  });

  test('imageInText', () => {
    const writer = new MarkdownWriter();
    const base64 = readFileSync(__dirname + '/assets/tomCat.jpg').toString('base64');
    const ir1 = `<env presentation="markup" markup-lang="markdown">hello\nworld<env presentation="multimedia"><img base64="${base64}" alt="example1"/><img base64="${base64}" alt="example2"/></env></env>`;
    ErrorCollection.clear();
    const result1 = writer.write(ir1);
    expect(ErrorCollection.empty()).toBe(true);
    expect(result1).toStrictEqual([
      'hello\nworld',
      { type: 'image', base64, alt: 'example1' },
      { type: 'image', base64, alt: 'example2' },
    ]);

    const ir2 = `<env presentation="markup" markup-lang="markdown">hello\nworld<env presentation="multimedia"><img base64="${base64}" alt="example1"/></env><p>hahaha</p><env presentation="multimedia"><img base64="${base64}" alt="example2"/></env></env>`;
    const result2 = writer.write(ir2);
    expect(result2).toStrictEqual([
      'hello\nworld',
      { type: 'image', base64, alt: 'example1' },
      'hahaha',
      { type: 'image', base64, alt: 'example2' },
    ]);
  });

  test('imagePosition', () => {
    const writer = new MarkdownWriter();
    const base64 = readFileSync(__dirname + '/assets/tomCat.jpg').toString('base64');
    const ir = `<env presentation="markup" markup-lang="markdown">hello<env presentation="multimedia"><img base64="${base64}" alt="example1" position="top"/></env>world<p>foo<env presentation="multimedia"><img base64="${base64}" alt="example2" position="bottom"/></env></p></env>`;
    ErrorCollection.clear();
    const result = writer.write(ir);
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toStrictEqual([
      { type: 'image', base64, alt: 'example1' },
      'helloworld\n\nfoo',
      { type: 'image', base64, alt: 'example2' },
    ]);
  });

  test('toolRequest', () => {
    const writer = new MultiMediaWriter();
    const testIr = `<env presentation="multimedia"><toolrequest id="test-123" name="search" content='{"query":"hello","limit":10}'/></env>`;
    ErrorCollection.clear();
    const result = writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toStrictEqual([
      {
        type: 'application/vnd.poml.toolrequest',
        id: 'test-123',
        name: 'search',
        content: { query: 'hello', limit: 10 },
      },
    ]);
  });

  test('toolResponse', () => {
    const writer = new MultiMediaWriter();
    const testIr = `<env presentation="multimedia"><toolresponse id="test-123" name="search"><env presentation="markup" markup-lang="markdown"><p>Found 3 results</p></env></toolresponse></env>`;
    ErrorCollection.clear();
    const result = writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toStrictEqual([
      {
        type: 'application/vnd.poml.toolresponse',
        id: 'test-123',
        name: 'search',
        content: 'Found 3 results',
      },
    ]);
  });

  test('toolResponseWithMixedContent', () => {
    const writer = new MultiMediaWriter();
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const testIr = `<env presentation="multimedia"><toolresponse id="test-123" name="analyze" speaker="tool"><env presentation="markup" markup-lang="markdown"><p>Analysis results:</p><env presentation="multimedia"><img base64="${base64}" alt="chart" position="bottom"/></env><p>Summary: positive trend</p></env></toolresponse></env>`;
    ErrorCollection.clear();
    const result = writer.writeMessages(testIr);
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].speaker).toBe('tool');
    expect(result[0].content).toHaveLength(1);
    const response = result[0].content[0] as ContentMultiMediaToolResponse;
    expect(response.type).toBe('application/vnd.poml.toolresponse');
    expect(response.id).toBe('test-123');
    expect(response.name).toBe('analyze');
    // Content should be an array with text and image
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content).toHaveLength(2);
    expect(response.content[0]).toBe('Analysis results:\n\nSummary: positive trend');
    const subResponse = response.content[1] as ContentMultiMediaBinary;
    expect(subResponse.type).toBe('image');
    expect(subResponse.base64).toBe(base64);
    expect(subResponse.alt).toBe('chart');
  });

  test('toolResponseEmptyContent', () => {
    const writer = new MultiMediaWriter();
    const testIr = `<env presentation="multimedia"><toolresponse id="test-123" name="search"></toolresponse></env>`;
    ErrorCollection.clear();
    const result = writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(false);
    expect(ErrorCollection.first().message).toMatch(/Tool response must have children content/);
  });

  test('toolRequestInText', () => {
    const writer = new MarkdownWriter();
    const ir = `<env presentation="markup" markup-lang="markdown">Calling tool:<env presentation="multimedia"><toolrequest id="call-456" name="calculate" content='{"expression":"2+2"}'/></env>Done.</env>`;
    ErrorCollection.clear();
    const result = writer.write(ir);
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toStrictEqual([
      'Calling tool:',
      {
        type: 'application/vnd.poml.toolrequest',
        id: 'call-456',
        name: 'calculate',
        content: { expression: '2+2' },
      },
      'Done.',
    ]);
  });

  test('toolResponseInText', () => {
    const writer = new MarkdownWriter();
    const ir = `<env presentation="markup" markup-lang="markdown">Response:<env presentation="multimedia"><toolresponse id="call-456" name="calculate"><env presentation="markup" markup-lang="markdown"><p>The result is <b>4</b></p></env></toolresponse></env>Complete.</env>`;
    ErrorCollection.clear();
    const result = writer.write(ir);
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toStrictEqual([
      'Response:',
      {
        type: 'application/vnd.poml.toolresponse',
        id: 'call-456',
        name: 'calculate',
        content: 'The result is **4**',
      },
      'Complete.',
    ]);
  });

  test('toolResponseWithComplexContent', () => {
    const writer = new MultiMediaWriter();
    const testIr = `<env presentation="multimedia"><toolresponse id="complex-123" name="search"><env presentation="markup" markup-lang="markdown"><list><item>Item 1</item><item>Item 2</item></list><p>Total: 2</p></env></toolresponse></env>`;
    ErrorCollection.clear();
    const result = writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(true);
    const content = (result[0] as any).content;
    expect(typeof content).toBe('string');
    expect(content).toMatch(/- Item 1/);
    expect(content).toMatch(/- Item 2/);
    expect(content).toMatch(/Total: 2/);
  });

  test('toolResponseWithMultipleImages', () => {
    const writer = new MultiMediaWriter();
    const base64_1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const base64_2 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const testIr = `<env presentation="multimedia"><toolresponse id="img-123" name="gallery"><env presentation="markup" markup-lang="markdown">
      <p>Image gallery:</p>
      <env presentation="multimedia"><img base64="${base64_1}" alt="img1"/></env>
      <p>First image</p>
      <env presentation="multimedia"><img base64="${base64_2}" alt="img2"/></env>
      <p>Second image</p>
    </env></toolresponse></env>`;
    ErrorCollection.clear();
    const result = writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(true);
    const response = result[0] as any;
    expect(response.type).toBe('application/vnd.poml.toolresponse');
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content).toHaveLength(5);
    expect(response.content[1].type).toBe('image');
    expect(response.content[1].base64).toBe(base64_1);
    expect(response.content[3].type).toBe('image');
    expect(response.content[3].base64).toBe(base64_2);
  });

  test('toolRequestMissingAttributes', () => {
    const writer = new MultiMediaWriter();
    const testIr = `<env presentation="multimedia"><toolrequest name="search" content='{"query":"test"}'/></env>`;
    ErrorCollection.clear();
    writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(false);
    expect(ErrorCollection.first().message).toMatch(/Tool request must have id and name attributes/);
  });

  test('toolResponseMissingAttributes', () => {
    const writer = new MultiMediaWriter();
    const testIr = `<env presentation="multimedia"><toolresponse id="test-123"><env presentation="markup" markup-lang="markdown"><p>Content</p></env></toolresponse></env>`;
    ErrorCollection.clear();
    writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(false);
    expect(ErrorCollection.first().message).toMatch(/Tool response must have id and name attributes/);
  });

  test('toolRequestInvalidJSON', () => {
    const writer = new MultiMediaWriter();
    const testIr = `<env presentation="multimedia"><toolrequest id="test-123" name="search" content='{invalid json}'/></env>`;
    ErrorCollection.clear();
    writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(false);
    expect(ErrorCollection.first().message).toMatch(/Invalid JSON content in tool request/);
  });

  test('mixedMultimediaContent', () => {
    const writer = new MultiMediaWriter();
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const testIr = `<env presentation="multimedia">
      <img base64="${base64}" alt="image1"/>
      <toolrequest id="req-1" name="process" content='{"action":"analyze"}'/>
      <toolresponse id="req-1" name="process"><env presentation="markup" markup-lang="markdown"><p>Analysis complete</p></env></toolresponse>
      <img base64="${base64}" alt="image2"/>
    </env>`;
    ErrorCollection.clear();
    const result = writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toHaveLength(4);
    expect((result[0] as any).type).toBe('image');
    expect((result[1] as any).type).toBe('application/vnd.poml.toolrequest');
    expect((result[2] as any).type).toBe('application/vnd.poml.toolresponse');
    expect((result[3] as any).type).toBe('image');
  });

  test('toolResponseWithSerializedContent', () => {
    const writer = new MultiMediaWriter();
    const testIr = `<env presentation="multimedia"><toolresponse id="data-123" name="getData"><env presentation="serialize" serializer="json"><any name="status">success</any><any name="count">42</any></env></toolresponse></env>`;
    ErrorCollection.clear();
    const result = writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(true);
    const response = result[0] as any;
    expect(response.type).toBe('application/vnd.poml.toolresponse');
    expect(response.content).toBe('{\n  "status": "success",\n  "count": "42"\n}');
  });
});
