/* To trigger the registered functions in the RPC */

import { pingPong } from '@common/rpc';
import { readFile } from '@common/imports/file';

// @ts-ignore
if (__TEST_BUILD__) {
  (window as any).readFile = readFile;
  (window as any).pingPong = pingPong; // Expose pingPong for testing
}
