import { createToken, Lexer } from 'chevrotain';

// Define token types for extended POML
export const Comment = createToken({ name: 'Comment', pattern: /<!--[\s\S]*?-->/ });
export const TemplateOpen = createToken({ name: 'TemplateOpen', pattern: /{{/ });
export const TemplateClose = createToken({ name: 'TemplateClose', pattern: /}}/ });
export const TagClosingOpen = createToken({ name: 'TagClosingOpen', pattern: /<\// });
export const TagSelfClose = createToken({ name: 'TagSelfClose', pattern: /\/>/ });
export const TagOpen = createToken({ name: 'TagOpen', pattern: /</ });
export const TagClose = createToken({ name: 'TagClose', pattern: />/ });
export const Equals = createToken({ name: 'Equals', pattern: /=/ });

// Individual character tokens for quotes and backslash - CST parser will handle semantics
export const DoubleQuote = createToken({ name: 'DoubleQuote', pattern: /"/ });
export const SingleQuote = createToken({ name: 'SingleQuote', pattern: /'/ });
export const Backslash = createToken({ name: 'Backslash', pattern: /\\/ });

/* Identifier is one of the following:
   - XML tag names
   - XML attribute names
   - TextContent incorrectly parsed as identifiers

   Case 3 is handled later by CST parser.
*/
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_-]*/,
});

export const Whitespace = createToken({
  name: 'Whitespace',
  pattern: /[ \t\r\n]+/,
  line_breaks: true,
});

/* eslint-disable no-irregular-whitespace */
/* Catch-all for arbitrary text content
   - Match any char except:
       <          — starts a tag
       {{  or }}  — template delimiters
       " or '     — start/end of string literals
   - Single { or } are OK because they are not followed by another brace
*/
export const TextContent = createToken({
  name: 'TextContent',
  pattern: /(?:[^<"'{}]|{(?!{)|}(?!}))+/,
  line_breaks: true,
});
/* eslint-enable no-irregular-whitespace */

// Define token order - more specific patterns first
export const allTokens = [
  Comment,
  TemplateOpen,
  TemplateClose,
  TagClosingOpen, // Must come before TagOpen
  TagSelfClose, // Must come before TagClose
  TagOpen,
  TagClose,
  Equals,
  DoubleQuote,
  SingleQuote,
  Backslash,
  Identifier,
  Whitespace,
  TextContent,
];

// Extended POML Lexer class
export class ExtendedPomlLexer {
  private lexer: Lexer;

  constructor() {
    this.lexer = new Lexer(allTokens);
  }

  public tokenize(text: string) {
    const lexingResult = this.lexer.tokenize(text);

    if (lexingResult.errors.length > 0) {
      console.warn('Lexing errors:', lexingResult.errors);
    }

    return {
      tokens: lexingResult.tokens,
      errors: lexingResult.errors,
      groups: lexingResult.groups,
    };
  }
}

// Create a single instance to export
export const extendedPomlLexer = new ExtendedPomlLexer();

// Export token types for use in parser
export type { IToken, ILexingError, ILexingResult } from 'chevrotain';
