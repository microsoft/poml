import * as React from 'react';

import { describe, expect, test } from '@jest/globals';
import * as essentials from 'poml/essentials';
import { poml } from 'poml';
import { ErrorCollection } from 'poml/base';

describe('essentials', () => {
  test('endToEnd', async () => {
    const markup = (
      <essentials.Text syntax='markdown'>
        <essentials.Paragraph>Hello, world!</essentials.Paragraph>
        <essentials.Code inline={false}>c += 1</essentials.Code>
      </essentials.Text>
    );
    const result = await poml(markup);
    expect(result).toBe('Hello, world!\n\n```\nc += 1\n```');
  });

  test('data-obj', async () => {
    const markup = <essentials.DataObject data={{ name: 'world' }} />;
    const result = await poml(markup);
    expect(result).toBe('{\n  "name": "world"\n}');
  });

  test('image', async () => {
    const imagePath = __dirname + '/assets/tomCat.jpg';

    const markup = <essentials.Image src={imagePath} alt='example' />;
    const result = await poml(markup);
    expect(result.length).toBe(1);
    expect((result[0] as any).type).toBe('image/jpeg');
    expect((result[0] as any).base64).toBeTruthy();
    expect((result[0] as any).alt).toBe('example');

    const markupInsideText = (
      <essentials.Text syntax='markdown'>
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
      <essentials.Text syntax='markdown'>
        <essentials.Image src={imagePath} alt='example' syntax='markdown' />
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
    const header = <essentials.Header writerOptions={{ markdownBaseHeaderLevel: 3 }}>Header</essentials.Header>;
    const result = await poml(header);
    expect(result).toBe('### Header');
  });

  test('tool request', async () => {
    const markup = (
      <essentials.ToolRequest id='test-123' name='search' parameters={{ query: 'hello world', limit: 10 }} />
    );
    const result = await poml(markup);
    expect(result.length).toBe(1);
    expect((result[0] as any).type).toBe('application/vnd.poml.toolrequest');
    expect((result[0] as any).id).toBe('test-123');
    expect((result[0] as any).name).toBe('search');
    expect((result[0] as any).content).toEqual({ query: 'hello world', limit: 10 });
  });

  test('tool response', async () => {
    const markup = (
      <essentials.ToolResponse id='test-123' name='search'>
        <essentials.Paragraph>Found 3 results:</essentials.Paragraph>
        <essentials.List>
          <essentials.ListItem>Result 1</essentials.ListItem>
          <essentials.ListItem>Result 2</essentials.ListItem>
        </essentials.List>
      </essentials.ToolResponse>
    );
    const result = await poml(markup);
    expect(result.length).toBe(1);
    expect((result[0] as any).type).toBe('application/vnd.poml.toolresponse');
    expect((result[0] as any).id).toBe('test-123');
    expect((result[0] as any).name).toBe('search');
    expect((result[0] as any).content).toMatch(/Found 3 results:/);
    expect((result[0] as any).content).toMatch(/- Result 1/);
  });

  test('tool request in markdown', async () => {
    const markup = (
      <essentials.Text syntax='markdown'>
        <essentials.Paragraph>Making a tool call:</essentials.Paragraph>
        <essentials.ToolRequest id='call-456' name='calculate' parameters={{ expression: '2 + 2' }} />
        <essentials.Paragraph>Done.</essentials.Paragraph>
      </essentials.Text>
    );
    const result = await poml(markup);
    expect(result.length).toBe(3);
    expect(result[0]).toBe('Making a tool call:');
    expect((result[1] as any).type).toBe('application/vnd.poml.toolrequest');
    expect((result[1] as any).id).toBe('call-456');
    expect((result[1] as any).name).toBe('calculate');
    expect((result[1] as any).content).toEqual({ expression: '2 + 2' });
    expect(result[2]).toBe('Done.');
  });

  test('tool response in markdown', async () => {
    const markup = (
      <essentials.Text syntax='markdown'>
        <essentials.Paragraph>Tool response:</essentials.Paragraph>
        <essentials.ToolResponse id='call-456' name='calculate'>
          <essentials.Paragraph>
            The result is <essentials.Bold>4</essentials.Bold>
          </essentials.Paragraph>
        </essentials.ToolResponse>
        <essentials.Paragraph>Complete.</essentials.Paragraph>
      </essentials.Text>
    );
    const result = await poml(markup);
    expect(result.length).toBe(3);
    expect(result[0]).toBe('Tool response:');
    expect((result[1] as any).type).toBe('application/vnd.poml.toolresponse');
    expect((result[1] as any).id).toBe('call-456');
    expect((result[1] as any).name).toBe('calculate');
    expect((result[1] as any).content).toMatch(/The result is \*\*4\*\*/);
    expect(result[2]).toBe('Complete.');
  });

  test('tool request fallback rendering', async () => {
    const markup = (
      <essentials.Text syntax='json'>
        <essentials.ToolRequest id='test-789' name='format' parameters={{ type: 'json', indent: 2 }} />
      </essentials.Text>
    );
    ErrorCollection.clear();
    await expect(() => poml(markup)).rejects.toThrow();
  });
});
