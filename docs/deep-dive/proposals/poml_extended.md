# Extended POML File Format Design Specification

> Status: Under implementation

## Overview

This document describes the design for an extended POML file format that supports mixed content files - files that can contain both pure text (e.g., Markdown) and POML markup elements seamlessly integrated together.

## Current Limitations

The current POML implementation requires files to be fully enclosed within `<poml>...</poml>` tags. Even though the outer level `<poml>...</poml>` can be optional, the markup file is always parsed with one single pass of XML parser. This creates friction when users want to:

1. Write primarily text-based documents (like Markdown or Jinja) with occasional POML components
2. Usually need to escape characters like `<` and `>` in text content
3. Gradually migrate existing text files to use POML features

## Design Goals

1. **Backward Compatibility**: Most of existing POML files should continue to work without changes
2. **Flexibility**: Support pure text files with embedded POML elements
3. **Seamless Integration**: Allow switching between text and POML modes within a single file
4. **Controlled Evolution of Tags**: behaviour of new/experimental tags is opt‑in via `<meta enable="...">`, preventing accidental breakage when upgrading the tool‑chain.

## File Format Specification

### Extended POML Files

Extended POML files can contain:

1. **Pure Text Content**: Regular text content (Markdown, plain text, etc.)
2. **POML Element Pairs**: Any element pair defined in `componentDocs.json` (e.g., `<poml>...</poml>`, `<p>...</p>`, `<task>...</task>`)
3. **Mixed Content**: Combination of pure text and POML elements

### Element Detection

The system will assume the whole file is a pure text file and detects certain parts as POML elements based on the following:

1. Loading component definitions from `componentDocs.json` and extracting valid POML component names and their aliases.
2. Scanning for opening tags that match these components, and scanning until the corresponding closing tag is found.
3. If a special tag `<text>...</text>` is found within a POML segment, it will be treated as pure text content and processed following the rules above (step 1 and 2).
4. Unknown or disabled tags are treated as literal text and, by default, raise a diagnostic warning.

An example is shown below:

#### Example 1

```markdown
# My Analysis Document

This is a regular markdown document that explains the task.

<task>
  Analyze the following data and provide insights.
</task>

Here are some key points to consider:

- Data quality
- Statistical significance
- Business impact

<examples>
  <example>
    <input>Sample data point 1</input>
    <output>Analysis result 1</output>
  </example>
</examples>

## Conclusion

The analysis shows...
```

#### Example 2

```xml
<poml>
  <task>Process the following data</task>
  <text>
    This is **markdown** content that will be processed as pure text.

    - Item 1
    - Item 2

    {{ VARIABLES_WILL_ALSO_SHOWN_AS_IS }}
    <cp caption="Nested POML">This is a nested POML component that will be processed as POML.</cp>

    No POML processing happens here.
  </text>
  <hint>Remember to check the format</hint>
</poml>

There can be some intervening text here as well.

<poml>
  <p>You can add another POML segment here: {{variable_will_be_substituted}}</p>
</poml>

<p>POML elements do not necessarily reside in a <text><poml> (the <poml> here is processed as is.)</text> element.</p>
```

**Escaping Note**: To directly show a POML tag in the text, users can use a `<text>` tag to wrap the content, as shown in the example above. If they want to escape a pair such as `<poml>...</poml>`, they can escape the opening tag and closing tag respectively, such as `<text><poml></text>...<text></poml></text>`.

### File-level Metadata

Metadatas are information that is useful when parsing and rendering the file, such as context variables, stylesheets, version information, file paths, etc.
File-level metadata can be included at any place of the file in a special `<meta>` tag. This metadata will be processed before any content parsing.
By default, metadata has no child contents. When child contents exist, `<meta>` tag must have type to specify what kind of content is provided.

**Example:**

```xml
<meta minimalPomlVersion="0.3" />
<meta stylesheet="/path/to/stylesheet.json" />
<meta components="+reference,-table" unknownComponents="warning" />
<meta context="/path/to/contextFile.json" />
<meta type="context"></meta>
{ "foo": "bar" }
</meta>
```

## Architecture Design

### High-level Processing Pipeline

The core of the new architecture is a three-pass process: Tokenization and AST Parsing, and Recursive Rendering.

#### I. Tokenization and AST Parsing

This phase processes the raw file content into an Abstract Syntax Tree (AST). It leverages the provided ExtendedPomlLexer.

- **Tokenization**: The ExtendedPomlLexer (using chevrotain) scans the entire input string and breaks it into a flat stream of tokens (TagOpen, Identifier, TextContent, TemplateOpen, etc.). This single lexing pass is sufficient for the entire mixed-content file. The distinction between "text" and "POML" is not made at this stage; it's simply a stream of tokens.
- **AST Parsing Algorithm**: A CST (Concrete Syntax Tree) or AST parser will consume the token stream from the lexer. The parser is stateful, using a `PomlContext` object to track parsing configurations.
  1. The parser starts in "text mode". It consumes TextContent, TemplateOpen/TemplateClose, and other non-tag tokens, bundling them into TEXT or TEMPLATE nodes.
  2. When a TagOpen (`<`) token is followed by the Identifier "meta", a META node is created. Its attributes are immediately parsed to populate the `PomlContext`. This allows metadata to control the parsing of the remainder of the file (e.g., by enabling new tags). The META node is added to the AST but will be ignored during rendering.
  3. When a TagOpen (`<`) token is followed by an Identifier that matches a known POML component (from componentDocs.json and enabled via PomlContext), the parser switches to "POML mode" and creates a POML node.
  4. In "POML mode," it parses attributes (Identifier, Equals, DoubleQuote/SingleQuote), nested tags, and content until it finds a matching TagClosingOpen (`<`) token. Template variables `{{}}` within attribute values or content are parsed into child TEMPLATE nodes.
  5. If the tag is `<text>`, it creates a POML node for `<text>` itself, but its _children_ are parsed by recursively applying the "text mode" logic (step 1), allowing for nested POML within `<text>`.
  6. If a TagOpen is followed by an Identifier that is _not_ a known POML component, the parser treats these tokens (`<`, tagname, `>`) as literal text and reverts to "text mode".
  7. The parser closes the current POML node when the corresponding TagClosingOpen (`<`) and Identifier are found. After closing the top-level POML tag, it reverts to "text mode".

- **Error Tolerance**: The parser will be designed to be error-tolerant. If a closing tag is missing, it can infer closure at the end of the file or when a new top-level tag begins, logging a diagnostic warning.

- **Source Mapping**: The chevrotain tokens inherently contain offset, line, and column information. This data is directly transferred to the ASTNode during parsing, enabling robust code intelligence features.

- **Output**: An AST representing the hierarchical structure of the document, where each node contains source position information and type metadata.

**`ASTNode` Interface**: The AST nodes represent the parsed structure with source mapping.

```typescript
interface SourceRange {
  start: number;
  end: number;
}

interface AttributeInfo {
  key: string;
  value: (ASTNode & { kind: 'TEXT' | 'TEMPLATE' })[]; // Mixed content: array of text/template nodes
  keyRange: SourceRange; // Position of attribute name
  valueRange: SourceRange; // Position of attribute value (excluding quotes)
  fullRange: SourceRange; // Full attribute including key="value"
}

interface ASTNode {
  id: string; // Unique ID for caching and React keys
  kind: 'META' | 'TEXT' | 'POML' | 'TEMPLATE';
  start: number; // Source position start of entire node
  end: number; // Source position end of entire node
  content: string; // The raw string content
  parent?: ASTNode; // Reference to the parent node
  children: ASTNode[]; // Child nodes

  // For POML and META nodes
  tagName?: string; // Tag name (e.g., 'task', 'meta')
  attributes?: AttributeInfo[]; // Detailed attribute information

  // Detailed source positions
  openingTag?: {
    start: number; // Position of '<'
    end: number; // Position after '>'
    nameRange: SourceRange; // Position of tag name
  };

  closingTag?: {
    start: number; // Position of '</'
    end: number; // Position after '>'
    nameRange: SourceRange; // Position of tag name in closing tag
  };

  contentRange?: SourceRange; // Position of content between tags (excluding nested tags)

  // For TEXT nodes
  textSegments?: SourceRange[]; // Multiple ranges for text content (excluding nested POML)

  // For TEMPLATE nodes
  expression?: string; // The full expression content between {{}}
}
```

**`PomlContext` Interface**: This context object is the single source of truth for the entire file, passed through all readers. It's mutable, allowing stateful operations like `<let>` to have a file-wide effect.

```typescript
interface PomlContext {
  variables: { [key: string]: any }; // For {{ substitutions }} and <let> (Read/Write)
  stylesheet: { [key: string]: string }; // Merged styles from all <meta> tags (Read-Only during render)
  minimalPomlVersion?: string; // From <meta> (Read-Only)
  sourcePath: string; // File path for resolving includes (Read-Only)
}
```

#### II. Text/POML Dispatching (Recursive Rendering)

Rendering starts at the root of the AST and proceeds recursively. A controller dispatches AST nodes to the appropriate reader.

- **`PureTextReader`**: Handles `TEXT` nodes.
  - Currently we directly render the pure-text contents as a single React element. In future, we can:
    - Renders the text content, potentially using a Markdown processor.
    - Performs variable substitutions (`{{...}}`) using the `variables` from `PomlContext`. The logic from `handleText` in the original `PomlFile` should be extracted into a shared utility for this.
  - Iterates through its `children` nodes. For each child `POML` node, it calls the `PomlReader`.

- **`PomlReader`**: Handles `POML` nodes.
  - **Delegation**: Instantiates a modified `PomlFile` class with the processed node content and the shared `PomlContext`.
  - **Rendering**: Calls the `pomlFile.react(context)` method to render the node.

- **`IntelliSense Layer`**: The AST makes it easy to provide context-aware IntelliSense. By checking the `kind` of the node at the cursor's offset, the request can be routed to the correct provider—either the `PomlReader`'s XML-aware completion logic or a simpler text/variable completion provider for `TEXT` nodes.

**`Reader` Interface**: This interface defines the contract for both `PureTextReader` and `PomlReader`.

```typescript
interface Reader {
  read(segment: Segment, context: PomlContext?): React.ReactElement;
  getHoverToken(segment: Segment, offset: number): PomlToken | undefined;
  getCompletions(offset: number): PomlToken[];
}
```

### Implementation & `PomlFile` Refactoring

To achieve this design, the existing `PomlFile` class needs significant refactoring. Its role changes from a file-level controller to a specialized parser for `POML` segments.

#### **Key Modifications to `PomlFile`**

1. **Constructor (`new PomlFile`)**:

- **Remove Auto-Wrapping**: The `autoAddPoml` logic must be **removed**. The `PomlReader` will only pass it well-formed XML content corresponding to a single `POML` segment. The constructor will now assume the input `text` is a valid XML string.
- **Receive Context**: The constructor should accept the `PomlContext` object to access shared state.

2. **State Management (`handleLet`)**:

- The `<let>` tag's implementation must be modified to read from and write to the **shared `PomlContext.variables` object**, not a local context. This ensures that a variable defined in one POML block is available to subsequent POML blocks in the same file.

3. **Handling `<include>`**:

- The `handleInclude` method should be **removed** from `PomlFile`. Inclusion is now handled at a higher level by the main processing pipeline. When the `PomlReader` encounters an `<include>` tag, it will invoke the entire pipeline (Segmentation, Metadata, Rendering) on the included file and insert the resulting React elements.
