import { mkdirSync, writeFileSync, openSync, closeSync, writeSync, symlinkSync, readdirSync } from 'fs';
import path from 'path';

interface Base64Wrapper {
  __base64__: string;
}

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

function nextIndex(sourcePath?: string): [number, string, number] {
  if (!traceDir) {
    return [0, '', -1];
  }
  const fileName = sourcePath ? path.basename(sourcePath, '.poml') : '';

  for (let i = 1; ; i++) {
    const idxStr = i.toString().padStart(4, '0');

    // 1) If ANY file in traceDir starts with this index, skip it.
    //    This makes the sequence independent of fileName.
    const entries = readdirSync(traceDir);
    const indexTaken = entries.some((entry) => entry.startsWith(idxStr));
    if (indexTaken) {
      continue;
    }

    // 2) Build our own target using the (possibly present) fileName.
    const prefix = path.join(traceDir, idxStr) + (fileName ? `.${fileName}` : '');
    const filePath = `${prefix}.poml`;

    try {
      // 3) Atomically create our file. If it races and now exists, loop again.
      const fd = openSync(filePath, 'wx');
      return [i, prefix, fd];
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        // Someone created a file with this index between steps (1) and (3); try next i.
        continue;
      }
      throw err;
    }
  }
}

export function dumpTrace(
  markup: string,
  context?: any,
  stylesheet?: any,
  result?: any,
  sourcePath?: string,
  prettyResult?: string,
) {
  if (!isTracing()) {
    return;
  }
  const [_idx, prefix, fd] = nextIndex(sourcePath);
  try {
    writeSync(fd, markup);
  } finally {
    closeSync(fd);
  }
  if (sourcePath) {
    const envFile = `${prefix}.env`;
    writeFileSync(envFile, `SOURCE_PATH=${sourcePath}\n`);
    const linkPath = `${prefix}.source.poml`;
    try {
      symlinkSync(sourcePath, linkPath);
    } catch {
      console.warn(`Failed to create symlink for source path: ${sourcePath}`);
    }
  }
  if (context && Object.keys(context).length > 0) {
    writeFileSync(`${prefix}.context.json`, JSON.stringify(replaceBuffers(context), null, 2));
  }
  if (stylesheet && Object.keys(stylesheet).length > 0) {
    writeFileSync(`${prefix}.stylesheet.json`, JSON.stringify(replaceBuffers(stylesheet), null, 2));
  }
  if (result !== undefined) {
    writeFileSync(`${prefix}.result.json`, JSON.stringify(replaceBuffers(result), null, 2));
    if (prettyResult !== undefined) {
      writeFileSync(`${prefix}.result.txt`, prettyResult);
    }
  }
}

if (process.env.POML_TRACE) {
  setTrace(true, process.env.POML_TRACE);
}
