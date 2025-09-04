import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { commandLine, setTrace, clearTrace, parseJsonWithBuffers, dumpTrace, read, write } from 'poml';

function stringifyWithBuffers(obj: any): string {
  return JSON.stringify(obj, (_k, v) => {
    if (Buffer.isBuffer(v)) {
      return { __base64__: v.toString('base64') };
    }
    return v;
  });
}

describe('trace dumps', () => {
  let traceDir: string;
  beforeEach(() => {
    traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-'));
    setTrace(true, traceDir);
  });
  afterEach(() => {
    clearTrace();
    fs.rmSync(traceDir, { recursive: true, force: true });
  });

  test('unused buffer in context is dumped', async () => {
    const buffer = fs.readFileSync(path.join(__dirname, 'assets', 'tomCat.jpg'));
    dumpTrace('<p></p>', { img: buffer });
    const raw = fs.readFileSync(path.join(traceDir, '0001.context.json'), 'utf8');
    expect(raw).toContain('__base64__');
  });

  test('document result includes base64', async () => {
    const markup = `<Document src="${path.join(__dirname, 'assets', 'sampleWord.docx')}" />`;
    await commandLine({ input: markup, speakerMode: false });
    const result = parseJsonWithBuffers(fs.readFileSync(path.join(traceDir, '0001.result.json'), 'utf8'));
    const images = JSON.stringify(result).includes('base64');
    expect(images).toBe(true);
  });

  test('pretty printed result text is dumped', async () => {
    await commandLine({ input: '<p>Hello</p>', speakerMode: false });
    const text = fs.readFileSync(path.join(traceDir, '0001.result.txt'), 'utf8').trim();
    expect(text).toBe('Hello');
  });

  test('env file records source path and enables include', async () => {
    const origDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orig-'));
    const mainPath = path.join(origDir, 'main.poml');
    fs.copyFileSync(path.join(__dirname, 'assets', 'includeChild.poml'), path.join(origDir, 'includeChild.poml'));
    fs.writeFileSync(mainPath, '<poml><include src="includeChild.poml"/></poml>');

    await commandLine({ file: mainPath, speakerMode: false, context: ['name=world'] });

    const envContent = fs.readFileSync(path.join(traceDir, '0001.main.env'), 'utf8').trim();
    expect(envContent).toBe(`SOURCE_PATH=${mainPath}`);

    const tracedMarkupPath = path.join(traceDir, '0001.main.poml');
    const traced = fs.readFileSync(tracedMarkupPath, 'utf8');
    const rerenderIr = await read(traced, undefined, { name: 'world' }, undefined, tracedMarkupPath);
    const rerender = write(rerenderIr);
    expect(fs.existsSync(path.join(traceDir, '0001.main.source.poml'))).toBe(true);
    expect(rerender).toBe('hello world');

    fs.rmSync(origDir, { recursive: true, force: true });
  });

  test('context and stylesheet are dumped when rendering fails', async () => {
    const origDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orig-'));
    const mainPath = path.join(origDir, 'main.poml');
    // Missing include triggers an error during rendering
    fs.writeFileSync(mainPath, '<poml><include src="missing.poml"/></poml>');

    await expect(
      commandLine({
        file: mainPath,
        speakerMode: false,
        context: ['name=world'],
        stylesheet: '{"p": {"speaker": "ai"}}',
      }),
    ).rejects.toThrow();

    const prefix = path.join(traceDir, '0001.main');
    const contextDump = fs.readFileSync(`${prefix}.context.json`, 'utf8');
    expect(contextDump).toContain('name');
    const stylesheetDump = fs.readFileSync(`${prefix}.stylesheet.json`, 'utf8');
    expect(stylesheetDump).toContain('speaker');
    const envContent = fs.readFileSync(`${prefix}.env`, 'utf8').trim();
    expect(envContent).toBe(`SOURCE_PATH=${mainPath}`);

    fs.rmSync(origDir, { recursive: true, force: true });
  });

  test('nextIndex skips index when any file with that index exists', async () => {
    // Create a file with index 0001 but different name to test case 1 logic
    fs.writeFileSync(path.join(traceDir, '0001.different.poml'), 'existing file');

    // Now dump a trace which should skip 0001 and use 0002
    dumpTrace('<p>Test</p>', { test: 'value' });

    // Check that no 0001.poml was created (should be skipped)
    expect(fs.existsSync(path.join(traceDir, '0001.poml'))).toBe(false);

    // Check that 0002.poml was created instead
    expect(fs.existsSync(path.join(traceDir, '0002.poml'))).toBe(true);
    expect(fs.existsSync(path.join(traceDir, '0002.context.json'))).toBe(true);
  });
});
