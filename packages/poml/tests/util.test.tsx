import * as React from 'react';
import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'fs';
import { component } from 'poml/base';
import { Writable } from 'stream';
import { parseText, readSource } from 'poml/util';
import { preprocessImage } from 'poml/util/image';
import sharp from 'sharp';
import { renderToPipeableStream, renderToString } from 'react-dom/server';
import { reactRender } from 'poml/util/reactRender';

describe('content', () => {
  test('guess type', () => {
    expect(parseText('<p>hello world</p>')).toBe('<p>hello world</p>');
    expect(parseText('-123')).toBe(-123);
    expect(parseText('0.123')).toBe(0.123);
    expect(parseText('0')).toBe(0);
    expect(parseText('True')).toBe(true);
    expect(parseText('FALSE')).toBe(false);
    expect(parseText('NULL')).toBe(null);
    expect(parseText('undefined')).toBe(undefined);
    expect(parseText('[]')).toStrictEqual([]);
    expect(parseText('[1,2,3]')).toStrictEqual([1, 2, 3]);
    expect(parseText('{}')).toStrictEqual({});
    expect(parseText('')).toBe(null);
    expect(parseText('{"invalid": "json"')).toBe('{"invalid": "json"');
  });

  test('parse text', () => {
    expect(parseText('hello', 'string')).toBe('hello');
    expect(parseText('123', 'float')).toBe(123.0);
    expect(parseText('0.123', 'float')).toBe(0.123);
    expect(parseText('1', 'boolean')).toBe(true);
    expect(parseText('0', 'boolean')).toBe(false);
    expect(parseText('something', 'null')).toBe(null);
    expect(parseText('anything', 'undefined')).toBe(undefined);
    expect(parseText('{"hello":"world"}', 'object')).toStrictEqual({ hello: 'world' });
    expect(parseText('[1,2,3]', 'array')).toStrictEqual([1, 2, 3]);
  });

  test('read file', () => {
    const json = readSource('assets/peopleList.json', __dirname);
    expect(json.length).toBe(4);
    expect(json[0]).toStrictEqual({
      id: 1,
      first_name: 'Jeanette',
      last_name: 'Penddreth',
      email: 'jpenddreth0@census.gov',
      gender: 'Female',
      ip_address: '26.58.193.2',
    });

    const image = readSource('assets/tomCat.jpg', __dirname, 'buffer');
    expect(image.length).toBeGreaterThan(0);
  });
});

describe('preprocessImage', () => {
  const sampleImagePath = __dirname + '/assets/tomCat.jpg';
  const sampleImageURL =
    'https://raw.githubusercontent.com/ultmaster/poml-test-fixtures/e2bed155890e4cf853a515a990660328799ee5e3/image/gpt-5-random-image.png';
  const sampleImageBase64 = readFileSync(sampleImagePath).toString('base64');

  test('should process an image from a supported file path', async () => {
    const result = await preprocessImage({ src: sampleImagePath });
    expect(result.base64).toBeTruthy();
    expect(result.mimeType).toBe('image/jpeg');
  });

  test('should process an image from base64 data', async () => {
    const result = await preprocessImage({ base64: sampleImageBase64, type: 'image/png' });
    expect(result.base64).toBeTruthy();
    expect(result.mimeType).toBe('image/png');
    const metadata = await sharp(Buffer.from(result.base64, 'base64')).metadata();
    expect(metadata.format).toBe('png');
  });

  test('should process an image from an URL', async () => {
    const result = await preprocessImage({ src: sampleImageURL });
    expect(result.base64).toBeTruthy();
    expect(result.mimeType).toBe('image/png');
  });

  test('should resize the image with the resize parameter', async () => {
    const result = await preprocessImage({ base64: sampleImageBase64, type: 'png', resize: 0.5 });
    expect(result.base64).toBeTruthy();
    expect(result.mimeType).toBe('image/png');
    const oldMetadata = await sharp(sampleImagePath).metadata();
    const newMetadata = await sharp(Buffer.from(result.base64, 'base64')).metadata();
    expect(newMetadata.width).toBeCloseTo(oldMetadata.width! * 0.5);
    expect(newMetadata.height).toBeCloseTo(oldMetadata.height! * 0.5);
  });
});

describe('sse', () => {
  test('should render a component with a promise', async () => {
    const dummyPromise = () => new Promise<string>((resolve) => setTimeout(() => resolve('done'), 500));
    const CustomComponent = component('custom')((props: any) => {
      const msg = React.use<string>(dummyPromise());
      return <div>{msg}</div>;
    });
    const result = await reactRender(
      <React.Suspense fallback='loading'>
        <CustomComponent />
      </React.Suspense>,
    );
    expect(result).toContain('done');
    const resultShell = await reactRender(
      <React.Suspense fallback='loading'>
        <CustomComponent />
      </React.Suspense>,
      true,
    );
    expect(resultShell).toMatch(/loading|done/);
  });
});
