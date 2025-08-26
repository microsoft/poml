import * as React from 'react';
import { describe, expect, test } from '@jest/globals';
import { poml, read, write } from 'poml';
import { ErrorCollection, ReadError, component, unregisterComponent } from 'poml/base';

describe('meta tag', () => {
  test('version check pass', async () => {
    const result = await poml('<meta minVersion="0.0.1" maxVersion="999.0.0"/><p>hi</p>');
    expect(result).toBe('hi');
  });

  test('version check fail', async () => {
    const fn = async () => {
      ErrorCollection.clear();
      await read('<meta minVersion="9.9.9"/><p>hi</p>');
      if (!ErrorCollection.empty()) {
        throw ErrorCollection.first();
      }
    };
    await expect(fn).rejects.toThrow(ReadError);
  });

  test('disable component', async () => {
    const fn = async () => {
      ErrorCollection.clear();
      await read('<poml><meta components="-table"/><table records="a,b\n1,2" parser="csv"/></poml>');
      if (!ErrorCollection.empty()) {
        throw ErrorCollection.first();
      }
    };
    await expect(fn).rejects.toThrow(ReadError);
  });

  test('re-enable component', async () => {
    const result = write(
      await read(
        '<poml><meta components="-table"/><meta components="+table"/><table records="a,b\n1,2" parser="csv"/></poml>',
      ),
    );
    expect(result).toMatch(/\|/);
  });

  test('disable alias only', async () => {
    const Hello = component('Hello', { aliases: ['hi'] })(() => {
      return <p>hi</p>;
    });
    const fail = async () => {
      ErrorCollection.clear();
      await read('<poml><meta components="-hi"/><hi/></poml>');
      if (!ErrorCollection.empty()) {
        throw ErrorCollection.first();
      }
    };
    await expect(fail).rejects.toThrow(ReadError);

    const ok = await read('<poml><meta components="-hi"/><Hello/></poml>');
    expect(ok).toContain('hi');
    unregisterComponent('Hello');
  });
});
