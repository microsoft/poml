/* To trigger the registered functions in the RPC */

import { getSettings, setSettings } from '../common/settings';
import { pingPong } from '../common/rpc';
import { readFile } from '../common/imports/file';

// @ts-ignore
if (__TEST_BUILD__) {
  (self as any).getSettings = getSettings;
  (self as any).setSettings = setSettings;
  (self as any).readFile = readFile;
  (self as any).pingPong = pingPong; // Expose pingPong for testing
}
