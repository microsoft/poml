/* To trigger the registered functions in the RPC */

import { getSettings, setSettings } from '@common/settings';
import { pingPong } from '@common/rpc';
import { readFile } from '@common/imports/file';
import { toPngBase64 } from '@common/imports/image';
import { htmlToCard } from '@common/imports/html';

// @ts-ignore
if (__TEST_BUILD__) {
  (self as any).getSettings = getSettings;
  (self as any).setSettings = setSettings;
  (self as any).readFile = readFile;
  (self as any).toPngBase64 = toPngBase64;
  (self as any).htmlToCard = htmlToCard;
  (self as any).pingPong = pingPong; // Expose pingPong for testing
}
