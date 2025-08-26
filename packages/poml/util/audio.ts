import * as fs from 'fs';
import path from 'path';

interface PreprocessAudioArgs {
  src?: string;
  base64?: string;
  type?: string;
}

interface ProcessedAudio {
  base64: string;
  mimeType: string;
}

function readAudio(src?: string, base64?: string): Buffer {
  if (src) {
    return fs.readFileSync(src);
  }
  if (base64) {
    return Buffer.from(base64, 'base64');
  }
  throw new Error('src or base64 is required');
}

function canonicalizeType(type: string | undefined, src?: string): string {
  if (type) {
    return type.startsWith('audio/') ? type : `audio/${type}`;
  }
  if (src) {
    const ext = path.extname(src).toLowerCase();
    switch (ext) {
      case '.mp3':
        return 'audio/mpeg';
      case '.wav':
        return 'audio/wav';
      case '.ogg':
        return 'audio/ogg';
      case '.flac':
        return 'audio/flac';
      case '.aac':
        return 'audio/aac';
      default:
        throw new Error('Cannot determine audio format');
    }
  }
  throw new Error('Cannot determine audio format');
}

export async function preprocessAudio(args: PreprocessAudioArgs): Promise<ProcessedAudio> {
  const { src, base64, type } = args;
  const buffer = readAudio(src, base64);
  const mimeType = canonicalizeType(type, src);
  return {
    base64: buffer.toString('base64'),
    mimeType,
  };
}
