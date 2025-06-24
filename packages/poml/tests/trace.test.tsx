import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, beforeEach, afterEach, test, expect } from '@jest/globals';
import { commandLine, setTrace, clearTrace, parseJsonWithBuffers, dumpTrace } from 'poml';

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
    const raw = fs.readFileSync(path.join(traceDir, '0001_context.json'), 'utf8');
    expect(raw).toContain('__base64__');
  });

  test('document result includes base64', async () => {
    const markup = `<Document src="${path.join(__dirname, 'assets', 'sampleWord.docx')}" />`;
    await commandLine({ input: markup, speakerMode: false });
    const result = parseJsonWithBuffers(fs.readFileSync(path.join(traceDir, '0001_result.json'), 'utf8'));
    const images = JSON.stringify(result).includes('base64');
    expect(images).toBe(true);
  });
});
