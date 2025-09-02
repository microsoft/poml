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
<!-- 4. **Component Discovery**: Automatically detect POML elements from `componentDocs.json` -->

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

## Architecture Design

### High-level Processing Pipeline

The core of the new architecture is a three-pass process: Segmentation, Metadata Extraction, and Recursive Rendering.

#### I. Segmentation Pass

This initial pass is a crucial preprocessing step that scans the raw file content and partitions it into a hierarchical tree of segments. It does **not** parse the full XML structure of POML blocks; it only identifies their boundaries.

- **Objective**: To classify every part of the file as `META`, `POML`, or `TEXT` and build a nested structure.
- **Algorithm**:
  1. Load all valid POML component tag names (including aliases) from `componentDocs.json`. This set of tags will be used for detection.
  2. Initialize the root of the segment tree as a single, top-level `TEXT` segment spanning the entire file, unless the root segment is a single `<poml>...</poml>` block spanning the whole file (in which case it will be treated as a `POML` segment).
  3. Use a stack-based algorithm to scan the text.
  - When an opening tag (e.g., `<task>`) that matches a known POML component is found, push its name and start position onto the stack. This marks the beginning of a potential `POML` segment.
  - When a closing tag (e.g., `</task>`) is found that matches the tag at the top of the stack, pop the stack. This marks a complete `POML` segment. This new segment is added as a child to the current parent segment in the tree.
  - The special `<text>` tag is handled recursively. If a `<text>` tag is found _inside_ a `POML` segment, the scanner will treat its content as a nested `TEXT` segment. This `TEXT` segment can, in turn, contain more `POML` children.
  - Any content not enclosed within identified `POML` tags remains part of its parent `TEXT` segment.
  4. `<meta>` tags are treated specially. They are identified and parsed into `META` segments at any level but are logically hoisted and processed first. They should not have children.

- **Output**: A `Segment` tree. For backward compatibility, if the root segment is a single `<poml>...</poml>` block spanning the whole file, the system can revert to the original, simpler parsing model.

**`Segment` Interface**: The `children` property is key to representing the nested structure of mixed-content files.

```typescript
interface Segment {
  id: string; // Unique ID for caching and React keys
  kind: 'META' | 'TEXT' | 'POML';
  start: number;
  end: number;
  content: string; // The raw string content of the segment
  parent?: Segment; // Reference to the parent segment
  children: Segment[]; // Nested segments (e.g., a POML block within text)
  tagName?: string; // For POML segments, the name of the root tag (e.g., 'task')
}
```

#### II. Metadata Processing

Once the segment tree is built, all `META` segments are processed.

- **Extraction**: Traverse the tree to find all `META` segments.
- **Population**: Parse the content of each `<meta>` tag and populate the global `PomlContext` object.
- **Removal**: After processing, `META` segments are removed from the tree to prevent them from being rendered.

**`PomlContext` Interface**: This context object is the single source of truth for the entire file, passed through all readers. It's mutable, allowing stateful operations like `<let>` to have a file-wide effect.

```typescript
interface PomlContext {
  variables: { [key: string]: any }; // For {{ substitutions }} and <let> (Read/Write)
  texts: { [key: string]: React.ReactElement }; // Maps TEXT_ID to content for <text> replacement (Read/Write)
  stylesheet: { [key: string]: string }; // Merged styles from all <meta> tags (Read-Only during render)
  minimalPomlVersion?: string; // From <meta> (Read-Only)
  sourcePath: string; // File path for resolving includes (Read-Only)
}
```

#### III. Text/POML Dispatching (Recursive Rendering)

Rendering starts at the root of the segment tree and proceeds recursively. A controller dispatches segments to the appropriate reader.

- **`PureTextReader`**: Handles `TEXT` segments.
  - Currently we directly render the pure-text contents as a single React element. In future, we can:
    - Renders the text content, potentially using a Markdown processor.
    - Performs variable substitutions (`{{...}}`) using the `variables` from `PomlContext`. The logic from `handleText` in the original `PomlFile` should be extracted into a shared utility for this.
  - Iterates through its `children` segments. For each child `POML` segment, it calls the `PomlReader`.

- **`PomlReader`**: Handles `POML` segments.
  - **Pre-processing**: Before parsing, it replaces any direct child `<text>` regions with a self-closing placeholder tag containing a unique ID: `<text ref="TEXT_ID_123" />`. The original content of the `<text>` segment is stored in `context.texts`. This ensures the XML parser inside `PomlFile` doesn't fail on non-XML content (like Markdown).
  - **Delegation**: Instantiates a modified `PomlFile` class with the processed segment content and the shared `PomlContext`.
  - **Rendering**: Calls the `pomlFile.react(context)` method to render the segment.

- **`IntelliSense Layer`**: The segment tree makes it easy to provide context-aware IntelliSense. By checking the `kind` of the segment at the cursor's offset, the request can be routed to the correct provider—either the `PomlReader`'s XML-aware completion logic or a simpler text/variable completion provider for `TEXT` segments.

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

4. **Parsing `TEXT` Placeholders**:

- The core `parseXmlElement` method needs a new branch to handle the `<text ref="..." />` placeholder.
- When it encounters this element:
  1. It extracts the `ref` attribute (e.g., `"TEXT_ID_123"`).
  2. It looks up the corresponding raw text from `context.texts`.
  3. It fetches from the `context.texts` map and returns a React element containing the pure text content.
