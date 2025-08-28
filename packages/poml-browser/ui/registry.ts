/* To trigger the registered functions in the RPC */

import { pingPong } from '../common/rpc';

// @ts-ignore
if (__TEST_BUILD__) {
  (window as any).pingPong = pingPong; // Expose pingPong for testing
}
