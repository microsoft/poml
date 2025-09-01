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
export const CharacterEntity = createToken({
  name: 'CharacterEntity',
  pattern: /&#x[0-9A-Fa-f]+;|&#[0-9]+;|&[a-zA-Z][a-zA-Z0-9]+;/,
});
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

// Include all control whitespace characters, not unicode whitespace
export const Whitespace = createToken({
  name: 'Whitespace',
  pattern: /[ \t\r\n\v\f]+/,
  line_breaks: true,
});

/* Catch-all for arbitrary text content.
 * Match any char except the patterns from other tokens:
 * - starts or ends a tag: <, >, </, />
 * - starts or ends a comment: <!--, -->
 * - starts or ends a template: {{, }}
 * - starts or ends a string literal: " or '
 * - whitespace (handled separately - includes control chars)
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
 * - Invalid character entities such as &abc (without semicolon) or & (by itself) or &;, &z; (invalid)
 * - All other Unicode characters including emojis, CJK, etc.
 */
export const Arbitrary = createToken({
  name: 'Arbitrary',
  // Match anything except: <, >, quotes, =, backslash, whitespace, control chars
  // Allow single braces and slashes with lookahead constraints
  pattern:
    /(?:[^<>"'{}=\\& \t\r\n\v\f/-]|{(?!{)|}(?!})|\/(?!>)|\-(?!\-+>)|&(?!#\d+;|x[0-9A-Fa-f]+;|[a-zA-Z][a-zA-Z0-9]+;))+/,
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

export const TokensComment = AllTokens.filter((tokenType) => tokenType !== CommentClose);

// Tokens used in expressions (inside {{ and }}), excluding the closing braces.
// Opening braces {{ should work, but they should be generally properly escaped inside to avoid confusion.
export const TokensExpression = AllTokens.filter((tokenType) => tokenType !== TemplateClose);

// Tokens used in quotes. The quoted strings do not allow template expressions inside.
// The only application currently is in @pragma directive options.
// Quoted strings can contain backslash escapes. Character entities will be however shown as is.
export const TokensDoubleQuoted = AllTokens.filter((tokenType) => tokenType !== DoubleQuote);
export const TokensSingleQuoted = AllTokens.filter((tokenType) => tokenType !== SingleQuote);

// Tokens used in quotes, but within quotes distinguish from expressions (surrounded by {{ and }}).
export const TokensDoubleQuotedExpression = AllTokens.filter(
  (tokenType) => tokenType !== DoubleQuote && tokenType !== TemplateOpen,
);
export const TokensSingleQuotedExpression = AllTokens.filter(
  (tokenType) => tokenType !== SingleQuote && tokenType !== TemplateOpen,
);

// Text contents inside XML elements.
// Like XML/HTML, the contents here can have `&` XML entities to escape special characters.
// Escaped characters via backslash will be shown as is without escape handling.
export const TokensTextContent = AllTokens.filter(
  (tokenType) => !XmlBracketTokens.includes(tokenType) && tokenType !== TemplateOpen,
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
