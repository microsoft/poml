import * as React from 'react';

import { describe, expect, test } from '@jest/globals';
import * as essentials from 'poml/essentials';
import { poml } from 'poml';

describe('essentials', () => {
  test('endToEnd', async () => {
    const markup = (
      <essentials.Text syntax="markdown">
        <essentials.Paragraph>Hello, world!</essentials.Paragraph>
        <essentials.Code inline={false}>c += 1</essentials.Code>
      </essentials.Text>
    );
    const result = await poml(markup);
    expect(result).toBe('Hello, world!\n\n```\nc += 1\n```');
  });

  test('data-obj', async () => {
    const markup = <essentials.Object data={{ name: 'world' }} />;
    const result = await poml(markup);
    expect(result).toBe('{\n  "name": "world"\n}');
  });

  test('image', async () => {
    const imagePath = __dirname + '/assets/tomCat.jpg';

    const markup = <essentials.Image src={imagePath} alt="example" />;
    const result = await poml(markup);
    expect(result.length).toBe(1);
    expect((result[0] as any).type).toBe('image/jpeg');
    expect((result[0] as any).base64).toBeTruthy();
    expect((result[0] as any).alt).toBe('example');

    const markupInsideText = (
      <essentials.Text syntax="markdown">
        <essentials.Image src={imagePath} />
      </essentials.Text>
    );
    const result2 = await poml(markupInsideText);
    expect(result2.length).toBe(1);
    expect((result2[0] as any).type).toBe('image/jpeg');
    expect((result2[0] as any).base64).toBeTruthy();
  });

  test('image markdown', async () => {
    const imagePath = __dirname + '/assets/tomCat.jpg';

    const markup = (
      <essentials.Text syntax="markdown">
        <essentials.Image src={imagePath} alt="example" syntax="markdown" />
      </essentials.Text>
    );
    const result = await poml(markup);
    expect(result).toBe('example');

    const syntaxViaStylesheet = `<poml><img src="${imagePath}" alt="example" /><stylesheet>{"image":{"syntax":"markdown"}}</stylesheet></poml>`;
    const result2 = await poml(syntaxViaStylesheet);
    expect(result2).toBe('example');
  });

  test('audio', async () => {
    const audioPath = __dirname + '/assets/audioThreeSeconds.mp3';
    const markup = <essentials.Audio src={audioPath} />;
    const result = await poml(markup);
    expect(result.length).toBe(1);
    expect((result[0] as any).type).toBe('audio/mpeg');
    expect((result[0] as any).base64).toBeTruthy();
  });

  test('writer options', async () => {
    const header = (
      <essentials.Header writerOptions={{ markdownBaseHeaderLevel: 3 }}>Header</essentials.Header>
    );
    const result = await poml(header);
    expect(result).toBe('### Header');
  });
});
