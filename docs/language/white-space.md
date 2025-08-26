# Controlling White Space

<!-- prettier-ignore -->
!!! warning

    This feature is experimental and may change in future releases. Use with caution.

POML provides experimental whitespace control options that allow you to fine-tune how white spaces in texts get processed. This is particularly useful when working with different content types or when you need precise control over spacing.

## White Space Options

The `whiteSpace` attribute (or `white-space`) can be applied to most POML components and accepts three values:

- **`pre`** (default for `syntax="text"`): Preserves all whitespace exactly as written, including spaces, tabs, and line breaks.
- **`filter`** (default for other syntaxes): Removes leading and trailing whitespace, and normalizes internal whitespace in the gaps between elements.
- **`trim`**: Trims whitespace from the beginning and end of the content.

<!-- prettier-ignore -->
!!! note

    `whiteSpace` only applies to the current component, not its children. If you are applying to multiple components, consider using [stylesheets](./meta.md).

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

```text
This text    has multiple
  spaces and
      indentation preserved.


      You can also include endless new lines.

This text will have normalized spacing. New lines will also be reduced to a space.

This text will have leading    and trailing spaces removed.
```

### White Space Related to Syntax

The `whiteSpace` attribute only controls how whitespace is handled when rendering to the [IR](../deep-dive/ir.md). When converting the IR to specific formats like Markdown, JSON or XML, the whitespace could still be affected by the syntax rules of that format. For example:

```xml
<poml syntax="markdown" whiteSpace="pre">Marker 0
Marker 1<p>   The first paragraph.   </p>
Marker 2<p>   The second paragraph.   </p>
Marker 3</poml>
```

Renders to:

```text
Marker 0
Marker 1

The first paragraph.


Marker 2

The second paragraph.


Marker 3
```

To keep the whitespace exactly as you want it, consider using `syntax="text"` with `whiteSpace="pre"` (but note that you cannot use `<p>` tags within `syntax="text"`):

```xml
<poml syntax="text" whiteSpace="pre">
```
