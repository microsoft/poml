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
  CstCommentTokens,
  CstExpressionTokens,
  CstDoubleQuotedTokens,
  CstDoubleQuotedTrimmedTokens,
  CstSingleQuotedTokens,
  CstSingleQuotedTrimmedTokens,
  CstDoubleQuotedExpressionTokens,
  CstSingleQuotedExpressionTokens,
  CstBetweenTagsTokens,
  CstLiteralTagTokens,
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
  // token-sequence helper rules
  public commentTokens!: (idxInOriginalText?: number) => CstCommentTokens;
  public expressionTokens!: (idxInOriginalText?: number) => CstExpressionTokens;
  public doubleQuotedTokens!: (idxInOriginalText?: number) => CstDoubleQuotedTokens;
  public singleQuotedTokens!: (idxInOriginalText?: number) => CstSingleQuotedTokens;
  public doubleQuotedTrimmedTokens!: (idxInOriginalText?: number) => CstDoubleQuotedTrimmedTokens;
  public singleQuotedTrimmedTokens!: (idxInOriginalText?: number) => CstSingleQuotedTrimmedTokens;
  public doubleQuotedExpressionTokens!: (idxInOriginalText?: number) => CstDoubleQuotedExpressionTokens;
  public singleQuotedExpressionTokens!: (idxInOriginalText?: number) => CstSingleQuotedExpressionTokens;
  public betweenTagsTokens!: (idxInOriginalText?: number) => CstBetweenTagsTokens;
  // Accepting expectedTagName as argument to validate matching close tag
  public literalTagTokens!: (idxInOriginalText?: number, args?: [string]) => CstLiteralTagTokens;
  // regular rules
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
  private atAlmostClose = (tokenType: TokenType) => {
    let k = 1;
    if (this.LA(k).tokenType === Whitespace) {
      k++;
    }
    return this.LA(k).tokenType === tokenType;
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

  private isAtLiteralClose = (expectedTagName: string | undefined) => {
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

    return name === expectedTagName?.toLowerCase();
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

        // normal element
        {
          ALT: () => this.SUBRULE(this.element, { LABEL: 'Element' }),
        },

        // raw text content
        {
          ALT: () => {
            // Group text between tags under CstBetweenTagsTokens
            this.SUBRULE(this.betweenTagsTokens, { LABEL: 'TextContent' });
          },
        },
      ]);
    });

    // ----- Token sequence helper rules -----
    this.commentTokens = this.RULE('commentTokens', () => {
      this.MANY(() => {
        this.OR(this.anyOf(TokensComment, 'Content'));
      });
    });

    this.expressionTokens = this.RULE('expressionTokens', () => {
      this.AT_LEAST_ONE({
        GATE: () => !this.atAlmostClose(TemplateClose),
        DEF: () => {
          this.OR(this.anyOf(TokensExpression, 'Content'));
        },
      });
    });

    this.doubleQuotedTokens = this.RULE('doubleQuotedTokens', () => {
      this.MANY(() => {
        this.OR(this.anyOf(TokensDoubleQuoted, 'Content'));
      });
    });

    this.singleQuotedTokens = this.RULE('singleQuotedTokens', () => {
      this.MANY(() => {
        this.OR(this.anyOf(TokensSingleQuoted, 'Content'));
      });
    });

    this.doubleQuotedTrimmedTokens = this.RULE('doubleQuotedTrimmedTokens', () => {
      // Greedily match until the next double quote (allow inner whitespace)
      this.AT_LEAST_ONE({
        GATE: () => !this.atAlmostClose(DoubleQuote),
        DEF: () => {
          this.OR(this.anyOf(TokensDoubleQuoted, 'Content'));
        },
      });
    });

    this.singleQuotedTrimmedTokens = this.RULE('singleQuotedTrimmedTokens', () => {
      // Greedily match until the next single quote (allow inner whitespace)
      this.AT_LEAST_ONE({
        GATE: () => !this.atAlmostClose(SingleQuote),
        DEF: () => {
          this.OR(this.anyOf(TokensSingleQuoted, 'Content'));
        },
      });
    });

    this.doubleQuotedExpressionTokens = this.RULE('doubleQuotedExpressionTokens', () => {
      this.AT_LEAST_ONE(() => {
        this.OR(this.anyOf(TokensDoubleQuotedExpression, 'Content'));
      });
    });

    this.singleQuotedExpressionTokens = this.RULE('singleQuotedExpressionTokens', () => {
      this.AT_LEAST_ONE(() => {
        this.OR(this.anyOf(TokensSingleQuotedExpression, 'Content'));
      });
    });

    this.betweenTagsTokens = this.RULE('betweenTagsTokens', () => {
      this.AT_LEAST_ONE(() => {
        this.OR(this.anyOf(TokensTextContent, 'Content'));
      });
    });

    this.literalTagTokens = this.RULE('literalTagTokens', (expectedTagName?: string) => {
      this.AT_LEAST_ONE({
        GATE: () => !this.isAtLiteralClose(expectedTagName),
        DEF: () => {
          this.OR(this.anyOf(TokensTextContent, 'Content'));
        },
      });
    });

    // ----- Main rules -----

    this.template = this.RULE('template', () => {
      this.CONSUME(TemplateOpen);
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));
      this.SUBRULE(this.expressionTokens, { LABEL: 'Content' });
      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterContent' }));
      this.CONSUME2(TemplateClose);
    });

    this.comment = this.RULE('comment', () => {
      this.CONSUME(CommentOpen);
      // anything until -->
      this.SUBRULE(this.commentTokens, { LABEL: 'Content' });
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
            this.SUBRULE(this.doubleQuotedTokens, { LABEL: 'Content' });
            this.CONSUME2(DoubleQuote, { LABEL: 'CloseQuote' });
          },
        },
        {
          ALT: () => {
            this.CONSUME(SingleQuote, { LABEL: 'OpenQuote' });
            this.SUBRULE(this.singleQuotedTokens, { LABEL: 'Content' });
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
              this.OR2([
                { ALT: () => this.SUBRULE(this.template, { LABEL: 'Content' }) },
                {
                  ALT: () => this.SUBRULE2(this.doubleQuotedExpressionTokens, { LABEL: 'Content' }),
                },
              ]);
            });
            this.CONSUME2(DoubleQuote, { LABEL: 'CloseQuote' });
          },
        },
        {
          ALT: () => {
            this.CONSUME(SingleQuote, { LABEL: 'OpenQuote' });
            this.MANY2(() => {
              this.OR3([
                { ALT: () => this.SUBRULE3(this.template, { LABEL: 'Content' }) },
                {
                  ALT: () => this.SUBRULE4(this.singleQuotedExpressionTokens, { LABEL: 'Content' }),
                },
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
            this.CONSUME2(Whitespace, { LABEL: 'WsAfterIterator' });
            this.CONSUME2(Identifier, { LABEL: 'InKeyword' });
            this.CONSUME3(Whitespace, { LABEL: 'WsAfterIn' });
            // Greedily match until the next unescaped quote
            this.SUBRULE(this.doubleQuotedTrimmedTokens, { LABEL: 'Collection' });
            this.OPTION2(() => this.CONSUME4(Whitespace, { LABEL: 'WsAfterCollection' }));
            this.CONSUME2(DoubleQuote, { LABEL: 'CloseQuote' });
          },
        },
        {
          ALT: () => {
            this.CONSUME(SingleQuote, { LABEL: 'OpenQuote' });
            this.OPTION3(() => this.CONSUME5(Whitespace, { LABEL: 'WsAfterOpen' }));
            this.CONSUME3(Identifier, { LABEL: 'Iterator' });
            this.CONSUME6(Whitespace, { LABEL: 'WsAfterIterator' });
            this.CONSUME4(Identifier, { LABEL: 'InKeyword' });
            this.CONSUME7(Whitespace, { LABEL: 'WsAfterIn' });
            // Greedily match until the next unescaped quote
            this.SUBRULE(this.singleQuotedTrimmedTokens, { LABEL: 'Collection' });
            this.OPTION4(() => this.CONSUME8(Whitespace, { LABEL: 'WsAfterCollection' }));
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
      const tagTok = this.CONSUME(Identifier, { LABEL: 'TagName' });
      this.MANY(() => {
        this.CONSUME2(Whitespace, { LABEL: 'WsBeforeEachAttribute' });
        this.SUBRULE(this.attribute, { LABEL: 'Attribute' });
      });
      this.OPTION2(() => this.CONSUME3(Whitespace, { LABEL: 'WsAfterAll' }));

      // Compute & return semantic info (to discriminate literal tags and text tags)
      return this.ACTION(() => ({
        tagName: tagTok.image,
        isLiteral: this.literalTagNames.has(tagTok.image.toLowerCase()),
      }));
    });

    this.closeTag = this.RULE('closeTag', () => {
      this.CONSUME(ClosingOpenBracket);
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));
      this.CONSUME(Identifier, { LABEL: 'TagName' });
      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsBeforeClose' }));
      this.CONSUME(CloseBracket);
    });

    this.element = this.RULE('element', () => {
      const { tagName, isLiteral } = this.SUBRULE(this.openTagPartial, {
        LABEL: 'OpenTagPartial',
      }) as CstOpenTagPartialNode;

      this.OR([
        {
          GATE: () => Boolean(isLiteral),
          ALT: () => {
            // Literal element logic - must have closing tag, no self-close
            this.CONSUME(CloseBracket, { LABEL: 'OpenTagCloseBracket' });

            // Everything until the matching close tag is treated as raw text
            this.SUBRULE(this.literalTagTokens, { ARGS: [tagName], LABEL: 'TextContent' });

            this.SUBRULE(this.closeTag, { LABEL: 'CloseTag' });
          },
        },
        {
          ALT: () => {
            this.CONSUME2(CloseBracket, { LABEL: 'OpenTagCloseBracket' });
            this.MANY(() => {
              this.SUBRULE(this.elementContent, { LABEL: 'Content' });
            });
            this.SUBRULE2(this.closeTag);
          },
        },
        {
          ALT: () => {
            // Self-closing tag - no content, no closing tag
            this.CONSUME(SelfCloseBracket);
          },
        },
      ]);
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
  parseErrors: typeof extendedPomlParser.errors;
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
