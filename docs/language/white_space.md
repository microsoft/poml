# Controlling White Space

!!! warning

    This feature is experimental and may change in future releases. Use with caution.

POML provides experimental whitespace control options that allow you to fine-tune how white spaces in texts get processed. This is particularly useful when working with different content types or when you need precise control over spacing.

## White Space Options

The `whiteSpace` attribute can be applied to most POML components and accepts three values:

- **`pre`** (default for `syntax="text"`): Preserves all whitespace exactly as written, including spaces, tabs, and line breaks.
- **`filter`** (default for other syntaxes): Removes leading and trailing whitespace, and normalizes internal whitespace in the gaps between elements.
- **`trim`**: Trims whitespace from the beginning and end of the content.

## Example Usage 

```xml
<poml>
  <!-- Preserve exact formatting with 'pre' -->
  <p whiteSpace="pre" syntax="markdown">This text    has multiple
  spaces and
      indentation preserved.


      You can also include endless new lines.</p>

  <!-- Normalize whitespace with 'filter' -->
  <p whiteSpace="filter">This text    will have
  normalized    spacing.

  New lines will also be reduced to a space.
  </p>

  <!-- Trim whitespace with 'trim' -->
  <p whiteSpace="trim">   This text will have leading    and trailing spaces removed.   </p>
</poml>
```

The POML above renders to:

```
This text    has multiple
  spaces and
      indentation preserved.


      You can also include endless new lines.

This text will have normalized spacing. New lines will also be reduced to a space.

This text will have leading    and trailing spaces removed.
```

### White Space Related to Syntax

The `whiteSpace` attribute only controls how whitespace is handled when rendering to the [IR](../deep-dive/ir.md). When converting the IR to specific formats like Markdown, JSON or XML, the whitespace could still be affected by the syntax rules of that format. For example, Markdown may collapse multiple spaces into one single space.

### Global vs. Local Control

You can set whitespace handling at the document level or override it for specific elements:

```xml
<poml whiteSpace="filter">
  <p>This paragraph uses filtered whitespace.</p>
  
  <code whiteSpace="pre">
    function example() {
        return "code with preserved indentation";
    }
  </code>
  
  <p whiteSpace="trim">   This paragraph trims whitespace.   </p>
</poml>
```
