import { notifyError, notifyWarning } from '@common/notification';
import { renderToReadableStream } from 'react-dom/server';

/**
 * Render a React element to string using renderToReadableStream
 */
export async function renderElementToString(element: React.ReactElement): Promise<string> {
  let renderError: any = null;
  const stream = await renderToReadableStream(element, {
    onError: (error) => {
      notifyError('Error during POML rendering', error);
      renderError = error;
    },
  });
  await stream.allReady;
  const reader = stream.getReader();

  if (renderError) {
    notifyWarning(`POML rendering encountered an error`, renderError);
  }

  let result = '';
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    result += decoder.decode(value, { stream: true });
  }

  // Final decode with stream: false to flush any remaining bytes
  result += decoder.decode();
  return result;
}
