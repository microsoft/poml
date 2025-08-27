import * as React from 'react';
import * as fs from 'fs';
import * as mammoth from 'mammoth';
import * as cheerio from 'cheerio';

import {
  Header,
  Newline,
  Text,
  Image,
  Paragraph,
  PropsSyntaxBase,
  List,
  ListItem,
  Bold,
  Italic,
} from 'poml/essentials';
// import pdf from 'pdf-parse';
import { pdfParse, getNumPages } from 'poml/util/pdf';
import { component, expandRelative, useWithCatch, BufferCollection } from 'poml/base';
import { Table } from './table';
import { parsePythonStyleSlice } from './utils';

function readBufferCached(filePath: string): Buffer {
  const abs = expandRelative(filePath);
  const key = `content://${abs}`;
  const stat = fs.statSync(abs);
  const cached = BufferCollection.get<{ value: Buffer; mtime: number }>(key);
  if (cached && cached.mtime === stat.mtimeMs) {
    return cached.value;
  }
  const buf = fs.readFileSync(abs);
  BufferCollection.set(key, { value: buf, mtime: stat.mtimeMs });
  return buf;
}

async function parsePdfWithPageLimit(dataBuffer: Buffer, startPage: number, endPage: number) {
  // This is a workaround for pdf-parse not supporting a range.
  const data = await pdfParse(dataBuffer, endPage + 1);
  if (startPage <= 0) {
    return data;
  }
  const minusData = await pdfParse(dataBuffer, startPage);
  return data.slice(minusData.length);
}

export async function readPdf(dataBuffer: Buffer, options?: DocumentProps): Promise<React.ReactElement> {
  const { selectedPages } = options || {};
  const numPages = await getNumPages(dataBuffer);
  if (selectedPages) {
    const [start, end] = parsePythonStyleSlice(selectedPages, numPages);
    const result = await parsePdfWithPageLimit(dataBuffer, start, end);
    return <Text whiteSpace='pre'>{result}</Text>;
  } else {
    return <Text whiteSpace='pre'>{await pdfParse(dataBuffer)}</Text>;
  }
}

export async function readPdfFromPath(filePath: string, options?: DocumentProps): Promise<React.ReactElement> {
  const dataBuffer = readBufferCached(filePath);
  return readPdf(dataBuffer, options);
}

function htmlContentsToPoml(
  element: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI,
  options?: DocumentProps,
): React.ReactNode[] {
  const children = element
    .contents()
    .toArray()
    .map((child, index) => {
      if (child.type === 'text') {
        return <React.Fragment key={index}>{child.data}</React.Fragment>;
      } else {
        return <React.Fragment key={index}>{htmlToPoml($(child), $, options)}</React.Fragment>;
      }
    });
  return children;
}

function convertTableFromHtml(
  element: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI,
  options?: DocumentProps,
): React.ReactElement {
  const body = element
    .find('tr')
    .toArray()
    .map((tr) =>
      $(tr)
        .find('td, th')
        .toArray()
        .map((td) => $(td).text()),
    );
  const header = body.shift() || [];

  if (header.length === 0) {
    return <></>;
  }
  const maxColumns = Math.max(...body.map((row) => row.length), header.length);
  if (header.length < maxColumns) {
    header.push(...Array(maxColumns - header.length).map((i) => `Unnamed Column ${i + header.length}`));
  }
  const rows = body.map((row) => {
    return Object.fromEntries(
      header.map((column, index) => {
        return [column, index < row.length ? row[index] : ''];
      }),
    );
  });
  return <Table records={rows} columns={header.map((column) => ({ field: column, header: column }))} />;
}

export function htmlToPoml(
  element: cheerio.Cheerio<any>,
  $: cheerio.CheerioAPI,
  options?: DocumentProps,
): React.ReactElement {
  if (element.is('style') || element.is('script')) {
    return <></>;
  } else if (
    element.is('h1') ||
    element.is('h2') ||
    element.is('h3') ||
    element.is('h4') ||
    element.is('h5') ||
    element.is('h6')
  ) {
    return <Header whiteSpace='pre'>{htmlContentsToPoml(element, $, options)}</Header>;
  } else if (element.is('p') || element.is('div')) {
    return <Paragraph whiteSpace='pre'>{htmlContentsToPoml(element, $, options)}</Paragraph>;
  } else if (element.is('br')) {
    return <Newline />;
  } else if (element.is('ol')) {
    return <List listStyle='decimal'>{htmlContentsToPoml(element, $, options)}</List>;
  } else if (element.is('ul')) {
    return <List>{htmlContentsToPoml(element, $, options)}</List>;
  } else if (element.is('li')) {
    return <ListItem>{htmlContentsToPoml(element, $, options)}</ListItem>;
  } else if (element.is('b')) {
    return <Bold>{htmlContentsToPoml(element, $, options)}</Bold>;
  } else if (element.is('i')) {
    return <Italic>{htmlContentsToPoml(element, $, options)}</Italic>;
  } else if (element.is('img')) {
    // src is in the format of data:image/png;base64, so we can't use it directly
    const src = element.attr('src')!;
    // check whether src is in the format of data:type;base64
    if (src.startsWith('data:') && src.includes(';base64')) {
      const base64 = src.split(',')[1];
      if (options?.multimedia || options?.multimedia === undefined) {
        return <Image syntax='multimedia' base64={base64} alt={element.attr('alt')} />;
      } else {
        return <Image base64={base64} alt={element.attr('alt')} />;
      }
    } else {
      // URL or local file path
      try {
        if (options?.multimedia || options?.multimedia === undefined) {
          return <Image syntax='multimedia' src={src} alt={element.attr('alt')} />;
        } else {
          return <Image src={src} alt={element.attr('alt')} />;
        }
      } catch (e) {
        return <></>;
      }
    }
  } else if (element.is('table')) {
    return convertTableFromHtml(element, $, options);
  } else {
    return <>{htmlContentsToPoml(element, $, options)}</>;
  }
}

export async function readDocx(dataBuffer: Buffer, options?: DocumentProps): Promise<React.ReactElement> {
  const result = await mammoth.convertToHtml({ buffer: dataBuffer });
  const $ = cheerio.load(result.value);
  return <Text syntax='markdown'>{htmlContentsToPoml($('body'), $, options)}</Text>;
}

export async function readDocxFromPath(filePath: string, options?: DocumentProps): Promise<React.ReactElement> {
  const dataBuffer = readBufferCached(filePath);
  return readDocx(dataBuffer, options);
}

export async function readTxt(dataBuffer: Buffer, options?: DocumentProps): Promise<React.ReactElement> {
  const text = dataBuffer.toString();
  return <Text whiteSpace='pre'>{text}</Text>;
}

export async function readTxtFromPath(filePath: string, options?: DocumentProps): Promise<React.ReactElement> {
  const dataBuffer = readBufferCached(filePath);
  return readTxt(dataBuffer, options);
}

type DocumentParser = 'pdf' | 'docx' | 'txt' | 'auto';

interface DocumentProps extends PropsSyntaxBase {
  src?: string;
  parser?: DocumentParser;
  buffer?: string | Buffer;
  base64?: string;
  multimedia?: boolean;
  selectedPages?: string;
}

function determineParser(src: string): DocumentParser {
  src = src.toLowerCase();
  if (src.endsWith('.docx') || src.endsWith('.doc')) {
    return 'docx';
  } else if (src.endsWith('.pdf')) {
    return 'pdf';
  } else if (src.endsWith('.txt')) {
    return 'txt';
  } else {
    throw new Error('Cannot determine parser for ' + src + '. Please manually specify a parser.');
  }
}

async function autoParseDocument(props: DocumentProps & { buffer?: Buffer }): Promise<React.ReactElement> {
  let { parser, src, buffer } = props;
  if (parser === 'auto' || parser === undefined) {
    if (!src) {
      throw new Error('Cannot determine parser without source file provided.');
    }
    parser = determineParser(src);
  }
  if (src) {
    buffer = readBufferCached(src);
  } else if (!buffer) {
    throw new Error('Either buffer or src must be provided');
  }

  switch (parser) {
    case 'pdf':
      return await readPdf(buffer, props);
    case 'docx':
      return await readDocx(buffer, props);
    case 'txt':
      return await readTxt(buffer, props);
    default:
      throw new Error('Unsupported parser: ' + parser);
  }
}

/**
 * Displaying an external document like PDF, TXT or DOCX.
 *
 * @param {string} src - The source file to read the data from. This must be provided if records is not provided.
 * @param {Buffer|string} buffer - Document data buffer. Recommended to use `src` instead unless you want to use a string.
 * @param {string} base64 - Base64 encoded string of the document data. Mutually exclusive with `src` and `buffer`.
 * @param {'auto'|'pdf'|'docx'|'txt'} parser - The parser to use for reading the data. If not provided, it will be inferred from the file extension.
 * @param {boolean} multimedia - If true, the multimedias will be displayed. If false, the alt strings will be displayed at best effort. Default is `true`.
 * @param {string} selectedPages - The pages to be selected. This is only available **for PDF documents**. If not provided, all pages will be selected.
 * You can use a string like `2` to specify a single page, or slice like `2:4` to specify a range of pages (2 inclusive, 4 exclusive).
 * The pages selected are **0-indexed**. Negative indexes like `-1` is not supported here.
 *
 * @see {@link Inline} for other props available.
 *
 * @example
 * To display a Word document without including the real multimedia:
 * ```xml
 * <Document src="sample.docx" multimedia="false"/>
 * ```
 */
export const Document = component('Document', { aliases: ['doc'], asynchorous: true })((props: DocumentProps) => {
  let { buffer, parser, base64, ...others } = props;
  let parsedBuffer: Buffer | undefined;
  if (base64) {
    if (buffer !== undefined) {
      throw new Error('Either buffer or base64 should be provided, not both.');
    }
    parsedBuffer = Buffer.from(base64, 'base64');
  } else {
    if (typeof buffer === 'string') {
      parsedBuffer = Buffer.from(buffer, 'utf-8');
      if (parser === undefined || parser === 'auto') {
        parser = 'txt';
      }
    } else {
      parsedBuffer = buffer;
    }
  }
  const document = useWithCatch(autoParseDocument({ buffer: parsedBuffer, parser, ...others }), others);
  return <>{document ?? null}</>;
});
