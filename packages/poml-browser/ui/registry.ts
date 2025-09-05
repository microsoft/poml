/* To trigger the registered functions in the RPC */

import { pingPong } from '@common/rpc';
import { readFile } from '@common/imports/file';
import { toPngBase64 } from '@common/imports/image';
import { processDropEventAndThrow } from '@common/events/drop';
import { processPasteEventAndThrow } from '@common/events/paste';

// @ts-ignore
if (__TEST_BUILD__) {
  (window as any).readFile = readFile;
  (window as any).pingPong = pingPong; // Expose pingPong for testing
  (window as any).toPngBase64 = toPngBase64;
  (window as any).processDropEventAndThrow = processDropEventAndThrow;
  (window as any).processPasteEventAndThrow = processPasteEventAndThrow;
}
