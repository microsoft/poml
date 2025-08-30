export class PomlCstParser extends CstParser {
  // Define rules as public methods
  public document!: () => DocumentCstNode;
  public content!: () => ContentCstNode;
  public element!: () => ElementCstNode;
  public literalElement!: () => LiteralElementCstNode;
  public selfCloseElement!: () => SelfCloseElementCstNode;
  public openTag!: () => OpenTagCstNode;
  public closeTag!: () => CloseTagCstNode;
  public attributes!: () => AttributesCstNode;
  public attribute!: () => AttributeCstNode;
  public attributeValue!: () => AttributeValueCstNode;
  public quotedValue!: () => QuotedValueCstNode;
  public unquotedValue!: () => UnquotedValueCstNode;
  public valueContent!: () => ValueContentCstNode;
  public escapedChar!: () => EscapedCharCstNode;
  public forIterator!: () => ForIteratorCstNode;
  public template!: () => TemplateCstNode;
  public value!: () => ValueCstNode;
  public valueElement!: () => ValueElementCstNode;
  public comment!: () => CommentCstNode;
  public pragma!: () => PragmaCstNode;

  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      nodeLocationTracking: 'full',
    });

    this.performSelfAnalysis();
  }

  // Document is the root rule
  private documentRule = this.RULE('document', () => {
    this.MANY(() => {
      this.OR([{ ALT: () => this.CONSUME(Whitespace) }, { ALT: () => this.SUBRULE(this.content) }]);
    });
  });

  // Content can be elements, comments, pragmas, or values
  private contentRule = this.RULE('content', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.pragma) },
      { ALT: () => this.SUBRULE(this.comment) },
      { ALT: () => this.SUBRULE(this.element) },
      { ALT: () => this.SUBRULE(this.literalElement) },
      { ALT: () => this.SUBRULE(this.selfCloseElement) },
      { ALT: () => this.SUBRULE(this.value) },
    ]);
  });

  // Regular element with open/close tags
  private elementRule = this.RULE('element', () => {
    const openTag = this.SUBRULE(this.openTag);
    this.MANY(() => {
      this.OR([{ ALT: () => this.CONSUME(Whitespace) }, { ALT: () => this.SUBRULE(this.content) }]);
    });
    this.SUBRULE(this.closeTag);
  });

  // Literal element (like <text>) that preserves content
  private literalElementRule = this.RULE('literalElement', () => {
    this.SUBRULE(this.openTag);
    // Consume everything until matching close tag
    this.MANY(() => {
      this.OR([
        // Look ahead for closing tag
        {
          GATE: () => !this.isClosingTag(),
          ALT: () => this.consumeAny(),
        },
      ]);
    });
    this.SUBRULE(this.closeTag);
  });

  // Self-closing element
  private selfCloseElementRule = this.RULE('selfCloseElement', () => {
    this.CONSUME(TagOpen);
    this.CONSUME(Identifier, { LABEL: 'tagName' });
    this.OPTION(() => {
      this.CONSUME(Whitespace);
      this.OPTION2(() => this.SUBRULE(this.attributes));
    });
    this.CONSUME(TagSelfClose);
  });

  // Opening tag
  private openTagRule = this.RULE('openTag', () => {
    this.CONSUME(TagOpen);
    this.CONSUME(Identifier, { LABEL: 'tagName' });
    this.OPTION(() => {
      this.CONSUME(Whitespace);
      this.OPTION2(() => this.SUBRULE(this.attributes));
    });
    this.CONSUME(TagClose);
  });

  // Closing tag
  private closeTagRule = this.RULE('closeTag', () => {
    this.CONSUME(TagClosingOpen);
    this.CONSUME(Identifier, { LABEL: 'tagName' });
    this.OPTION(() => this.CONSUME(Whitespace));
    this.CONSUME(TagClose);
  });

  // Attributes
  private attributesRule = this.RULE('attributes', () => {
    this.MANY_SEP({
      SEP: Whitespace,
      DEF: () => this.SUBRULE(this.attribute),
    });
  });

  // Single attribute
  private attributeRule = this.RULE('attribute', () => {
    this.CONSUME(Identifier, { LABEL: 'key' });
    this.CONSUME(Equals);
    this.SUBRULE(this.attributeValue);
  });

  // Attribute value (quoted, unquoted, or for iterator)
  private attributeValueRule = this.RULE('attributeValue', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.quotedValue) },
      { ALT: () => this.SUBRULE(this.unquotedValue) },
      // Special case for for="item in items"
      {
        GATE: () => this.isForAttribute(),
        ALT: () => this.SUBRULE(this.forIterator),
      },
    ]);
  });

  // Quoted value
  private quotedValueRule = this.RULE('quotedValue', () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(DoubleQuote, { LABEL: 'openQuote' });
          this.MANY(() => {
            this.SUBRULE(this.valueContent);
          });
          this.CONSUME2(DoubleQuote, { LABEL: 'closeQuote' });
        },
      },
      {
        ALT: () => {
          this.CONSUME(SingleQuote, { LABEL: 'openQuote' });
          this.MANY2(() => {
            this.SUBRULE2(this.valueContent);
          });
          this.CONSUME2(SingleQuote, { LABEL: 'closeQuote' });
        },
      },
    ]);
  });

  // Unquoted value (template or expression)
  private unquotedValueRule = this.RULE('unquotedValue', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.template) },
      { ALT: () => this.CONSUME(Identifier, { LABEL: 'expression' }) },
      { ALT: () => this.CONSUME(TextContent, { LABEL: 'expression' }) },
    ]);
  });

  // Value content inside quotes
  private valueContentRule = this.RULE('valueContent', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.template) },
      { ALT: () => this.SUBRULE(this.escapedChar) },
      { ALT: () => this.CONSUME(TextContent, { LABEL: 'text' }) },
      { ALT: () => this.CONSUME(Identifier, { LABEL: 'text' }) },
      { ALT: () => this.CONSUME(Whitespace, { LABEL: 'text' }) },
    ]);
  });

  // Escaped character
  private escapedCharRule = this.RULE('escapedChar', () => {
    this.CONSUME(Backslash);
    this.OR([
      { ALT: () => this.CONSUME(DoubleQuote, { LABEL: 'char' }) },
      { ALT: () => this.CONSUME(SingleQuote, { LABEL: 'char' }) },
      { ALT: () => this.CONSUME(Backslash, { LABEL: 'char' }) },
      { ALT: () => this.CONSUME(Identifier, { LABEL: 'char' }) },
    ]);
  });

  // For iterator (item in items)
  private forIteratorRule = this.RULE('forIterator', () => {
    this.CONSUME(Identifier, { LABEL: 'iterator' });
    this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'Whitespace1' }));
    this.CONSUME2(Identifier, { LABEL: 'in' }); // "in" keyword
    this.OPTION2(() => this.CONSUME2(Whitespace, { LABEL: 'Whitespace2' }));
    // Collection can be complex expression
    this.AT_LEAST_ONE(() => {
      this.OR([
        { ALT: () => this.CONSUME3(Identifier, { LABEL: 'collection' }) },
        { ALT: () => this.CONSUME(TextContent, { LABEL: 'collection' }) },
      ]);
    });
  });

  // Template {{ expression }}
  private templateRule = this.RULE('template', () => {
    this.CONSUME(TemplateOpen);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(Whitespace, { LABEL: 'expression' }) },
        { ALT: () => this.CONSUME(Identifier, { LABEL: 'expression' }) },
        { ALT: () => this.CONSUME(TextContent, { LABEL: 'expression' }) },
      ]);
    });
    this.CONSUME(TemplateClose);
  });

  // Value (text and/or templates)
  private valueRule = this.RULE('value', () => {
    this.AT_LEAST_ONE(() => {
      this.SUBRULE(this.valueElement);
    });
  });

  // Value element (text or template)
  private valueElementRule = this.RULE('valueElement', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.template) },
      { ALT: () => this.CONSUME(TextContent, { LABEL: 'text' }) },
      { ALT: () => this.CONSUME(Identifier, { LABEL: 'text' }) },
      { ALT: () => this.CONSUME(Whitespace, { LABEL: 'text' }) },
    ]);
  });

  // Comment
  private commentRule = this.RULE('comment', () => {
    this.CONSUME(CommentOpen);
    this.MANY(() => {
      this.OR([
        {
          GATE: () => !this.isCommentClose(),
          ALT: () => this.consumeAny({ LABEL: 'commentContent' }),
        },
      ]);
    });
    this.CONSUME(CommentClose);
  });

  // Pragma
  private pragmaRule = this.RULE('pragma', () => {
    this.CONSUME(CommentOpen);
    this.OPTION(() => this.CONSUME(Whitespace, { LABEL: 'Whitespace1' }));
    this.CONSUME(Pragma);
    this.MANY(() => {
      this.OR([
        {
          GATE: () => !this.isCommentClose(),
          ALT: () => this.consumeAny({ LABEL: 'pragmaContent' }),
        },
      ]);
    });
    this.CONSUME(CommentClose);
  });

  // Helper methods
  private isClosingTag(): boolean {
    return this.LA(1).tokenType === TagClosingOpen;
  }

  private isCommentClose(): boolean {
    return this.LA(1).tokenType === CommentClose;
  }

  private isForAttribute(): boolean {
    // Check if previous token was "for" as attribute key
    const prevTokens = this.input.slice(Math.max(0, this.currIdx - 3), this.currIdx);
    return prevTokens.some((t) => t.image.toLowerCase() === 'for');
  }

  private consumeAny(options?: { LABEL?: string }): IToken {
    // Consume any token
    const token = this.LA(1);
    this.input[this.currIdx++];
    return token;
  }
}
