import { createToken, Lexer } from 'chevrotain';

// Define token types for extended POML
export const CommentOpen = createToken({ name: 'CommentOpen', pattern: /<!-{2,}/ });
export const CommentClose = createToken({ name: 'CommentClose', pattern: /-{2,}>/ });
export const Pragma = createToken({ name: 'Pragma', pattern: /\b@pragma\b/i });
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
 * - XML tag names
 * - XML attribute names
 * - Arbitrary text content incorrectly parsed as identifiers
 *
 * Notes:
 * 1. In case 1, tags can contain : (namespaces) and . (extensions).
 *    These are handled later by CST parser.
 * 2. In case 3, CST parser will reclassify as TextContent if needed.
 * 3. We are going to disallow "." and ":" to appear in XML tags.
 */
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_]([a-zA-Z0-9_]|(-(?!\-+>)))*/,
});

// Include all Unicode whitespace characters and control characters
export const Whitespace = createToken({
  name: 'Whitespace',
  pattern: /[\s\u0000-\u001F\u007F-\u009F\u2000-\u200B\uFEFF]+/,
  line_breaks: true,
});

/* Catch-all for arbitrary text content.
 * Match any char except the patterns from other tokens:
 * - starts or ends a tag: <, >, </, />
 * - starts or ends a comment: <!--, -->
 * - starts or ends a template: {{, }}
 * - starts or ends a string literal: " or '
 * - whitespace (handled separately - includes Unicode whitespace and control chars)
 * - equal sign (=)
 * - backslash \ (handled separately for escaping)
 *
 * Allowed:
 * - Single { or } are OK if they are not followed by another brace
 * - Incomplete tag delimiters such as / (/< is an exception, because < is a start of tag)
 * - Incomplete comment delimiters such as !-- or -- are OK
 * - Incorrect @pragma directive such as @pragm or @pragmaX will be matched
 * - All other Unicode characters including emojis, CJK, etc.
 */
export const Arbitrary = createToken({
  name: 'Arbitrary',
  // Match anything except: <, >, quotes, =, backslash, whitespace (including Unicode), control chars
  // Allow single braces and slashes with lookahead constraints
  pattern: /(?:[^<>"'{}=\\\s\u0000-\u001F\u007F-\u009F\u2000-\u200B\uFEFF\/-]|{(?!{)|}(?!})|\/(?!>)|\-(?!\-+>))+/,
  line_breaks: false,
});

// Define token order - more specific patterns first
export const allTokens = [
  CommentOpen,
  CommentClose,
  Pragma,
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
  Arbitrary,
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
