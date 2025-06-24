import { mkdirSync, writeFileSync, openSync, closeSync, writeSync, readFileSync } from 'fs';
import path from 'path';

interface Base64Wrapper { __base64__: string }

function replaceBuffers(value: any): any {
  if (Buffer.isBuffer(value)) {
    const wrapper: Base64Wrapper = { __base64__: value.toString('base64') };
    return wrapper;
  } else if (Array.isArray(value)) {
    return value.map(replaceBuffers);
  } else if (value && typeof value === 'object') {
    const result: any = {};
    for (const k of Object.keys(value)) {
      result[k] = replaceBuffers(value[k]);
    }
    return result;
  }
  return value;
}

export function parseJsonWithBuffers(text: string): any {
  return JSON.parse(text, (_key, value) => {
    if (value && typeof value === 'object' && value.__base64__) {
      return Buffer.from(value.__base64__, 'base64');
    }
    return value;
  });
}

let traceEnabled = false;
let traceDir: string | undefined;

export function setTrace(enabled = true, dir?: string): string | undefined {
  traceEnabled = enabled;
  if (!enabled) {
    traceDir = undefined;
    return undefined;
  }
  const envDir = process.env.POML_TRACE;
  if (dir) {
    const base = path.resolve(dir);
    mkdirSync(base, { recursive: true });
    traceDir = base;
  } else if (envDir) {
    mkdirSync(envDir, { recursive: true });
    traceDir = envDir;
  } else {
    traceDir = undefined;
  }
  return traceDir;
}

export function clearTrace() {
  traceEnabled = false;
  traceDir = undefined;
}

export function isTracing(): boolean {
  return traceEnabled && !!traceDir;
}

function nextIndex(): [number, string, number] {
  if (!traceDir) {
    return [0, '', -1];
  }
  for (let i = 1; ; i++) {
    const idxStr = i.toString().padStart(4, '0');
    const prefix = path.join(traceDir, idxStr);
    const filePath = `${prefix}_markup.poml`;
    try {
      const fd = openSync(filePath, 'wx');
      return [i, prefix, fd];
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        continue;
      }
      throw err;
    }
  }
}

export function dumpTrace(markup: string, context?: any, stylesheet?: any, result?: any) {
  if (!isTracing()) {
    return;
  }
  const [_idx, prefix, fd] = nextIndex();
  try {
    writeSync(fd, markup);
  } finally {
    closeSync(fd);
  }
  if (context && Object.keys(context).length > 0) {
    writeFileSync(`${prefix}_context.json`, JSON.stringify(replaceBuffers(context), null, 2));
  }
  if (stylesheet && Object.keys(stylesheet).length > 0) {
    writeFileSync(`${prefix}_stylesheet.json`, JSON.stringify(replaceBuffers(stylesheet), null, 2));
  }
  if (result !== undefined) {
    writeFileSync(`${prefix}_result.json`, JSON.stringify(replaceBuffers(result), null, 2));
  }
}

if (process.env.POML_TRACE) {
  setTrace(true, process.env.POML_TRACE);
}
