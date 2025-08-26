# Intermediate Representation

**Attributes Applicable to All Tags:**

- speaker (ai/human/system) - The speaker of the current content
- original-start-index (integer) - The start offset of the element corresponding to the current one in the original document
- original-end-index (integer) - The end offset of the element corresponding to the current one in the original document

* **any** - Represents a generic container for arbitrary data values. Useful for storing dynamic or unstructured content.
  - type (string) - The data type of the value ('string', 'integer', 'float', 'boolean', 'array', 'object', 'buffer', 'null', or 'undefined').
  - name (string) - An optional identifier for the data.

* **b** - Represents text that should be displayed in boldface. Useful for highlighting important words or phrases.

* **code** - Represents a block or inline fragment of code. It can optionally include language and formatting attributes.
  - inline (boolean) - Indicates whether the code is inline (true) or a block element (false).
  - lang (string) - Specifies the programming language or syntax highlighting mode.
  - blank-line (boolean) - Inserts a blank line before and after the code block if inline = false.

* **env** - Represents a formatting environment or container to specify how nested content should be output.
  - presentation (string) - The output style or format mode ('markup', 'serialize', 'free', or 'multimedia').
  - markup-lang (string) - The specific markup language, required only if presentation = 'markup'.
  - serializer (string) - The name of the serializer, required only if presentation = 'serialize'.
  - writer-options (object) - Optional parameters passed to the writer constructor for customizing output.

* **h** - Represents a heading element.
  - level (integer) - Indicates the heading level. Typically ranges from 1 (highest level) to 6 (lowest level).

* **i** - Represents text that should be displayed in italics. Useful for emphasizing words or phrases.

* **img** - Represents an image element.
  - base64 (string) - The base64-encoded image data.
  - alt (string) - Alternative text describing the image.
  - position (string) - The placement of the image relative to text, such as 'here', 'top', or 'bottom'.
  - type (string) - The image MIME type (e.g., 'image/jpeg', 'image/png').

* **item** - Represents a single item within a list. Typically used as a child element of "list".

* **list** - Represents an ordered or unordered list of items.
  - list-style (string) - The style of the list bullets or enumeration (e.g., 'star', 'dash', 'decimal').

* **nl** - Inserts newline characters.
  - count (integer) - Specifies how many newline characters to insert.

* **obj** - Represents a data object, typically stored in JSON format.
  - data (object) - A valid JSON object containing the structured data.

* **p** - Represents a paragraph of text. Useful for dividing content into readable blocks.
  - blank-line (boolean) - Inserts a blank line before and after the paragraph when true.

* **s** - Represents text that should be displayed with a strikethrough style.

* **span** - Represents an inline container for text without additional formatting. Useful for applying attributes without changing display structure.

* **table** - Represents a table structure containing rows and cells.

* **tbody** - Represents the body section of a table, containing the majority of data rows.

* **tcell** - Represents a single cell within a table row.

* **text** - Represents raw or unformatted text content.

* **thead** - Represents the header section of a table, typically containing column headings.

* **trow** - Represents a single row within a table, containing one or more cells.

* **u** - Represents text that should be displayed with an underline.
