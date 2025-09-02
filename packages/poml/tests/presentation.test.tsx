import * as React from 'react';

import { describe, expect, test } from '@jest/globals';

import { read } from 'poml';
import { Free, Markup, Serialize } from 'poml/presentation';

describe('markup presentation', () => {
  test('env', async () => {
    const env = <Markup.Environment>hahaha</Markup.Environment>;
    expect(await read(env)).toBe('<env presentation="markup" markup-lang="markdown">hahaha</env>');
  });

  test('paragraph', async () => {
    const paragraph = <Markup.Paragraph>hahaha</Markup.Paragraph>;
    expect(await read(paragraph)).toBe('<env presentation="markup" markup-lang="markdown"><p>hahaha</p></env>');
  });

  test('markupLang', async () => {
    const paragraph = <Markup.Paragraph markupLang='html'>hahaha</Markup.Paragraph>;
    expect(await read(paragraph)).toBe('<env presentation="markup" markup-lang="html"><p>hahaha</p></env>');
    const nested = (
      <Markup.Paragraph markupLang='html'>
        hahaha<Markup.Paragraph markupLang='html'>dadada</Markup.Paragraph>
      </Markup.Paragraph>
    );
    expect(await read(nested)).toBe('<env presentation="markup" markup-lang="html"><p>hahaha<p>dadada</p></p></env>');
    const nestedEnv = <Markup.Environment>{nested}</Markup.Environment>;
    expect(await read(nestedEnv)).toBe(
      '<env presentation="markup" markup-lang="markdown"><env presentation="markup" markup-lang="html"><p>hahaha<p>dadada</p></p></env></env>',
    );
  });
});

describe('markdown json hybrid', () => {
  test('env', async () => {
    const env = (
      <Markup.Environment>
        <Serialize.Environment>
          <Serialize.Any name='hello'>world</Serialize.Any>
        </Serialize.Environment>
      </Markup.Environment>
    );
    expect(await read(env)).toBe(
      '<env presentation="markup" markup-lang="markdown"><code inline="false" lang="json"><env presentation="serialize" serializer="json"><any name="hello">world</any></env></code></env>',
    );
  });

  test('envInline', async () => {
    const env = (
      <Markup.Environment>
        <Serialize.Environment inline={true}>
          <Serialize.Any name='hello'>world</Serialize.Any>
        </Serialize.Environment>
      </Markup.Environment>
    );
    expect(await read(env)).toBe(
      '<env presentation="markup" markup-lang="markdown"><code inline="true" lang="json"><env presentation="serialize" serializer="json"><any name="hello">world</any></env></code></env>',
    );
  });

  test('jsonMarkdown', async () => {
    const env = (
      <Serialize.Environment>
        <Serialize.Any name='hello'>
          <Markup.Paragraph>world</Markup.Paragraph>
        </Serialize.Any>
      </Serialize.Environment>
    );
    expect(await read(env)).toBe(
      '<env presentation="serialize" serializer="json"><any name="hello"><env presentation="markup" markup-lang="markdown"><p>world</p></env></any></env>',
    );
  });
});

describe('free', () => {
  test('freeEnv', async () => {
    const env = <Free.Environment>{'hello\nworld'}</Free.Environment>;
    expect(await read(env)).toBe('<env presentation="free" white-space="pre">hello\nworld</env>');
  });

  test('freeText', async () => {
    const text = <Free.Text>{'hello\nworld'}</Free.Text>;
    expect(await read(text)).toBe(
      '<env presentation="free" white-space="pre"><text white-space="pre">hello\nworld</text></env>',
    );
  });

  test('freeInlineInMarkup', async () => {
    const env = (
      <Markup.Environment>
        <Free.Environment inline={true}>hello</Free.Environment>
      </Markup.Environment>
    );
    expect(await read(env)).toBe(
      '<env presentation="markup" markup-lang="markdown"><code inline="true"><env presentation="free" white-space="pre">hello</env></code></env>',
    );
  });
});
