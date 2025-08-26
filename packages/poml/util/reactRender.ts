import { renderToPipeableStream } from 'react-dom/server';

import { Writable } from 'stream';

const pipeableStreamToString = async (stream: (destination: NodeJS.WritableStream) => NodeJS.WritableStream) => {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
      final(callback) {
        resolve(Buffer.concat(chunks as readonly Uint8Array[]).toString());
        callback();
      },
      destroy(err, callback) {
        reject(err);
        callback(err);
      },
    });
    stream(writable);
  });
};

export const reactRender = (element: React.ReactElement, shellOnly?: boolean) => {
  const promise = new Promise<string>((resolve, reject) => {
    const { pipe } = renderToPipeableStream(element, {
      onAllReady: () => {
        if (!shellOnly) {
          resolve(pipeableStreamToString(pipe));
        }
      },
      onError: (error, errorInfo) => {
        console.error(errorInfo);
        reject(error);
      },
      onShellError: (error) => {
        reject(error);
      },
      onShellReady: () => {
        if (shellOnly) {
          resolve(pipeableStreamToString(pipe));
        }
      },
    });
  });
  return promise;
};
