export interface Token {
  type: 'TEXT' | 'TAG_OPEN' | 'TAG_CLOSE' | 'TAG_SELF_CLOSE' | 'TEMPLATE_VAR' | 'ATTRIBUTE';
  value: string;
  start: number;
  end: number;
}

export class Tokenizer {
  private input: string;
  private position: number;

  constructor(input: string) {
    this.input = input;
    this.position = 0;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.position < this.input.length) {
      // Check for template variables first
      if (this.peek() === '{' && this.peek(1) === '{') {
        tokens.push(this.readTemplateVariable());
        continue;
      }

      // Check for XML tags
      if (this.peek() === '<') {
        const tagToken = this.readTag();
        if (tagToken) {
          tokens.push(tagToken);
          continue;
        }
      }

      // Read text content
      const textToken = this.readText();
      if (textToken.value.length > 0) {
        tokens.push(textToken);
      }
    }

    return tokens;
  }

  private peek(offset: number = 0): string {
    return this.input[this.position + offset] || '';
  }

  private advance(): string {
    return this.input[this.position++] || '';
  }

  private readTemplateVariable(): Token {
    const start = this.position;
    this.advance(); // {
    this.advance(); // {

    while (this.position < this.input.length && !(this.peek() === '}' && this.peek(1) === '}')) {
      this.advance();
    }

    if (this.peek() === '}' && this.peek(1) === '}') {
      this.advance(); // }
      this.advance(); // }
    }

    return {
      type: 'TEMPLATE_VAR',
      value: this.input.substring(start, this.position),
      start,
      end: this.position,
    };
  }

  private readTag(): Token | null {
    const start = this.position;
    this.advance(); // <

    // Skip whitespace
    while (this.peek() === ' ' || this.peek() === '\t' || this.peek() === '\n') {
      this.advance();
    }

    // Check for closing tag
    const isClosing = this.peek() === '/';
    if (isClosing) {
      this.advance();
    }

    // Read tag name
    let tagName = '';
    while (
      this.position < this.input.length &&
      this.peek() !== '>' &&
      this.peek() !== ' ' &&
      this.peek() !== '\t' &&
      this.peek() !== '\n'
    ) {
      tagName += this.advance();
    }

    // Skip attributes for now (will be parsed separately)
    while (this.position < this.input.length && this.peek() !== '>') {
      this.advance();
    }

    if (this.peek() === '>') {
      this.advance(); // >

      // Check if self-closing
      const content = this.input.substring(start, this.position);
      const isSelfClosing = content.endsWith('/>');

      return {
        type: isSelfClosing ? 'TAG_SELF_CLOSE' : isClosing ? 'TAG_CLOSE' : 'TAG_OPEN',
        value: content,
        start,
        end: this.position,
      };
    }

    // Invalid tag, backtrack
    this.position = start + 1;
    return null;
  }

  private readText(): Token {
    const start = this.position;

    while (this.position < this.input.length && this.peek() !== '<' && !(this.peek() === '{' && this.peek(1) === '{')) {
      this.advance();
    }

    return {
      type: 'TEXT',
      value: this.input.substring(start, this.position),
      start,
      end: this.position,
    };
  }
}
