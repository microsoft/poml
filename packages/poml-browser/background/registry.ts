/* To trigger the registered functions in the RPC */

import { getSettings, setSettings } from '@common/settings';
import { pingPong } from '@common/rpc';
import { readFile } from '@common/imports/file';
import { cardFromImage, toPngBase64 } from '@common/imports/image';
import { cardFromHtml } from '@common/imports/html';

// @ts-ignore
if (__TEST_BUILD__) {
  (self as any).getSettings = getSettings;
  (self as any).setSettings = setSettings;
  (self as any).readFile = readFile;
  (self as any).toPngBase64 = toPngBase64;
  (self as any).cardFromHtml = cardFromHtml;
  (self as any).cardFromImage = cardFromImage;
  (self as any).pingPong = pingPong; // Expose pingPong for testing
}
