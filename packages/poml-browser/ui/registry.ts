/* To trigger the registered functions in the RPC */

import * as React from 'react';
import { pingPong } from '@common/rpc';
import { readFile } from '@common/imports/file';
import { toPngBase64 } from '@common/imports/image';
import { renderCardsByPoml } from '@common/poml-helper';
import { renderElementToString } from '@common/utils/react';
import { processDropEventAndThrow } from '@common/events/drop';
import { processPasteEventAndThrow } from '@common/events/paste';

// @ts-ignore
if (__TEST_BUILD__) {
  (window as any).React = React;
  (window as any).readFile = readFile;
  (window as any).renderCardsByPoml = renderCardsByPoml;
  (window as any).renderElementToString = renderElementToString;
  (window as any).pingPong = pingPong; // Expose pingPong for testing
  (window as any).toPngBase64 = toPngBase64;
  (window as any).processDropEventAndThrow = processDropEventAndThrow;
  (window as any).processPasteEventAndThrow = processPasteEventAndThrow;
}
