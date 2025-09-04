import { CstParser, CstNode, IToken, TokenType } from 'chevrotain';
import {
  AllTokens,
  TokensComment,
  TokensExpression,
  TokensDoubleQuoted,
  TokensSingleQuoted,
  TokensDoubleQuotedExpression,
  TokensSingleQuotedExpression,
  TokensTextContent,
  CommentOpen,
  CommentClose,
  PragmaKeyword,
  TemplateOpen,
  TemplateClose,
  ClosingOpenBracket,
  SelfCloseBracket,
  OpenBracket,
  CloseBracket,
  Equals,
  DoubleQuote,
  SingleQuote,
  Whitespace,
  Identifier,
  extendedPomlLexer,
} from './lexer';

import {
  CstTemplateNode,
  CstQuotedNode,
  CstQuotedTemplateNode,
  CstForIteratorNode,
  CstAttributeNode,
  CstOpenTagPartialNode,
  CstCloseTagNode,
  CstElementNode,
  CstElementContentNode,
  CstCommentNode,
  CstPragmaNode,
  CstLiteralElementNode,
  CstRootNode,
} from './nodes';
import { listComponentAliases } from 'poml/base';

/**
 * Extended POML CST Parser
 *
 * Matches the CST shapes declared in nodes.ts.
 * Rules are declared as class properties so TypeScript "sees" them.
 * Labels are used **only** where the CST interfaces require custom names
 * different from token/rule names (e.g., TagName, WsAfter*, TextContent, etc.).
 */
export class ExtendedPomlParser extends CstParser {
  // ---- Rule property declarations (so TS knows they exist) ----
  public root!: (idxInOriginalText?: number) => CstRootNode;
  public elementContent!: (idxInOriginalText?: number) => CstElementContentNode;
  public template!: (idxInOriginalText?: number) => CstTemplateNode;
  public comment!: (idxInOriginalText?: number) => CstCommentNode;
  public pragma!: (idxInOriginalText?: number) => CstPragmaNode;
  public quoted!: (idxInOriginalText?: number) => CstQuotedNode;
  public quotedTemplate!: (idxInOriginalText?: number) => CstQuotedTemplateNode;
  public forIteratorValue!: (idxInOriginalText?: number) => CstForIteratorNode;
  public attribute!: (idxInOriginalText?: number) => CstAttributeNode;
  public openTagPartial!: (idxInOriginalText?: number) => CstOpenTagPartialNode;
  public closeTag!: (idxInOriginalText?: number) => CstCloseTagNode;
  public element!: (idxInOriginalText?: number) => CstElementNode;
  public literalElement!: (idxInOriginalText?: number) => CstLiteralElementNode;

  // ---- Tag names for rules (for CST nodes) ----
  private validComponentNames: Set<string>;

  // They are handled in file.tsx currently.
  // I think they will be gradually moved to component registry in future.
  private validDirectives: Set<string> = new Set([
    'include',
    'let',
    'output-schema',
    'outputschema',
    'tool-definition',
    'tool-def',
    'tooldef',
    'tool',
    'template',
  ]);
  // This list affects the CST parser stage only.
  private literalTagNames: Set<string> = new Set(['text', 'template']);

  // ---- Small helpers ----
  private anyOf = (tokenTypes: TokenType[], label?: string) =>
    tokenTypes.map((tt) => ({
      ALT: () => (label ? this.CONSUME(tt, { LABEL: label }) : this.CONSUME(tt)),
    }));

  // Lookahead helper: Check if next is whitespace but next non-whitespace token is not of given type
  private isSafeWhitespace = (tokenType: TokenType) => {
    if (this.LA(1).tokenType !== Whitespace) {
      return false;
    }
    let k = 2;
    while (this.LA(k).tokenType === Whitespace) {
      k++;
    }
    return this.LA(k).tokenType !== tokenType;
  };

  private isNextPragma = () => {
    if (this.LA(1).tokenType !== CommentOpen) {
      return false;
    }
    let k = 2;
    while (this.LA(k).tokenType === Whitespace) {
      k++;
    }
    return this.LA(k).tokenType === PragmaKeyword;
  };

  private isNextLiteralOpenTag = () => {
    if (this.LA(1).tokenType !== OpenBracket) {
      return false;
    }
    let k = 2;
    while (this.LA(k).tokenType === Whitespace) {
      k++;
    }
    const tName = this.LA(k);
    if (tName.tokenType !== Identifier) {
      return false;
    }
    const name = (tName.image || '').toLowerCase();
    return name === 'text' || name === 'template';
  };

  private isAtLiteralClose = () => {
    if (this.LA(1).tokenType !== ClosingOpenBracket) {
      return false;
    }
    let k = 2;
    while (this.LA(k).tokenType === Whitespace) {
      k++;
    }
    const t = this.LA(k);
    if (t.tokenType !== Identifier) {
      return false;
    }
    const name = (t.image || '').toLowerCase();

    // TODO: should match the opening tag name
    return name === 'text' || name === 'template';
  };

  private isValidOpenTag = (tagName: string) => {
    // When pragma strict is enabled, only known component names are allowed as tags.
    // Other component names will show as errors in the semantic analysis stage.
    // When pragma strict is not enabled, tag names that are not known components
    // will be treated as texts.
    return this.validComponentNames.has(tagName.toLowerCase());
  };

  constructor() {
    super(AllTokens, {
      outputCst: true,
      recoveryEnabled: true,
    });
    this.validComponentNames = new Set(listComponentAliases());

    // ---------------------------
    // RULE DEFINITIONS (as properties)
    // ---------------------------

    this.root = this.RULE('root', () => {
      // CstRootNode: { Content?: CstElementContentNode[] }
      this.MANY(() => {
        this.SUBRULE(this.elementContent, { LABEL: 'Content' });
      });
    });

    this.elementContent = this.RULE('elementContent', () => {
      this.OR([
        // pragma (must come before raw comment)
        {
          GATE: this.isNextPragma,
          ALT: () => this.SUBRULE(this.pragma, { LABEL: 'Pragma' }),
        },
        // regular comment
        {
          ALT: () => this.SUBRULE(this.comment, { LABEL: 'Comment' }),
        },

        // template
        {
          GATE: () => this.LA(1).tokenType === TemplateOpen,
          ALT: () => this.SUBRULE(this.template, { LABEL: 'Template' }),
        },

        // literal element: <text> or <template> acting as literal
        {
          GATE: this.isNextLiteralOpenTag,
          ALT: () => this.SUBRULE(this.literalElement, { LABEL: 'LiteralElement' }),
        },

        // normal element
        {
          ALT: () => this.SUBRULE(this.element, { LABEL: 'Element' }),
        },

        // raw text content
        {
          ALT: () => {
            this.AT_LEAST_ONE(() => {
              this.OR(this.anyOf(TokensTextContent, 'TextContent'));
            });
          },
        },
      ]);
    });

    this.template = this.RULE('template', () => {
      this.CONSUME(TemplateOpen);
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));

      this.AT_LEAST_ONE(() => {
        this.OR([
          {
            // mid-content whitespace: only if NOT followed by TemplateClose
            GATE: () => this.isSafeWhitespace(TemplateClose),
            ALT: () => this.CONSUME1(Whitespace, { LABEL: 'Content' }),
          },
          // everything else in TokensExpression except Whitespace (handled above)
          ...this.anyOf(
            TokensExpression.filter((t) => t !== Whitespace),
            'Content',
          ),
        ]);
      });

      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterContent' }));
      this.CONSUME(TemplateClose);
    });

    this.comment = this.RULE('comment', () => {
      this.CONSUME(CommentOpen);
      this.MANY(() => {
        // anything until -->
        this.OR(this.anyOf(TokensComment, 'Content'));
      });
      this.CONSUME(CommentClose);
    });

    this.pragma = this.RULE('pragma', () => {
      this.CONSUME(CommentOpen);
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));
      this.CONSUME(PragmaKeyword);
      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterPragma' }));

      // identifier after @pragma
      this.CONSUME(Identifier, { LABEL: 'PragmaIdentifier' });

      // Options: unquoted tokens or quoted strings (no templates inside these)
      this.MANY(() => {
        this.CONSUME3(Whitespace, { LABEL: 'WsBeforeEachOption' });
        this.OR([
          {
            ALT: () => this.SUBRULE(this.quoted, { LABEL: 'PragmaOption' }),
          },
          {
            ALT: () => this.CONSUME2(Identifier, { LABEL: 'PragmaOption' }),
          },
        ]);
      });

      this.OPTION3(() => this.CONSUME4(Whitespace, { LABEL: 'WsAfterAll' }));

      this.CONSUME(CommentClose);
    });

    this.quoted = this.RULE('quoted', () => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(DoubleQuote, { LABEL: 'OpenQuote' });
            this.MANY(() => {
              this.OR(this.anyOf(TokensDoubleQuoted, 'Content'));
            });
            this.CONSUME2(DoubleQuote, { LABEL: 'CloseQuote' });
          },
        },
        {
          ALT: () => {
            this.CONSUME(SingleQuote, { LABEL: 'OpenQuote' });
            this.MANY(() => {
              this.OR(this.anyOf(TokensSingleQuoted, 'Content'));
            });
            this.CONSUME2(SingleQuote, { LABEL: 'CloseQuote' });
          },
        },
      ]);
    });

    this.quotedTemplate = this.RULE('quotedTemplate', () => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(DoubleQuote, { LABEL: 'OpenQuote' });
            this.MANY(() => {
              this.OR([
                { ALT: () => this.SUBRULE(this.template, { LABEL: 'Content' }) },
                { ALT: () => this.OR(this.anyOf(TokensDoubleQuotedExpression, 'Content')) },
              ]);
            });
            this.CONSUME2(DoubleQuote, { LABEL: 'CloseQuote' });
          },
        },
        {
          ALT: () => {
            this.CONSUME(SingleQuote, { LABEL: 'OpenQuote' });
            this.MANY(() => {
              this.OR([
                { ALT: () => this.SUBRULE(this.template, { LABEL: 'Content' }) },
                { ALT: () => this.OR(this.anyOf(TokensSingleQuotedExpression, 'Content')) },
              ]);
            });
            this.CONSUME2(SingleQuote, { LABEL: 'CloseQuote' });
          },
        },
      ]);
    });

    this.forIteratorValue = this.RULE('forIteratorValue', () => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(DoubleQuote, { LABEL: 'OpenQuote' });
            this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));
            this.CONSUME(Identifier, { LABEL: 'Iterator' });
            this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterIterator' }));
            this.CONSUME2(Identifier, { LABEL: 'InKeyword' });
            this.OPTION3(() => this.CONSUME3(Whitespace, { LABEL: 'WsAfterIn' }));
            // It's written as a double quoted expression without {{ }} here
            // but it will be treated as an expression in the semantic analysis stage.
            (this.AT_LEAST_ONE(() => {
              this.OR([
                {
                  GATE: () => this.isSafeWhitespace(DoubleQuote),
                  ALT: () => this.CONSUME4(Whitespace, { LABEL: 'Collection' }),
                },
                ...this.anyOf(
                  TokensDoubleQuoted.filter((t) => t !== Whitespace),
                  'Collection',
                ),
              ]);
            }),
              this.OPTION4(() => this.CONSUME5(Whitespace, { LABEL: 'WsAfterCollection' })));
            this.CONSUME2(DoubleQuote, { LABEL: 'CloseQuote' });
          },
        },
        {
          ALT: () => {
            this.CONSUME(SingleQuote, { LABEL: 'OpenQuote' });
            this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));
            this.CONSUME3(Identifier, { LABEL: 'Iterator' });
            this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterIterator' }));
            this.CONSUME4(Identifier, { LABEL: 'InKeyword' });
            this.OPTION3(() => this.CONSUME3(Whitespace, { LABEL: 'WsAfterIn' }));
            // Similar for single quoted expression
            (this.AT_LEAST_ONE(() => {
              this.OR([
                {
                  GATE: () => this.isSafeWhitespace(SingleQuote),
                  ALT: () => this.CONSUME4(Whitespace, { LABEL: 'Collection' }),
                },
                ...this.anyOf(
                  TokensSingleQuoted.filter((t) => t !== Whitespace),
                  'Collection',
                ),
              ]);
            }),
              this.OPTION4(() => this.CONSUME5(Whitespace, { LABEL: 'WsAfterCollection' })));
            this.CONSUME2(SingleQuote, { LABEL: 'CloseQuote' });
          },
        },
      ]);
    });

    this.attribute = this.RULE('attribute', () => {
      const keyTok = this.CONSUME(Identifier, { LABEL: 'AttributeKey' });
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterKey' }));
      this.CONSUME(Equals); // label not needed; token name matches
      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterEquals' }));

      this.OR([
        // for="..."
        {
          GATE: () =>
            keyTok.image?.toLowerCase() === 'for' &&
            (this.LA(1).tokenType === DoubleQuote || this.LA(1).tokenType === SingleQuote),
          ALT: () => this.SUBRULE(this.forIteratorValue, { LABEL: 'forIteratorValue' }),
        },
        // templatedValue: {{ ... }}
        {
          GATE: () => this.LA(1).tokenType === TemplateOpen,
          ALT: () => this.SUBRULE(this.template, { LABEL: 'templatedValue' }),
        },
        // quotedValue: "..."/'...' (may contain templates)
        { ALT: () => this.SUBRULE(this.quotedTemplate, { LABEL: 'quotedValue' }) },
      ]);
    });

    this.openTagPartial = this.RULE('openTagPartial', () => {
      this.CONSUME(OpenBracket);
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));
      this.CONSUME(Identifier, { LABEL: 'TagName' });
      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterName' }));
      this.MANY(() => {
        this.OPTION3(() => this.CONSUME3(Whitespace, { LABEL: 'WsBeforeEachAttribute' }));
        this.SUBRULE(this.attribute, { LABEL: 'Attribute' });
      });
      this.OPTION4(() => this.CONSUME4(Whitespace, { LABEL: 'WsAfterAll' }));
    });

    this.closeTag = this.RULE('closeTag', () => {
      this.CONSUME(ClosingOpenBracket);
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));
      this.CONSUME(Identifier, { LABEL: 'TagName' });
      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsBeforeClose' }));
      this.CONSUME(CloseBracket);
    });

    this.element = this.RULE('element', () => {
      this.SUBRULE(this.openTagPartial, { LABEL: 'OpenTagPartial' });
      this.OR([
        {
          ALT: () => {
            this.CONSUME(CloseBracket, { LABEL: 'OpenTagCloseBracket' });
            this.MANY(() => {
              this.SUBRULE(this.elementContent, { LABEL: 'Content' });
            });
            this.SUBRULE(this.closeTag, { LABEL: 'CloseTag' });
          },
        },
        {
          ALT: () => {
            this.CONSUME(SelfCloseBracket, { LABEL: 'SelfCloseBracket' });
          },
        },
      ]);
    });

    this.literalElement = this.RULE('literalElement', () => {
      this.SUBRULE(this.openTagPartial, { LABEL: 'OpenTagPartial' });
      this.CONSUME(CloseBracket, { LABEL: 'OpenTagCloseBracket' });

      // TODO: the ending tag should match the starting tag name (text/template)
      // Everything until the matching </text> or </template> is treated as raw text
      this.MANY(() => {
        this.OR([
          {
            GATE: () => !this.isAtLiteralClose(),
            ALT: () => this.OR(this.anyOf(AllTokens, 'TextContent')),
          },
        ]);
      });

      this.SUBRULE(this.closeTag, { LABEL: 'CloseTag' });
    });

    this.performSelfAnalysis();
  }

  public parseRoot(): CstNode {
    // Invoke the entry rule (property is a function)
    return this.root();
  }
}

// Singleton parser
export const extendedPomlParser = new ExtendedPomlParser();

export function parsePomlToCst(input: string): {
  cst: CstNode | undefined;
  lexErrors: ReturnType<typeof extendedPomlLexer.tokenize>['errors'];
  parseErrors: ReturnType<ExtendedPomlParser['getErrors']>;
} {
  const lex = extendedPomlLexer.tokenize(input);
  extendedPomlParser.input = lex.tokens;
  const cst = extendedPomlParser.parseRoot();
  return {
    cst,
    lexErrors: lex.errors,
    parseErrors: extendedPomlParser.errors,
  };
}
