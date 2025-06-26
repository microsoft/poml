import * as React from 'react';

import { describe, expect, test } from '@jest/globals';
import { MarkdownWriter, JsonWriter, MultiMediaWriter, YamlWriter, XmlWriter } from 'poml/writer';
import { readFileSync } from 'fs';
import { ErrorCollection } from 'poml/base';

describe('markdown', () => {
  test('markdownSimple', () => {
    const writer = new MarkdownWriter();
    const testIr = `<p><p>hello <b>world</b><nl count="4"/>hahaha</p><h level="3">heading</h><p>new paragraph <code inline="false"> this code </code></p><code lang="ts">console.log("hello world")</code></p>`;
    const result = writer.write(testIr);
    expect(result).toBe(
      'hello **world**\n\n\n\nhahaha\n\n### heading\n\nnew paragraph \n\n```\n this code \n```\n\n`console.log("hello world")`'
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
      { startIndex: 0, endIndex: 28, content: 'hello world ' },
      { startIndex: 15, endIndex: 24, content: '**foo**' }
    ]);
  });

  test('markdownSourceMapWithSpeaker', () => {
    const writer = new MarkdownWriter();
    const withSpeaker = `<p><p speaker="system">hello world</p><p speaker="human">foo bar</p><p>something</p></p>`;
    const result = writer.writeWithSourceMap(withSpeaker);
    expect(result).toStrictEqual([
      { startIndex: 3, endIndex: 37, content: 'hello world' },
      { startIndex: 0, endIndex: 87, content: '\n\n' },
      { startIndex: 38, endIndex: 67, content: 'foo bar' },
      { startIndex: 0, endIndex: 87, content: '\n\n' },
      { startIndex: 68, endIndex: 83, content: 'something' }
    ]);
  });

  test('markdownMessagesSourceMap', () => {
    const writer = new MarkdownWriter();
    const withSpeaker = `<p><p speaker="system">hello world</p><p speaker="human">foo bar</p><p>something</p></p>`;
    const result = writer.writeMessagesWithSourceMap(withSpeaker);
    expect(result).toStrictEqual([
      {
        startIndex: 3,
        endIndex: 37,
        speaker: 'system',
        content: [{ startIndex: 3, endIndex: 37, content: 'hello world' }]
      },
      {
        startIndex: 38,
        endIndex: 83,
        speaker: 'human',
        content: [
          { startIndex: 38, endIndex: 67, content: 'foo bar' },
          { startIndex: 0, endIndex: 87, content: '\n\n' },
          { startIndex: 68, endIndex: 83, content: 'something' }
        ]
      }
    ]);
  });

  test('markdownWriteMatchesSegments', () => {
    const writer = new MarkdownWriter();
    const ir = `<p><p speaker="human">hello</p><p>world</p></p>`;
    const direct = writer.write(ir);
    const segs = writer.writeWithSourceMap(ir);
    const reconstructed = (writer as any).richContentFromSourceMap(segs);
    expect(direct).toStrictEqual(reconstructed);
  });

  test('markdownWriteMessagesMatchesSegments', () => {
    const writer = new MarkdownWriter();
    const ir = `<p><p speaker="system">hello</p><p speaker="ai">world</p></p>`;
    const direct = writer.writeMessages(ir);
    const segs = writer.writeMessagesWithSourceMap(ir);
    const reconstructed = segs.map(m => ({
      speaker: m.speaker,
      content: (writer as any).richContentFromSourceMap(m.content)
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
      { startIndex: 0, endIndex: rootEnd, content: 'hello' },
      { startIndex: imgStart, endIndex: imgEnd, content: [{ type: 'image', base64, alt: 'img' }] },
      { startIndex: 0, endIndex: rootEnd, content: 'world' }
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
        startIndex: humanStart,
        endIndex: humanEnd,
        speaker: 'human',
        content: [{ startIndex: humanStart, endIndex: humanEnd, content: 'hello' }]
      },
      {
        startIndex: aiStart,
        endIndex: aiEnd,
        speaker: 'ai',
        content: [
          { startIndex: imgStart, endIndex: imgEnd, content: [{ type: 'image', base64, alt: 'img' }] },
          { startIndex: aiStart, endIndex: aiEnd, content: 'world' }
        ]
      }
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
        startIndex: humanStart,
        endIndex: humanEnd,
        speaker: 'human',
        content: [
          { startIndex: img1Start, endIndex: img1End, content: [{ type: 'image', base64, alt: 'img1' }] },
          { startIndex: humanStart, endIndex: humanEnd, content: 'Hello' }
        ]
      },
      {
        startIndex: aiStart,
        endIndex: aiEnd,
        speaker: 'ai',
        content: [
          { startIndex: img2Start, endIndex: img2End, content: [{ type: 'image', base64, alt: 'img2' }] },
          { startIndex: aiStart, endIndex: aiEnd, content: 'World' }
        ]
      }
    ]);
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
  })
})

describe('multimedia', () => {
  test('image', () => {
    const writer = new MultiMediaWriter();
    const base64 = readFileSync(__dirname + '/assets/tomCat.jpg').toString('base64');
    const testIr = `<env presentation="multimedia"><img base64="${base64}" alt="example"/></env>`;
    ErrorCollection.clear();
    const result = writer.write(testIr);
    expect(ErrorCollection.empty()).toBe(true);
    expect(result).toStrictEqual([
      { type: 'image', base64, alt: 'example' }
    ]);
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
      { type: 'image', base64, alt: 'example2' }
    ]);

    const ir2 = `<env presentation="markup" markup-lang="markdown">hello\nworld<env presentation="multimedia"><img base64="${base64}" alt="example1"/></env><p>hahaha</p><env presentation="multimedia"><img base64="${base64}" alt="example2"/></env></env>`;
    const result2 = writer.write(ir2);
    expect(result2).toStrictEqual([
      'hello\nworld',
      { type: 'image', base64, alt: 'example1' },
      'hahaha',
      { type: 'image', base64, alt: 'example2' }
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
      { type: 'image', base64, alt: 'example2' }
    ]);
  })
})