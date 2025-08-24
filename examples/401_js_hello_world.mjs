/**
 * Minimal POML.js sanity check.
 * Parses a simple <p> tag and verifies the output.
 */
import { poml } from 'pomljs';

const output = await poml('<p>hello world</p>');
if (output !== 'hello world') {
  throw new Error(`Expected 'hello world', got '${output}'`);
}
console.log(output);
