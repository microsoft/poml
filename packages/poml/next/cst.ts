// cstParser.ts
import { CstParser, IToken, TokenType, CstNode } from 'chevrotain';

import {
  // tokens & sets
  AllTokens,
  TokensComment,
  TokensExpression,
  TokensDoubleQuoted,
  TokensSingleQuoted,
  TokensDoubleQuotedExpression,
  TokensSingleQuotedExpression,
  TokensTextContent,
  // individual tokens
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
  // lexer instance
  extendedPomlLexer,
} from './lexer';

/**
 * Extended POML CST Parser
 *
 * This implements the CST shapes specified in nodes.ts for:
 * - Root, Elements, LiteralElements, SelfCloseElements
 * - Open/Close tags, Attributes (quoted, templated, for-iterator)
 * - Templates ({{ ... }}), Comments, Pragmas
 * - Text content (tokens that are not start of tags/templates)
 *
 * NOTE:
 *  - Semantic checks (e.g., ensuring "in" in for-iterator, tag name match for literal elements)
 *    are intentionally loose at CST stage. Enforce these during AST transform if needed.
 */
export class ExtendedPomlParser extends CstParser {
  constructor() {
    super(AllTokens, {
      recoveryEnabled: true, // be generous during CST stage
      outputCst: true,
    });

    // ---------------------------
    // Helper producers (must be used inside RULE bodies so that `this` is bound)
    // ---------------------------

    // Produce an OR() alternatives array that consumes any one of the given tokenTypes,
    // labeling each consumed token under `label` (so all collected under the same key).
    const anyOf = (tokenTypes: TokenType[], label?: string) =>
      tokenTypes.map((tt) => ({
        ALT: () => (label ? this.CONSUME(tt, { LABEL: label }) : this.CONSUME(tt)),
      }));

    // Lookahead helpers
    const isNextPragma = () => {
      // Peek after <!-- and optional whitespace: expect @pragma
      if (this.LA(1).tokenType !== CommentOpen) {
return false;
}
      let k = 2;
      while (this.LA(k).tokenType === Whitespace) {
k++;
}
      return this.LA(k).tokenType === PragmaKeyword;
    };

    const isNextLiteralOpenTag = () => {
      // Detect: < [ws]* Identifier("text" | "template")
      if (this.LA(1).tokenType !== OpenBracket) {
return false;
}
      let k = 2;
      // optional whitespace after "<"
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

    // ---------------------------
    // Grammar Rules
    // ---------------------------

    this.RULE('root', () => {
      // CstRootNode: { Content?: CstElementContentNode[] }
      this.MANY(() => {
        this.SUBRULE(this.elementContentNode, { LABEL: 'Content' });
      });
    });

    // Content inside elements/root (everything except a matching CloseTag)
    this.RULE('elementContentNode', () => {
      this.OR([
        // pragma must be before comment
        {
          GATE: isNextPragma,
          ALT: () => this.SUBRULE(this.pragma, { LABEL: 'Pragma' }),
        },
        { ALT: () => this.SUBRULE(this.comment, { LABEL: 'Comment' }) },

        // templates
        {
          GATE: () => this.LA(1).tokenType === TemplateOpen,
          ALT: () => this.SUBRULE(this.templateNode, { LABEL: 'Template' }),
        },

        // self-close elements (<tag .../>)
        {
          // use backtracking to disambiguate quickly
          GATE: this.BACKTRACK(this.selfCloseElement),
          ALT: () => this.SUBRULE(this.selfCloseElement, { LABEL: 'SelfCloseElement' }),
        },

        // literal elements <text>...</text> or <template>...</template>
        {
          GATE: isNextLiteralOpenTag,
          ALT: () => this.SUBRULE(this.literalElement, { LABEL: 'LiteralElement' }),
        },

        // normal <tag> ... </tag>
        {
          GATE: () => this.LA(1).tokenType === OpenBracket,
          ALT: () => this.SUBRULE(this.element, { LABEL: 'Element' }),
        },

        // fallback: raw text content
        {
          ALT: () => {
            this.AT_LEAST_ONE(() => {
              this.OR(anyOf(TokensTextContent, 'TextContent'));
            });
          },
        },
      ]);
    });

    // {{ ... }}
    this.RULE('templateNode', () => {
      this.CONSUME(TemplateOpen, { LABEL: 'TemplateOpen' });
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));

      this.AT_LEAST_ONE(() => {
        // Everything except TemplateClose (already enforced in TokensExpression)
        this.OR(anyOf(TokensExpression, 'Content'));
      });

      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterContent' }));
      this.CONSUME(TemplateClose, { LABEL: 'TemplateClose' });
    });

    // <!-- ... -->
    this.RULE('comment', () => {
      this.CONSUME(CommentOpen, { LABEL: 'CommentOpen' });
      this.MANY(() => {
        // Anything until CommentClose
        this.OR(anyOf(TokensComment, 'Content'));
      });
      this.CONSUME(CommentClose, { LABEL: 'CommentClose' });
    });

    // <!-- @pragma ... -->
    this.RULE('pragma', () => {
      this.CONSUME(CommentOpen, { LABEL: 'CommentOpen' });
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));
      this.CONSUME(PragmaKeyword, { LABEL: 'PragmaKeyword' });
      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterPragma' }));

      // identifier after @pragma
      this.CONSUME(Identifier, { LABEL: 'PragmaIdentifier' });
      this.OPTION3(() => this.CONSUME3(Whitespace, { LABEL: 'WsAfterIdentifier' }));

      // Options: unquoted tokens or quoted strings (no templates inside these)
      this.MANY(() => {
        this.OR([
          {
            ALT: () => this.SUBRULE(this.quotedNoTemplate, { LABEL: 'PragmaOption' }),
          },
          {
            ALT: () => {
              // unquoted: anything non-whitespace & not closing
              this.OR(
                anyOf(
                  AllTokens.filter(
                    (t) => t !== CommentClose && t !== Whitespace && t !== DoubleQuote && t !== SingleQuote,
                  ),
                  'PragmaOption',
                ),
              );
            },
          },
        ]);
        this.OPTION4(() => this.CONSUME4(Whitespace, { LABEL: 'WsAfterContent' }));
      });

      this.CONSUME(CommentClose, { LABEL: 'CommentClose' });
    });

    // "..." or '...' — used only in pragma options (no templates allowed)
    this.RULE('quotedNoTemplate', () => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(DoubleQuote, { LABEL: 'OpenQuote' });
            this.MANY(() => {
              this.OR(anyOf(TokensDoubleQuoted, 'Content'));
            });
            this.CONSUME2(DoubleQuote, { LABEL: 'CloseQuote' });
          },
        },
        {
          ALT: () => {
            this.CONSUME(SingleQuote, { LABEL: 'OpenQuote' });
            this.MANY(() => {
              this.OR(anyOf(TokensSingleQuoted, 'Content'));
            });
            this.CONSUME2(SingleQuote, { LABEL: 'CloseQuote' });
          },
        },
      ]);
    });

    // Attribute value: quoted text that MAY contain templates
    this.RULE('quotedTemplate', () => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(DoubleQuote, { LABEL: 'OpenQuote' });
            this.MANY(() => {
              this.OR([
                { ALT: () => this.SUBRULE(this.templateNode, { LABEL: 'Content' }) },
                { ALT: () => this.OR(anyOf(TokensDoubleQuotedExpression, 'Content')) },
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
                { ALT: () => this.SUBRULE(this.templateNode, { LABEL: 'Content' }) },
                { ALT: () => this.OR(anyOf(TokensSingleQuotedExpression, 'Content')) },
              ]);
            });
            this.CONSUME2(SingleQuote, { LABEL: 'CloseQuote' });
          },
        },
      ]);
    });

    // for="iterator in collection" (quoted; inside quotes, treat like expression until closing quote)
    this.RULE('forIteratorValue', () => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(DoubleQuote, { LABEL: 'OpenQuote' });
            this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterOpen' }));

            // iterator
            this.CONSUME(Identifier, { LABEL: 'Iterator' });
            this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterIterator' }));

            // "in" keyword (lexed as Identifier). Semantic check deferred to AST.
            this.CONSUME2(Identifier, { LABEL: 'InKeyword' });
            this.OPTION3(() => this.CONSUME3(Whitespace, { LABEL: 'WsAfterIn' }));

            // collection expression (like inside template), stop before optional ws + closing quote
            this.AT_LEAST_ONE(() => {
              this.OR(anyOf(TokensDoubleQuotedExpression, 'Collection'));
            });

            this.OPTION4(() => this.CONSUME4(Whitespace, { LABEL: 'WsAfterCollection' }));
            this.CONSUME2(DoubleQuote, { LABEL: 'CloseQuote' });
          },
        },
        {
          ALT: () => {
            this.CONSUME(SingleQuote, { LABEL: 'OpenQuote' });
            this.OPTION5(() => this.CONSUME5(Whitespace, { LABEL: 'WsAfterOpen' }));

            this.CONSUME3(Identifier, { LABEL: 'Iterator' });
            this.OPTION6(() => this.CONSUME6(Whitespace, { LABEL: 'WsAfterIterator' }));

            this.CONSUME4(Identifier, { LABEL: 'InKeyword' });
            this.OPTION7(() => this.CONSUME7(Whitespace, { LABEL: 'WsAfterIn' }));

            this.AT_LEAST_ONE2(() => {
              this.OR(anyOf(TokensSingleQuotedExpression, 'Collection'));
            });

            this.OPTION8(() => this.CONSUME8(Whitespace, { LABEL: 'WsAfterCollection' }));
            this.CONSUME2(SingleQuote, { LABEL: 'CloseQuote' });
          },
        },
      ]);
    });

    // Attribute: key = (quoted value | templated value | for-iterator)
    this.RULE('attribute', () => {
      const keyTok = this.CONSUME(Identifier, { LABEL: 'AttributeKey' });
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterKey' }));
      this.CONSUME(Equals, { LABEL: 'Equals' });
      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterEquals' }));

      this.OR([
        // for="..."
        {
          GATE: () =>
            keyTok.image?.toLowerCase() === 'for' &&
            (this.LA(1).tokenType === DoubleQuote || this.LA(1).tokenType === SingleQuote),
          ALT: () => this.SUBRULE(this.forIteratorValue, { LABEL: 'forIteratorValue' }),
        },

        // value={{ ... }} (unquoted template)
        {
          GATE: () => this.LA(1).tokenType === TemplateOpen,
          ALT: () => this.SUBRULE(this.templateNode, { LABEL: 'templatedValue' }),
        },

        // "..." / '...' (may contain templates)
        { ALT: () => this.SUBRULE(this.quotedTemplate, { LABEL: 'quotedValue' }) },
      ]);
    });

    // <tag ...>
    this.RULE('openTag', () => {
      this.CONSUME(OpenBracket, { LABEL: 'OpenBracket' });
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterBracket' }));

      this.CONSUME(Identifier, { LABEL: 'TagName' });
      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterName' }));

      this.MANY(() => {
        this.SUBRULE(this.attribute, { LABEL: 'Attribute' });
        this.OPTION3(() => this.CONSUME3(Whitespace, { LABEL: 'WsAfterAttribute' }));
      });

      this.CONSUME(CloseBracket, { LABEL: 'CloseBracket' });
    });

    // </tag>
    this.RULE('closeTag', () => {
      this.CONSUME(ClosingOpenBracket, { LABEL: 'ClosingOpenBracket' });
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterBracket' }));
      this.CONSUME(Identifier, { LABEL: 'TagName' });
      this.CONSUME(CloseBracket, { LABEL: 'CloseBracket' });
    });

    // <tag .../> (complete element, no content)
    this.RULE('selfCloseElement', () => {
      this.CONSUME(OpenBracket, { LABEL: 'OpenBracket' });
      this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'WsAfterBracket' }));
      this.CONSUME(Identifier, { LABEL: 'TagName' });
      this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'WsAfterName' }));

      this.MANY(() => {
        this.SUBRULE(this.attribute, { LABEL: 'Attribute' });
        this.OPTION3(() => this.CONSUME3(Whitespace, { LABEL: 'WsAfterAttribute' }));
      });

      this.CONSUME(SelfCloseBracket, { LABEL: 'SelfCloseBracket' });
    });

    // <tag> ... </tag>
    this.RULE('element', () => {
      this.SUBRULE(this.openTag, { LABEL: 'OpenTag' });
      this.MANY(() => {
        // stop on a close tag
        this.SUBRULE(this.elementContentNode, { LABEL: 'Content' });
      });
      this.SUBRULE(this.closeTag, { LABEL: 'CloseTag' });
    });

    // <text> ...literal (no templates/tags parsed)... </text>
    // or <template> ...literal... </template> (per your notes)
    this.RULE('literalElement', () => {
      this.SUBRULE(this.openTag, { LABEL: 'OpenTag' });

      // Eat *everything* until a ClosingOpenBracket + (optional ws) + Identifier('text'|'template') + '>'
      this.AT_LEAST_ONE(() => {
        this.OR([
          // Continue consuming anything that is not the start of the matching close.
          {
            GATE: () => {
              if (this.LA(1).tokenType !== ClosingOpenBracket) {
return true;
}
              // look ahead to see if it's </text> or </template>
              let k = 2;
              while (this.LA(k).tokenType === Whitespace) {
k++;
}
              const t = this.LA(k);
              if (t.tokenType !== Identifier) {
return true;
}
              const name = (t.image || '').toLowerCase();
              return !(name === 'text' || name === 'template');
            },
            ALT: () => {
              // Treat all as raw text content
              this.OR(
                anyOf(
                  AllTokens.filter((t) => t !== ClosingOpenBracket), // minimal guard
                  'TextContent',
                ),
              );
            },
          },
        ]);
      });

      this.SUBRULE(this.closeTag, { LABEL: 'CloseTag' });
    });

    this.performSelfAnalysis();
  }

  // Expose entry for external callers (TypeScript-friendly)
  public parseRoot(): CstNode {
    // @ts-expect-error Chevrotain types: RULE name maps to a function
    return this.root();
  }
}

// Singleton parser instance
export const extendedPomlParser = new ExtendedPomlParser();

/**
 * Convenience: tokenize + parse in one call.
 */
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
