import { createToken, Lexer } from 'chevrotain';

// Define token types for extended POML
export const CommentOpen = createToken({ name: 'CommentOpen', pattern: /<!--(\-(?!\-+>))*/ });
export const CommentClose = createToken({ name: 'CommentClose', pattern: /-{2,}>/ });
export const PragmaKeyword = createToken({ name: 'PragmaKeyword', pattern: /\b@pragma\b/i });
export const TemplateOpen = createToken({ name: 'TemplateOpen', pattern: /{{/ });
export const TemplateClose = createToken({ name: 'TemplateClose', pattern: /}}/ });
export const ClosingOpenBracket = createToken({ name: 'ClosingOpenBracket', pattern: /<\// });
export const SelfCloseBracket = createToken({ name: 'SelfCloseBracket', pattern: /\/>/ });
export const OpenBracket = createToken({ name: 'OpenBracket', pattern: /</ });
export const CloseBracket = createToken({ name: 'CloseBracket', pattern: />/ });
export const Equals = createToken({ name: 'Equals', pattern: /=/ });

// Individual character tokens for quotes and backslash - CST parser will handle semantics
export const DoubleQuote = createToken({ name: 'DoubleQuote', pattern: /"/ });
export const SingleQuote = createToken({ name: 'SingleQuote', pattern: /'/ });
export const BackslashEscape = createToken({
  name: 'BackslashEscape',
  pattern: /\\(n|r|t|'|"|{{|}}|\\|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
});
export const CharacterEntity = createToken({ name: 'CharacterEntity', pattern: /&#[0-9]+;|&[a-zA-Z][a-zA-Z0-9]+;/ });
// Backslash not followed by a valid escape sequence
export const Backslash = createToken({ name: 'Backslash', pattern: /\\/ });

/* Identifier is used in one of the following:
 * - XML tag names
 * - XML attribute names
 * - Arbitrary text content incorrectly parsed as identifiers
 *
 * Notes:
 * 1. In case 1, we are going to allow "." and ":" to appear in XML tags and attributes.
 * 2. Similar for case 2.
 * 3. In case 3, CST parser will reclassify as TextContent if needed.
 */
export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_]([a-zA-Z0-9_\.:]|(-(?!\-+>)))*/,
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
 * - valid backslash escape sequences such as \n, \t, \", \', \\, \xHH, \uHHHH, \UHHHHHHHH, \{{, \}}
 * - character entities such as &#123; or &name;
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
  pattern:
    /(?:[^<>"'{}=\\&\s\u0000-\u001F\u007F-\u009F\u2000-\u200B\uFEFF\/-]|{(?!{)|}(?!})|\/(?!>)|\-(?!\-+>)|&(?!#\d+;|[a-zA-Z][a-zA-Z0-9]+;))+/,
  line_breaks: false,
});

// Define token order - more specific patterns first
export const AllTokens = [
  CommentOpen,
  CommentClose,
  PragmaKeyword,
  TemplateOpen,
  TemplateClose,
  ClosingOpenBracket, // Must come before OpenBracket
  SelfCloseBracket, // Must come before CloseBracket
  OpenBracket,
  CloseBracket,
  Equals,
  DoubleQuote,
  SingleQuote,
  BackslashEscape,
  Backslash,
  CharacterEntity,
  Identifier,
  Whitespace,
  Arbitrary,
];

export const XmlBracketTokens = [
  CommentOpen,
  CommentClose,
  ClosingOpenBracket,
  SelfCloseBracket,
  OpenBracket,
  CloseBracket,
];

export const TextTokens = [Identifier, Whitespace, Arbitrary];

// Tokens used in expressions (inside {{ and }}), excluding the closing braces.
// Opening braces should work, but they should be also properly escaped inside to avoid confusion.
export const TokensExpression = AllTokens.filter(
  (tokenType) => tokenType !== TemplateOpen && tokenType !== TemplateClose,
);

// Tokens used in quotes. The quoted strings do not allow template expressions inside.
// Quoted strings can contain backslash escapes. Character entities will be however shown as is.
export const TokensDoubleQuoted = AllTokens.filter((tokenType) => tokenType !== DoubleQuote);
export const TokensSingleQuoted = AllTokens.filter((tokenType) => tokenType !== SingleQuote);

// Tokens used in quotes, but within quotes, it can contain other expressions ({{ and }}).
export const TokensDoubleQuotedExpression = TokensExpression.filter((tokenType) => tokenType !== DoubleQuote);
export const TokensSingleQuotedExpression = TokensExpression.filter((tokenType) => tokenType !== SingleQuote);

// Text contents inside XML elements.
// Like XML/HTML, the contents here can have `&` XML entities to escape special characters.
// Escaped characters via backslash will be shown as is without escape handling.
export const TokensTextContent = AllTokens.filter(
  (tokenType) => !XmlBracketTokens.includes(tokenType) && tokenType !== TemplateOpen && tokenType !== TemplateClose,
);

// Extended POML Lexer class
export class ExtendedPomlLexer {
  private lexer: Lexer;

  constructor() {
    this.lexer = new Lexer(AllTokens);
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
