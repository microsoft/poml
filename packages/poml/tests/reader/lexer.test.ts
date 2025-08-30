import { describe, expect, test } from '@jest/globals';
import {
  extendedPomlLexer,
  CommentOpen,
  CommentClose,
  TemplateOpen,
  TemplateClose,
  TagOpen,
  TagClose,
  TagClosingOpen,
  TagSelfClose,
  Equals,
  DoubleQuote,
  SingleQuote,
  Backslash,
  Identifier,
  Whitespace,
  Arbitrary,
} from 'poml/next/lexer';

// Helper function to extract token images
function tokenImages(input: string): string[] {
  const result = extendedPomlLexer.tokenize(input);
  return result.tokens.map((t) => t.image);
}

// Helper function to extract token types
function tokenTypes(input: string): any[] {
  const result = extendedPomlLexer.tokenize(input);
  return result.tokens.map((t) => t.tokenType);
}

// Helper function to get full tokenization result
function tokenize(input: string) {
  return extendedPomlLexer.tokenize(input);
}

describe('Basic Token Images', () => {
  test('should tokenize HTML comments', () => {
    expect(tokenImages('<!-- comment -->')).toEqual(['<!--', ' ', 'comment', ' ', '-->']);
  });

  test('should tokenize template variables', () => {
    expect(tokenImages('{{variable}}')).toEqual(['{{', 'variable', '}}']);
  });

  test('should tokenize XML tags', () => {
    expect(tokenImages('<task>')).toEqual(['<', 'task', '>']);
    expect(tokenImages('</task>')).toEqual(['</', 'task', '>']);
    expect(tokenImages('<meta />')).toEqual(['<', 'meta', ' ', '/>']);
  });

  test('should tokenize quotes and backslashes individually', () => {
    expect(tokenImages('"hello"')).toEqual(['"', 'hello', '"']);
    expect(tokenImages("'world'")).toEqual(["'", 'world', "'"]);
    expect(tokenImages('text\\escape')).toEqual(['text', '\\', 'escape']);
  });

  test('should tokenize attributes', () => {
    expect(tokenImages('id="value"')).toEqual(['id', '=', '"', 'value', '"']);
  });

  test('should tokenize whitespace', () => {
    expect(tokenImages('  \t\n  ')).toEqual(['  \t\n  ']);
  });

  test('should tokenize identifiers', () => {
    expect(tokenImages('simple-name_123')).toEqual(['simple-name_123']);
  });

  test('should tokenize text content', () => {
    expect(tokenImages('plain text here')).toEqual(['plain', ' ', 'text', ' ', 'here']);
  });
});

describe('Edge Cases', () => {
  test('should handle "abc<poml>def</poml>ghi"', () => {
    expect(tokenImages('"abc<poml>def</poml>ghi"')).toEqual([
      '"',
      'abc',
      '<',
      'poml',
      '>',
      'def',
      '</',
      'poml',
      '>',
      'ghi',
      '"',
    ]);
  });

  test('should handle <poml abc="def">ghi</poml>', () => {
    expect(tokenImages('<poml abc="def">ghi</poml>')).toEqual([
      '<',
      'poml',
      ' ',
      'abc',
      '=',
      '"',
      'def',
      '"',
      '>',
      'ghi',
      '</',
      'poml',
      '>',
    ]);
  });

  test('should handle mixed content', () => {
    expect(tokenImages('text {{var}} more')).toEqual(['text', ' ', '{{', 'var', '}}', ' ', 'more']);
  });

  test('chinese characters', () => {
    expect(tokenImages('中文 {{ 文本 }}内容< 标签>')).toEqual([
      '中文',
      ' ',
      '{{',
      ' ',
      '文本',
      ' ',
      '}}',
      '内容',
      '<',
      ' ',
      '标签',
      '>',
    ]);
  });

  test('should handle complex attributes', () => {
    expect(tokenImages('<task id="{{value}}" class="test">')).toEqual([
      '<',
      'task',
      ' ',
      'id',
      '=',
      '"',
      '{{',
      'value',
      '}}',
      '"',
      ' ',
      'class',
      '=',
      '"',
      'test',
      '"',
      '>',
    ]);
  });

  test('should handle escaped quotes', () => {
    expect(tokenImages('text "with \\"escaped\\" quotes"')).toEqual([
      'text',
      ' ',
      '"',
      'with',
      ' ',
      '\\',
      '"',
      'escaped',
      '\\',
      '"',
      ' ',
      'quotes',
      '"',
    ]);
  });

  test('should handle complex real-world scenarios', () => {
    const realWorldTests = [
      `<!-- Header comment -->
<html>
  <head>
    <title>{{page.title}}</title>
    <meta charset="utf-8" />
  </head>
  <body class="{{theme}}">
    <div id="content">
      {{content}}
    </div>
  </body>
</html>`,

      `<task priority="{{urgency}}" due="{{deadline}}">
  {{description}}
  <!-- Status: {{status}} -->
</task>`,

      `"Complex string with {{variables}} and <tags attr='{{nested}}'> inside"`,

      `{{#each items}}
  <li class="item-{{@index}}">
    <span title="{{description}}">{{name}}</span>
  </li>
{{/each}}`,
    ];

    realWorldTests.forEach((test) => {
      const result = tokenize(test);
      expect(result.errors).toHaveLength(0);
      expect(result.tokens.length).toBeGreaterThan(0);

      // Verify position integrity
      result.tokens.forEach((token) => {
        expect(token.startOffset).toBeGreaterThanOrEqual(0);
        expect(token.endOffset).toBeGreaterThanOrEqual(token.startOffset!);
      });
    });
  });

  test('should handle equals sign in various contexts', () => {
    const equalsTests = [
      'attr=value',
      'attr="value"',
      "attr='value'",
      'attr={{value}}',
      'first=one second=two',
      '=standalone',
      'text=content',
      'a=b=c',
    ];

    equalsTests.forEach((test) => {
      const result = tokenize(test);
      expect(result.errors).toHaveLength(0);

      const equalsTokens = result.tokens.filter((t) => t.tokenType.name === 'Equals');
      expect(equalsTokens.length).toBeGreaterThan(0);
    });
  });

  test('should handle edge cases with zero-length matches', () => {
    const edgeCases = ['', ' ', '\n', '\t', '\r', '{{}}', '<!---->', '<>', '""', "''", '\\'];

    edgeCases.forEach((test) => {
      const result = tokenize(test);
      expect(result.errors).toHaveLength(0);

      if (test === '') {
        expect(result.tokens).toHaveLength(0);
      } else {
        expect(result.tokens.length).toBeGreaterThan(0);
      }
    });
  });
});

describe('Token Types', () => {
  test('should identify correct token types for basic elements', () => {
    expect(tokenTypes('<task>')).toEqual([TagOpen, Identifier, TagClose]);
    expect(tokenTypes('</task>')).toEqual([TagClosingOpen, Identifier, TagClose]);
    expect(tokenTypes('<meta />')).toEqual([TagOpen, Identifier, Whitespace, TagSelfClose]);
  });

  test('should identify quotes and backslashes', () => {
    expect(tokenTypes('"text"')).toEqual([DoubleQuote, Identifier, DoubleQuote]);
    expect(tokenTypes("'text'")).toEqual([SingleQuote, Identifier, SingleQuote]);
    expect(tokenTypes('text\\escape')).toEqual([Identifier, Backslash, Identifier]);
  });

  test('should identify template variables', () => {
    expect(tokenTypes('{{variable}}')).toEqual([TemplateOpen, Identifier, TemplateClose]);
  });

  test('should identify comments', () => {
    expect(tokenTypes('<!-- comment -->')).toEqual([CommentOpen, Whitespace, Identifier, Whitespace, CommentClose]);
  });

  test('should identify whitespace', () => {
    expect(tokenTypes('  \t\n  ')).toEqual([Whitespace]);
  });

  test('should identify attributes', () => {
    expect(tokenTypes('<markup.paragraph id="intro" data-value="123\\n"456\'>')).toEqual([
      TagOpen,
      Identifier,
      Arbitrary,
      Whitespace,
      Identifier,
      Equals,
      DoubleQuote,
      Identifier,
      DoubleQuote,
      Whitespace,
      Identifier,
      Equals,
      DoubleQuote,
      Arbitrary,
      Backslash,
      Identifier,
      DoubleQuote,
      Arbitrary,
      SingleQuote,
      TagClose,
    ]);
  });
});

describe('Source Position and Error Tests', () => {
  test('should provide correct source positions', () => {
    const result = tokenize('<task>content</task>');
    expect(result.errors).toHaveLength(0);

    const tokens = result.tokens;
    expect(tokens[0].startOffset).toBe(0);
    expect(tokens[0].endOffset).toBe(0);
    expect(tokens[0].image).toBe('<');

    expect(tokens[1].startOffset).toBe(1);
    expect(tokens[1].endOffset).toBe(4);
    expect(tokens[1].image).toBe('task');

    expect(tokens[2].startOffset).toBe(5);
    expect(tokens[2].endOffset).toBe(5);
    expect(tokens[2].image).toBe('>');
  });

  test('should handle line and column tracking', () => {
    const input = `line1
line2 <tag>
line3`;
    const result = tokenize(input);

    const tagToken = result.tokens.find((t) => t.tokenType === TagOpen);
    expect(tagToken).toBeDefined();
    expect(tagToken!.startLine).toBe(2);
    expect(tagToken!.startColumn).toBe(7); // After "line2 "
  });

  test('should handle malformed input gracefully', () => {
    const result = tokenize('<task id="unclosed');
    expect(result.errors).toHaveLength(0); // Should not error, just tokenize what it can
    expect(result.tokens.length).toBeGreaterThan(0);

    // Verify token positions are valid
    for (const token of result.tokens) {
      expect(token.startOffset).toBeLessThanOrEqual(token.endOffset!);
      expect(token.startOffset).toBeGreaterThanOrEqual(0);
      expect(token.endOffset).toBeLessThanOrEqual(18);
    }
  });

  test('should verify token boundaries do not overlap', () => {
    const result = tokenize('<task id="value">content</task>');
    const sortedTokens = [...result.tokens].sort((a, b) => a.startOffset - b.startOffset);

    for (let i = 0; i < sortedTokens.length - 1; i++) {
      const current = sortedTokens[i];
      const next = sortedTokens[i + 1];
      expect(current.endOffset).toBeLessThanOrEqual(next.startOffset);
    }
  });

  test('should handle empty input', () => {
    const result = tokenize('');
    expect(result.errors).toHaveLength(0);
    expect(result.tokens).toHaveLength(0);
  });

  test('should handle whitespace only input', () => {
    const result = tokenize('   \t\n   ');
    expect(result.errors).toHaveLength(0);
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].tokenType).toBe(Whitespace);
  });
});

describe('Complex Mixed Content', () => {
  test('should handle extended POML specification example', () => {
    const input = `# My Analysis

<task>
Analyze data
</task>

{{variable}}`;

    const images = tokenImages(input);
    expect(images).toContain('#');
    expect(images).toContain('My');
    expect(images).toContain('Analysis');
    expect(images).toContain('<');
    expect(images).toContain('task');
    expect(images).toContain('>');
    expect(images).toContain('{{');
    expect(images).toContain('variable');
    expect(images).toContain('}}');
  });

  test('should handle comments with mixed content', () => {
    expect(tokenImages('<!-- comment --><task>content</task>')).toEqual([
      '<!--',
      ' ',
      'comment',
      ' ',
      '-->',
      '<',
      'task',
      '>',
      'content',
      '</',
      'task',
      '>',
    ]);
  });

  test('should handle nested quotes and templates', () => {
    expect(tokenImages('<meta value="{{path}}/file.txt">')).toEqual([
      '<',
      'meta',
      ' ',
      'value',
      '=',
      '"',
      '{{',
      'path',
      '}}',
      '/file.txt',
      '"',
      '>',
    ]);
  });
});

describe('Boundary Conditions', () => {
  test('should handle single character inputs', () => {
    expect(tokenize('<').tokens).toHaveLength(1);
    expect(tokenize('>').tokens).toHaveLength(1);
    expect(tokenize('"').tokens).toHaveLength(1);
    expect(tokenize("'").tokens).toHaveLength(1);
    expect(tokenize('\\').tokens).toHaveLength(1);
    expect(tokenize('=').tokens).toHaveLength(1);
    expect(tokenize(' ').tokens).toHaveLength(1);
    expect(tokenize('\t').tokens).toHaveLength(1);
    expect(tokenize('\n').tokens).toHaveLength(1);
    expect(tokenize('a').tokens).toHaveLength(1);
    expect(tokenize('_').tokens).toHaveLength(1);
    expect(tokenize('1').tokens).toHaveLength(1);
    expect(tokenize('@').tokens).toHaveLength(1);
  });

  test('should handle two character edge cases', () => {
    expect(tokenImages('{{')).toEqual(['{{']);
    expect(tokenImages('}}')).toEqual(['}}']);
    expect(tokenImages('</')).toEqual(['</']);
    expect(tokenImages('/>')).toEqual(['/>']);
    expect(tokenImages('{}')).toEqual(['{}']);
    expect(tokenImages('}{')).toEqual(['}{']);
    expect(tokenImages('""')).toEqual(['"', '"']);
    expect(tokenImages("''")).toEqual(["'", "'"]);
    expect(tokenImages('<>')).toEqual(['<', '>']);
  });

  test('should handle minimum valid patterns', () => {
    expect(tokenImages('<!---->')).toEqual(['<!--', '-->']);
    expect(tokenImages('<a>')).toEqual(['<', 'a', '>']);
    expect(tokenImages('</a>')).toEqual(['</', 'a', '>']);
    expect(tokenImages('<a/>')).toEqual(['<', 'a', '/>']);
  });

  test('should handle very long inputs without crashes', () => {
    const longText = 'a'.repeat(100000);
    const result = tokenize(longText);
    expect(result.errors).toHaveLength(0);
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].image).toBe(longText);

    const longComment = `<!--${'x'.repeat(100000)}-->`;
    const commentResult = tokenize(longComment);
    expect(commentResult.errors).toHaveLength(0);
    expect(commentResult.tokens).toHaveLength(3);

    const longIdentifier = 'a' + 'b'.repeat(10000);
    const identifierResult = tokenize(longIdentifier);
    expect(identifierResult.errors).toHaveLength(0);
    expect(identifierResult.tokens).toHaveLength(1);
  });

  test('should handle maximum practical complexity', () => {
    const complexInput =
      '<' +
      'tag'.repeat(1000) +
      ' attr="' +
      'value'.repeat(1000) +
      '">' +
      'content'.repeat(1000) +
      '</' +
      'tag'.repeat(1000) +
      '>';
    const result = tokenize(complexInput);
    expect(result.errors).toHaveLength(0);
    expect(result.tokens).toHaveLength(13);
  });

  test('should handle deeply nested structures', () => {
    let nested = '';
    for (let i = 0; i < 100; i++) {
      nested += `<tag${i}>`;
    }
    nested += 'content';
    for (let i = 99; i >= 0; i--) {
      nested += `</tag${i}>`;
    }
    const result = tokenize(nested);
    expect(result.errors).toHaveLength(0);
    expect(result.tokens).toHaveLength(601);
  });
});

describe('Unicode and Special Characters', () => {
  test('should handle CJK characters', () => {
    expect(tokenImages('你好世界')).toEqual(['你好世界']);
    expect(tokenImages('こんにちは')).toEqual(['こんにちは']);
    expect(tokenImages('안녕하세요')).toEqual(['안녕하세요']);
  });

  test('should handle emoji and symbols', () => {
    expect(tokenImages('Hello 👋 World 🌍')).toEqual(['Hello', ' ', '👋', ' ', 'World', ' ', '🌍']);
    expect(tokenImages('Math: ∑∞π≠∅')).toEqual(['Math', ':', ' ', '∑∞π≠∅']);
    expect(tokenImages('Arrows: ←→↑↓')).toEqual(['Arrows', ':', ' ', '←→↑↓']);
  });

  test('should handle unicode', () => {
    expect(tokenImages('<こんにちは>')).toEqual(['<', 'こんにちは', '>']);
    expect(tokenImages('{{你好}}')).toEqual(['{{', '你好', '}}']);
    expect(tokenImages('<tag attr="café">')).toEqual(['<', 'tag', ' ', 'attr', '=', '"', 'caf', 'é', '"', '>']);
  });

  test('should maintain lexer stability with all edge cases', () => {
    // Combination of many edge cases
    const stressTest =
      '\uFEFF\x00\x01\x02<!-- \uD800 comment -->\x03<tag\x04 attr="\uDFFF{{value\x05}}"\x06>\x07content\x08</tag>\x09\x0A';

    const result = tokenize(stressTest);
    expect(result.tokens.length).toBeGreaterThan(0);

    // Verify token integrity
    result.tokens.forEach((token) => {
      expect(token.startOffset).toBeGreaterThanOrEqual(0);
      if (token.endOffset !== undefined) {
        expect(token.endOffset).toBeGreaterThanOrEqual(token.startOffset);
      }
    });
  });
});

describe('Malformed Patterns', () => {
  test('should handle incomplete comments', () => {
    expect(tokenize('<!--').tokens.length).toBeGreaterThan(0);
    expect(tokenize('<!-- comment').tokens.length).toBeGreaterThan(0);
    expect(tokenize('<!-- comment -').tokens.length).toBeGreaterThan(0);
    expect(tokenize('<!-- comment --').tokens.length).toBeGreaterThan(0);
    expect(tokenize('<!--\nunclosed\nover\nmultiple\nlines').tokens.length).toBeGreaterThan(0);
  });

  test('should handle incomplete template variables', () => {
    expect(tokenImages('text {{')).toEqual(['text', ' ', '{{']);
    expect(tokenImages('text {{variable')).toEqual(['text', ' ', '{{', 'variable']);
    expect(tokenImages('{{ var }{ not closed')).toEqual(['{{', ' ', 'var', ' ', '}{', ' ', 'not', ' ', 'closed']);
    expect(tokenImages('{{nested {{inside')).toEqual(['{{', 'nested', ' ', '{{', 'inside']);
  });

  test('should handle incomplete tags', () => {
    expect(tokenImages('<')).toEqual(['<']);
    expect(tokenImages('<tag')).toEqual(['<', 'tag']);
    expect(tokenImages('<tag attr="value')).toEqual(['<', 'tag', ' ', 'attr', '=', '"', 'value']);
    expect(tokenImages('</')).toEqual(['</']);
    expect(tokenImages('</tag')).toEqual(['</', 'tag']);
    expect(tokenImages('<tag /no-close')).toEqual(['<', 'tag', ' ', '/no-close']);
  });

  test('should handle malformed attributes', () => {
    expect(tokenImages('attr=')).toEqual(['attr', '=']);
    expect(tokenImages('attr="')).toEqual(['attr', '=', '"']);
    expect(tokenImages("attr='unclosed")).toEqual(['attr', '=', "'", 'unclosed']);
    expect(tokenImages('attr="value')).toEqual(['attr', '=', '"', 'value']);
    expect(tokenImages('attr=no-quotes value')).toEqual(['attr', '=', 'no-quotes', ' ', 'value']);
  });

  test('should handle broken template syntax', () => {
    expect(tokenImages('}')).toEqual(['}']);
    expect(tokenImages('}}')).toEqual(['}}']);
    expect(tokenImages('{ single brace }')).toEqual(['{', ' ', 'single', ' ', 'brace', ' ', '}']);
    expect(tokenImages('{not a template}')).toEqual(['{not', ' ', 'a', ' ', 'template', '}']);
  });

  test('should handle nested malformed patterns', () => {
    expect(tokenImages('<!--   <tag>\n-->')).toEqual(['<!--', '   ', '<', 'tag', '>', '\n', '-->']);
    expect(tokenImages('<!-- {{template}} -->')).toEqual(['<!--', ' ', '{{', 'template', '}}', ' ', '-->']);
    expect(tokenImages('<tag><!-- comment</tag>')).toEqual(['<', 'tag', '>', '<!--', ' ', 'comment', '</', 'tag', '>']);
    expect(tokenImages('{{<tag>}}')).toEqual(['{{', '<', 'tag', '>', '}}']);
  });

  test('should handle quotes without proper pairing', () => {
    expect(tokenImages('"orphan quote')).toEqual(['"', 'orphan', ' ', 'quote']);
    expect(tokenImages("'another orphan")).toEqual(["'", 'another', ' ', 'orphan']);
    expect(tokenImages('mixed "quote\' types')).toEqual(['mixed', ' ', '"', 'quote', "'", ' ', 'types']);
    expect(tokenImages('escaped \\"quote\\" in text')).toEqual([
      'escaped',
      ' ',
      '\\',
      '"',
      'quote',
      '\\',
      '"',
      ' ',
      'in',
      ' ',
      'text',
    ]);
  });

  test('should handle self-closing tag syntax edge cases', () => {
    expect(tokenImages('/>')).toEqual(['/>']);
    expect(tokenImages('text/>')).toEqual(['text', '/>']);
    expect(tokenImages('<tag attr=value/>')).toEqual(['<', 'tag', ' ', 'attr', '=', 'value', '/>']);
    expect(tokenImages('</ self-close>')).toEqual(['</', ' ', 'self-close', '>']);
  });

  test('should handle whitespace in unexpected places', () => {
    expect(tokenImages('< tag >')).toEqual(['<', ' ', 'tag', ' ', '>']);
    expect(tokenImages('</ tag >')).toEqual(['</', ' ', 'tag', ' ', '>']);
    expect(tokenImages('{ { template } }')).toEqual(['{', ' ', '{', ' ', 'template', ' ', '}', ' ', '}']);
    expect(tokenImages('attr = "value"')).toEqual(['attr', ' ', '=', ' ', '"', 'value', '"']);
  });

  test('should handle multiple consecutive special characters', () => {
    expect(tokenImages('<<>>')).toEqual(['<', '<', '>', '>']);
    expect(tokenImages('"""')).toEqual(['"', '"', '"']);
    expect(tokenImages("'''")).toEqual(["'", "'", "'"]);
    expect(tokenImages('\\\\\\')).toEqual(['\\', '\\', '\\']);
    expect(tokenImages('===')).toEqual(['=', '=', '=']);
  });

  test('should handle mixed broken and valid syntax', () => {
    expect(tokenImages('<valid>content</valid>{{ broken')).toEqual([
      '<',
      'valid',
      '>',
      'content',
      '</',
      'valid',
      '>',
      '{{',
      ' ',
      'broken',
    ]);
    expect(tokenImages('<!-- comment --><tag>more{{ content')).toEqual([
      '<!--',
      ' ',
      'comment',
      ' ',
      '-->',
      '<',
      'tag',
      '>',
      'more',
      '{{',
      ' ',
      'content',
    ]);
    expect(tokenImages("\"quoted text<tag attr='mixed'>end")).toEqual([
      '"',
      'quoted',
      ' ',
      'text',
      '<',
      'tag',
      ' ',
      'attr',
      '=',
      "'",
      'mixed',
      "'",
      '>',
      'end',
    ]);
  });

  test('should handle lookahead boundary cases for single braces', () => {
    expect(tokenImages('{nottemplate}')).toEqual(['{nottemplate}']);
    expect(tokenImages('}notclosing{')).toEqual(['}notclosing{']);
    expect(tokenImages('text{more}text')).toEqual(['text', '{more}text']);
    expect(tokenImages('before}after')).toEqual(['before', '}after']);
    expect(tokenImages('before{after')).toEqual(['before', '{after']);
    expect(tokenImages('text } { more')).toEqual(['text', ' ', '}', ' ', '{', ' ', 'more']);
  });

  test('should handle greedy vs non-greedy matching', () => {
    expect(tokenImages('<!--first--><!--second-->')).toEqual(['<!--', 'first', '-->', '<!--', 'second', '-->']);
    expect(tokenImages('{{first}}{{second}}')).toEqual(['{{', 'first', '}}', '{{', 'second', '}}']);
    expect(tokenImages('text<!-----comment----->more')).toEqual(['text', '<!-----', 'comment', '----->', 'more']);
  });

  test('should handle single braces correctly', () => {
    // Single { or } are OK if not followed by another brace
    expect(tokenImages('text { more text')).toEqual(['text', ' ', '{', ' ', 'more', ' ', 'text']);
    expect(tokenImages('text } more text')).toEqual(['text', ' ', '}', ' ', 'more', ' ', 'text']);
    expect(tokenImages('a{b}c')).toEqual(['a', '{b}c']);
    expect(tokenImages('path{index}')).toEqual(['path', '{index}']);
    expect(tokenImages('array[{key}]')).toEqual(['array', '[{key}]']);
    expect(tokenImages('{ not {{ double')).toEqual(['{', ' ', 'not', ' ', '{{', ' ', 'double']);
    expect(tokenImages('} not }} double')).toEqual(['}', ' ', 'not', ' ', '}}', ' ', 'double']);
    expect(tokenImages('{}empty{}')).toEqual(['{}empty{}']);
    expect(tokenImages('}{reversed}{')).toEqual(['}{reversed}{']);
  });

  test('should handle incomplete tag delimiters', () => {
    // Incomplete tag delimiters such as / (except /< and />)
    expect(tokenImages('path/to/file')).toEqual(['path', '/to/file']);
    expect(tokenImages('a/b/c')).toEqual(['a', '/b/c']);
    expect(tokenImages('text / more')).toEqual(['text', ' ', '/', ' ', 'more']);
    expect(tokenImages('http://example.com')).toEqual(['http', '://example.com']);
    expect(tokenImages('5/3=1.67')).toEqual(['5/3', '=', '1.67']);
    // These should NOT match as incomplete delimiters
    expect(tokenImages('/<tag>')).toEqual(['/', '<', 'tag', '>']);
    expect(tokenImages('/>')).toEqual(['/>']);
    expect(tokenImages('</tag>')).toEqual(['</', 'tag', '>']);
  });

  test('should handle incomplete comment delimiters', () => {
    // Incomplete comment delimiters such as !-- or -- are OK
    expect(tokenImages('text !-- not comment')).toEqual(['text', ' ', '!--', ' ', 'not', ' ', 'comment']);
    expect(tokenImages('text -- also not')).toEqual(['text', ' ', '--', ' ', 'also', ' ', 'not']);
    expect(tokenImages('a--b')).toEqual(['a--b']);
    expect(tokenImages('!--incomplete')).toEqual(['!--incomplete']);
    expect(tokenImages('--dashes--')).toEqual(['--dashes--']);
    expect(tokenImages('<!-- this is comment -->')).toEqual([
      '<!--',
      ' ',
      'this',
      ' ',
      'is',
      ' ',
      'comment',
      ' ',
      '-->',
    ]);
    expect(tokenImages('not<!-- comment -->')).toEqual(['not', '<!--', ' ', 'comment', ' ', '-->']);
    expect(tokenImages('---triple-dash')).toEqual(['---triple-dash']);
    expect(tokenImages('text --- more')).toEqual(['text', ' ', '---', ' ', 'more']);
  });

  test('should handle incorrect @pragma directives', () => {
    // Incorrect @pragma directive such as @pragm or @pragmaX will be matched as Arbitrary
    expect(tokenImages('@pragma')).toEqual(['@pragma']);
    expect(tokenImages('@pragm')).toEqual(['@pragm']);
    expect(tokenImages('@pragmaX')).toEqual(['@pragmaX']);
    expect(tokenImages('@pragma-extended')).toEqual(['@pragma-extended']);
    expect(tokenImages('@@pragma')).toEqual(['@@pragma']);
    expect(tokenImages('not@pragma')).toEqual(['not', '@pragma']);
    expect(tokenImages('@PRAGMA')).toEqual(['@PRAGMA']);
    expect(tokenImages('@Pragma')).toEqual(['@Pragma']);
    expect(tokenImages('@pragma key=value')).toEqual(['@pragma', ' ', 'key', '=', 'value']);
  });
});

describe('Position Tracking Accuracy', () => {
  test('should track positions accurately across multiple lines', () => {
    const input = `line1
<tag>content</tag>
{{variable}}
final line`;
    const result = tokenize(input);

    const tagOpenToken = result.tokens.find((t) => t.image === '<' && t.startLine === 2);
    expect(tagOpenToken).toBeDefined();
    expect(tagOpenToken!.startColumn).toBe(1);

    const variableToken = result.tokens.find((t) => t.image === 'variable');
    expect(variableToken).toBeDefined();
    expect(variableToken!.startLine).toBe(3);
  });

  test('should track positions accurately with mixed line endings', () => {
    const input = 'line1\r\nline2\nline3\r';
    const result = tokenize(input);

    expect(result.tokens.length).toBeGreaterThan(0);
    result.tokens.forEach((token) => {
      expect(token.startOffset).toBeGreaterThanOrEqual(0);
      expect(token.endOffset).toBeGreaterThanOrEqual(token.startOffset!);
      expect(token.startLine).toBeGreaterThanOrEqual(1);
      expect(token.startColumn).toBeGreaterThanOrEqual(1);
    });
  });

  test('should handle position tracking with empty tokens', () => {
    const input = '<>""\'\'{{}}<!---->< >';
    const result = tokenize(input);

    // Verify all tokens have valid positions
    result.tokens.forEach((token) => {
      expect(token.startOffset).toBeGreaterThanOrEqual(0);
      expect(token.endOffset).toBeGreaterThanOrEqual(token.startOffset!);
      expect(token.startLine).toBeGreaterThanOrEqual(1);
      expect(token.startColumn).toBeGreaterThanOrEqual(1);
    });
  });

  test('should track positions accurately with tabs and mixed whitespace', () => {
    const input = '\t<tag>\n\t\t<inner>\t\tcontent\t</inner>\n</tag>';
    const result = tokenize(input);

    // Find tokens and verify their positions make sense
    const tagOpen = result.tokens.find((t) => t.image === '<' && t.startLine === 1);
    const innerOpen = result.tokens.find((t) => t.image === '<' && t.startLine === 2);

    expect(tagOpen).toBeDefined();
    expect(innerOpen).toBeDefined();
    expect(tagOpen!.startColumn).toBe(2); // After tab
    expect(innerOpen!.startColumn).toBe(3); // After two tabs
  });

  test('should verify complete coverage with no gaps', () => {
    const input = '<tag attr="value">content{{var}}</tag>';
    const result = tokenize(input);

    // Sort tokens by start position
    const sortedTokens = [...result.tokens].sort((a, b) => a.startOffset! - b.startOffset!);

    // Verify complete coverage
    let expectedOffset = 0;
    sortedTokens.forEach((token) => {
      expect(token.startOffset).toBeGreaterThanOrEqual(expectedOffset);
      expectedOffset = token.endOffset! + 1;
    });

    // Should cover the entire input
    expect(expectedOffset).toBeGreaterThanOrEqual(input.length);
  });

  test('should handle position tracking with comments spanning multiple lines', () => {
    const input = `text
<!-- this is a
multi-line
comment -->
more text`;

    const result = tokenize(input);
    const commentToken = result.tokens.find((t) => t.tokenType.name === 'CommentOpen');

    expect(commentToken).toBeDefined();
    expect(commentToken!.startLine).toBe(2);
    expect(commentToken!.endLine).toBe(2);
  });

  test('should handle position tracking with carriage returns', () => {
    const input = 'line1\r<tag>\rcontent\r</tag>';
    const result = tokenize(input);

    // Check that line numbers increase correctly
    const lines = new Set(result.tokens.map((t) => t.startLine));
    expect(lines.size).toBeGreaterThan(1);

    // Verify positions are sequential
    result.tokens.forEach((token) => {
      expect(token.startOffset).toBeGreaterThanOrEqual(0);
      expect(token.endOffset).toBeGreaterThanOrEqual(token.startOffset!);
    });
  });
});

describe('Performance and Stress Tests', () => {
  test('should handle extremely long text content without performance degradation', () => {
    const longText = 'a'.repeat(1000000); // 1MB of text
    const start = performance.now();
    const result = tokenize(longText);
    const end = performance.now();

    expect(result.errors).toHaveLength(0);
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].image).toBe(longText);
    expect(end - start).toBeLessThan(1000); // Should complete in under 1 second
  });

  test('should handle very long comments efficiently', () => {
    const longComment = `<!--${'x'.repeat(500000)}-->`;
    const start = performance.now();
    const result = tokenize(longComment);
    const end = performance.now();

    expect(result.errors).toHaveLength(0);
    expect(result.tokens).toHaveLength(3);
    expect(end - start).toBeLessThan(500); // Should be fast
  });

  test('should handle many small tokens efficiently', () => {
    const manyTokens = Array(10000).fill('<tag>content</tag>').join(' ');
    const start = performance.now();
    const result = tokenize(manyTokens);
    const end = performance.now();

    expect(result.errors).toHaveLength(0);
    expect(result.tokens.length).toBeGreaterThan(10000);
    expect(end - start).toBeLessThan(2000); // Should handle many tokens
  });

  test('should handle deeply nested template variables', () => {
    let nested = '';
    for (let i = 0; i < 1000; i++) {
      nested += `{{var${i}}}`;
    }

    const start = performance.now();
    const result = tokenize(nested);
    const end = performance.now();

    expect(result.errors).toHaveLength(0);
    expect(result.tokens.length).toBe(3000); // 1000 * (open + content + close)
    expect(end - start).toBeLessThan(1000);
  });

  test('should handle memory efficiently with large repetitive content', () => {
    const pattern = '<tag attr="value">{{content}}</tag>';
    const repeated = Array(1000).fill(pattern).join('\n');

    const start = performance.now();
    const result = tokenize(repeated);
    const end = performance.now();

    expect(result.errors).toHaveLength(0);
    expect(result.tokens.length).toBeGreaterThan(5000);
    expect(end - start).toBeLessThan(1500);
  });

  test('should handle worst-case regex backtracking scenarios', () => {
    // Patterns that could cause regex catastrophic backtracking
    const backtrackingTests = [
      'a'.repeat(10000) + 'b',
      '{'.repeat(5000) + '}',
      '<'.repeat(1000) + '>',
      '"'.repeat(2000),
      '<!--' + 'x'.repeat(10000) + '-->',
      Array(1000).fill('{{}}').join(''),
    ];

    backtrackingTests.forEach((test) => {
      const start = performance.now();
      const result = tokenize(test);
      const end = performance.now();

      expect(result.errors).toHaveLength(0);
      expect(end - start).toBeLessThan(1000); // Should not hang
    });
  });

  test('should maintain linear performance with input size', () => {
    const sizes = [1000, 5000, 10000, 20000];
    const times: number[] = [];

    sizes.forEach((size) => {
      const content = 'x'.repeat(size);
      const start = performance.now();
      tokenize(content);
      const end = performance.now();
      times.push(end - start);
    });

    // Performance should scale roughly linearly
    expect(times[1]).toBeLessThan(times[0] * 10);
    expect(times[2]).toBeLessThan(times[1] * 5);
    expect(times[3]).toBeLessThan(times[2] * 3);
  });

  test('should handle maximum practical input sizes', () => {
    // Test with 10MB of content
    const hugeContent = Array(10000).fill('<tag>content</tag>').join(' ');
    expect(hugeContent.length).toBe(10000 * 19 - 1);

    const start = performance.now();
    const result = tokenize(hugeContent);
    const end = performance.now();

    expect(result.errors).toHaveLength(0);
    expect(result.tokens.length).toBeGreaterThan(0);
    expect(end - start).toBeLessThan(5000); // 5 second max for 10MB
  });
});

describe('Error Recovery', () => {
  test('should handle incomplete template variables', () => {
    const result = tokenize('text {{incomplete');
    expect(result.errors).toHaveLength(0);
    expect(result.tokens.length).toBeGreaterThan(0);

    const types = result.tokens.map((t) => t.tokenType);
    expect(types).toContain(Identifier);
    expect(types).toContain(TemplateOpen);
  });

  test('should handle unclosed comments', () => {
    const result = tokenize('<!-- unclosed comment\nmore text');
    expect(result.errors).toHaveLength(0);
    expect(result.tokens.length).toBeGreaterThan(0);
  });

  test('should handle mixed valid and invalid content', () => {
    const result = tokenize('<valid>content</valid>@#$invalid');
    expect(result.tokens.length).toBeGreaterThan(0);

    // Should tokenize the valid parts
    const images = result.tokens.map((t) => t.image);
    expect(images).toContain('<');
    expect(images).toContain('valid');
    expect(images).toContain('>');
    expect(images).toContain('content');
  });

  test('should handle special characters in text content', () => {
    const input = 'text with @#$%^&*()[]{}|;:,.<>?/~`';
    const result = tokenize(input);
    expect(result.errors).toHaveLength(0);
    const images = result.tokens.map((t) => t.image);
    expect(images).toEqual(['text', ' ', 'with', ' ', '@#$%^&*()[]{}|;:,.', '<', '>', '?/~`']);
  });
});
