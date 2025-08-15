# Components

## Basic Components

### Audio

Audio (`<audio>`) embeds an audio file in the content.

Accepts either a file path (`src`) or base64-encoded audio data (`base64`).
The MIME type can be provided via `type` or will be inferred from the file extension.

#### Usages

```xml
<Audio src="path/to/audio.mp3" />
```

#### Parameters

- **src**: Path to the audio file. If provided, the file will be read and encoded as base64.
- **base64**: Base64-encoded audio data. Cannot be used together with `src`.
- **alt**: The alternative text to show when the image cannot be displayed.
- **type**: The MIME type of the audio (e.g., audio/mpeg, audio/wav). If not specified, it will be inferred from the file extension.
    The type must be consistent with the real type of the file. The consistency will NOT be checked or converted.
    The type can be specified with or without the `audio/` prefix.
- **position**: Can be one of: top, bottom, here. The position of the image. Default is `here`.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, multimedia. Only when specified as `multimedia`, the image will be shown.
    Otherwise, the alt text will be shown. By default, it's `multimedia` when `alt` is not specified. Otherwise, it's undefined (inherit from parent).

### Bold

Bold (`<b>`) emphasizes text in a bold style when using markup syntaxes.

#### Usages

```xml
<p><b>Task:</b> Do something.</p>
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### CaptionedParagraph

CaptionedParagraph (`<cp>` for short) creates a paragraph with a customized caption title.

#### Usages

```xml
<cp caption="Constraints">
  <list>
    <item>Do not exceed 1000 tokens.</item>
    <item>Please use simple words.</item>
  </list>
</cp>
```

#### Parameters

- **caption**: The title or label for the paragraph. Required.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes.
    By default, it's same as `caption`.
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `header`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionEnding**: Can be one of: colon, newline, colon-newline, none. A caption can ends with a colon, a newline or simply nothing.
  If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Code

Code is used to represent code snippets or inline code in markup syntaxes.

#### Usages

```xml
<code inline="true">const x = 42;</code>
```

```xml
<code lang="javascript">
const x = 42;
</code>
```

#### Parameters

- **inline**: Boolean. Whether to render code inline or as a block. Default is `true`.
- **lang**: The language of the code snippet.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Header

Header (`<h>`) renders headings in markup syntaxes.
It's commonly used to highlight titles or section headings.
The header level will be automatically computed based on the context.
Use SubContent (`<section>`) for nested content.

#### Usages

```xml
<Header syntax="markdown">Section Title</Header>
```

#### Parameters

- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Inline

Inline (`<span>`) is a container for inline content.
When used with markup syntaxes, it wraps text in an inline style, without any preceding or following blank characters.
In serializer syntaxes, it's treated as a generic value.
Inline elements are not designed to be used alone (especially in serializer syntaxes).
One might notice problematic renderings (e.g., speaker not applied) when using it alone.

#### Usages

```xml
<p>I'm listening to <span>music</span> right now.</p>
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Italic

Italic (`<i>`) emphasizes text in an italic style when using markup syntaxes.

#### Usages

```xml
Your <i>italicized</i> text.
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### List

List (`<list>`) is a container for multiple ListItem (`<item>`) elements.
When used with markup syntaxes, a bullet or numbering is added.

#### Usages

```xml
<list listStyle="decimal">
  <item>Item 1</item>
  <item>Item 2</item>
</list>
```

#### Parameters

- **listStyle**: Can be one of: star, dash, plus, decimal, latin. The style for the list marker, such as dash or star. Default is `dash`.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### ListItem

ListItem (`<item>`) is an item within a List component.
In markup mode, it is rendered with the specified bullet or numbering style.

#### Usages

```xml
<list listStyle="decimal">
  <item blankLine="true">Item 1</item>
  <item>Item 2</item>
</list>
```

#### Parameters

- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Newline

Newline (`<br>`) explicitly adds a line break, primarily in markup syntaxes.
In serializer syntaxes, it's ignored.

#### Usages

```xml
<br />
```

#### Parameters

- **newLineCount**: Number. The number of linebreaks to add.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Paragraph

Paragraph (`<p>`) is a standalone section preceded by and followed by two blank lines in markup syntaxes.
It's mostly used for text contents.

#### Usages

```xml
<p>Contents of the paragraph.</p>
```

#### Parameters

- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Strikethrough

Strikethrough (`<s>`, `<strike>`) indicates removed or invalid text in markup syntaxes.

#### Usages

```xml
<s>This messages is removed.</s>
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### SubContent

SubContent (`<section>`) renders nested content, often following a header.
The headers within the section will be automatically adjusted to a lower level.

#### Usages

```xml
<h>Section Title</h>
<section>
  <h>Sub-section Title</h>  <!-- Nested header -->
  <p>Sub-section details</p>
</section>
```

#### Parameters

- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Text

Text (`<text>`, `<poml>`) is a wrapper for any contents.
By default, it uses `markdown` syntax and writes the contents within it directly to the output.
When used with "markup" syntaxes, it renders a standalone section preceded and followed by one blank line.
It's mostly used in the root element of a prompt, but it should also work in any other places.
This component will be automatically added as a wrapping root element if it's not provided:
1. If the first element is pure text contents, `<poml syntax="text">` will be added.
2. If the first element is a POML component, `<poml syntax="markdown">` will be added.

#### Usages

```xml
<poml syntax="text">
Contents of the whole prompt.

1. Your customized list.
2. You don't need to know anything about POML.
</poml>
```

To render the whole prompt in markdown syntax with a "human" speaker:

```xml
<poml syntax="markdown" speaker="human">
  <p>You are a helpful assistant.</p>
  <p>What is the capital of France?</p>
</poml>
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Underline

Underline (`<u>`) draws a line beneath text in markup syntaxes.

#### Usages

```xml
This text is <u>underlined</u>.
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

## Intentions

### Example

Example is useful for providing a context, helping the model to understand what kind of inputs and outputs are expected.
It can also be used to demonstrate the desired output style, clarifying the structure, tone, or level of detail in the response.

#### Usages

```xml
<example>
  <input>What is the capital of France?</input>
  <output>Paris</output>
</example>
```

```xml
<task>Summarize the following passage in a single sentence.</task>
<example>
  <input caption="Passage">The sun provides energy for life on Earth through processes like photosynthesis.</input>
  <output caption="Summary">The sun is essential for energy and life processes on Earth.</output>
</example>
```

#### Parameters

- **caption**: The title or label for the example paragraph. Default is `Example`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `example`.
- **captionStyle**: Determines the style of the caption, applicable only for "markup" syntaxes. Default is `hidden`.
  Options include `header`, `bold`, `plain`, or `hidden`.
- **chat**: Boolean. Indicates whether the example should be rendered in chat format.
  When used in a example set (`<examples>`), this is inherited from the example set.
  Otherwise, it defaults to `false` for "serializer" syntaxes and `true` for "markup" syntaxes.
- **captionTextTransform**: Specifies text transformation for the caption, applicable only for "markup" syntaxes.
  Options are `upper`, `lower`, `capitalize`, or `none`. Default is `none`.
- **captionColon**: Boolean. Indicates whether to append a colon after the caption.
  By default, this is true for `bold` or `plain` captionStyle, and false otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### ExampleInput

ExampleInput (`<input>`) is a paragraph that represents an example input.
By default, it's spoken by a human speaker in a chat context, but you can manually specify the speaker.

#### Usages

```xml
<input>What is the capital of France?</input>
```

When used with a template:

```xml
<input>What is the capital of {{country}}?</input>
```

#### Parameters

- **caption**: The title or label for the example input paragraph. Default is `Input`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `input`.
- **speaker**: The speaker for the example input. Default is `human` if chat context is enabled (see `<example>`).
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `hidden` if chat context is enabled. Otherwise, it's `bold`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionColon**: Boolean. Indicates whether to append a colon after the caption.
  By default, this is true for `bold` or `plain` captionStyle, and false otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### ExampleOutput

ExampleOutput (`<output>`) is a paragraph that represents an example output.
By default, it's spoken by a AI speaker in a chat context, but you can manually specify the speaker.

#### Usages

```xml
<output>The capital of France is Paris.</output>
```

When used with a template:

```xml
<output>The capital of {{country}} is {{capital}}.</output>
```

#### Parameters

- **caption**: The title or label for the example output paragraph. Default is `Output`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `output`.
- **speaker**: The speaker for the example output. Default is `ai` if chat context is enabled (see `<example>`).
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `hidden` if chat context is enabled. Otherwise, it's `bold`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionColon**: Boolean. Indicates whether to append a colon after the caption.
  By default, this is true for `bold` or `plain` captionStyle, and false otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### ExampleSet

Example set (`<examples>`) is a collection of examples that are usually presented in a list.
With the example set, you can manage multiple examples under a single title and optionally an introducer,
as well as the same `chat` format.
You can also choose to use `<example>` purely without example set.

#### Usages

```xml
<examples chat={{true}}>
  <example>
    <input>What is the capital of France?</input>
    <output>Paris</output>
  </example>
  <example>
    <input>What is the capital of Germany?</input>
    <output>Berlin</output>
  </example>
</examples>
```

#### Parameters

- **caption**: The title or label for the example set paragraph. Default is `Examples`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `examples`.
- **chat**: Boolean. Indicates whether the examples should be rendered in chat format.
  By default, it's `true` for "markup" syntaxes and `false` for "serializer" syntaxes.
- **introducer**: An optional introducer text to be displayed before the examples.
  For example, `Here are some examples:`.
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `header`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionEnding**: Can be one of: colon, newline, colon-newline, none. A caption can ends with a colon, a newline or simply nothing.
  If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Hint

Hint can be used anywhere in the prompt where you want to provide a helpful tip or explanation.
It is usually a short and concise statement that guides the LLM in the right direction.

#### Usages

```xml
<hint>Alice first purchased 4 apples and then 3 more, so she has 7 apples in total.</hint>
```

#### Parameters

- **caption**: The title or label for the hint paragraph. Default is `Hint`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `hint`.
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `bold`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionColon**: Boolean. Indicates whether to append a colon after the caption.
  By default, this is true for `bold` or `plain` captionStyle, and false otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Introducer

Introducer is a paragraph before a long paragraph (usually a list of examples, steps, or instructions).
It serves as a context introducing what is expected to follow.

#### Usages

```xml
<introducer>Here are some examples.</introducer>
```

#### Parameters

- **caption**: The title or label for the introducer paragraph. Default is `Introducer`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `introducer`.
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `hidden`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionEnding**: Can be one of: colon, newline, colon-newline, none. A caption can ends with a colon, a newline or simply nothing.
  If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### OutputFormat

Output format deals with the format in which the model should provide the output.
It can be a specific format such as JSON, XML, or CSV, or a general format such as a story,
a diagram or steps of instructions.
Please refrain from specifying too complex formats that the model may not be able to generate,
such as a PDF file or a video.

#### Usages

```xml
<output-format>Respond with a JSON without additional characters or punctuations.</output-format>
```

#### Parameters

- **caption**: The title or label for the output format paragraph. Default is `Output Format`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `outputFormat`.
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `header`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionEnding**: Can be one of: colon, newline, colon-newline, none. A caption can ends with a colon, a newline or simply nothing.
  If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Question

Question (`<qa>`) is actually a combination of a question and a prompt for the answer.
It's usually used at the end of a prompt to ask a question.
The question is followed by a prompt for answer (e.g., `Answer:`) to guide the model to respond.

#### Usages

```xml
<qa>What is the capital of France?</qa>
```

#### Parameters

- **questionCaption**: The title or label for the question paragraph. Default is `Question`.
- **answerCaption**: The title or label for the answer paragraph. Default is `Answer`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `question`.
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `bold`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionEnding**: Can be one of: colon, newline, colon-newline, none. A caption can ends with a colon, a newline or simply nothing.
  If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Role

Specifies the role you want the language model to assume when responding.
Defining a role provides the model with a perspective or context,
such as a scientist, poet, child, or any other persona you choose.

#### Usages

```xml
<role>You are a data scientist.</role>
```

#### Parameters

- **caption**: The title or label for the role paragraph. Default is `Role`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `role`.
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `header`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionEnding**: Can be one of: colon, newline, colon-newline, none. A caption can ends with a colon, a newline or simply nothing.
  If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### StepwiseInstructions

StepwiseInstructions that elaborates the task by providing a list of steps or instructions.
Each step should be concise and clear, and the list should be easy to follow.

#### Usages

```xml
<stepwise-instructions>
  <list>
    <item>Interpret and rewrite user's query.</item>
    <item>Think of a plan to solve the query.</item>
    <item>Generate a response based on the plan.</item>
  </list>
</stepwise-instructions>
```

#### Parameters

- **caption**: The title or label for the stepwise instructions paragraph. Default is `Stepwise Instructions`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `stepwiseInstructions`.
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `header`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionEnding**: Can be one of: colon, newline, colon-newline, none. A caption can ends with a colon, a newline or simply nothing.
  If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Task

Task represents the action you want the language model to perform.
It is a directive or instruction that you want the model to follow.
Task is usually not long, but rather a concise and clear statement.
Users can also include a list of steps or instructions to complete the task.

#### Usages

```xml
<task>Cook a recipe on how to prepare a beef dish.</task>
```

When including a list of steps:
```xml
<task>
  Planning a schedule for a travel.
  <list>
    <item>Decide on the destination and plan the duration.</item>
    <item>Find useful information about the destination.</item>
    <item>Write down the schedule for each day.</item>
  </list>
</task>
```

#### Parameters

- **caption**: The title or label for the task paragraph. Default is `Task`.
- **captionSerialized**: The serialized version of the caption when using "serializer" syntaxes. Default is `task`.
- **captionStyle**: Can be one of: header, bold, plain, hidden. Determines the style of the caption,
  applicable only for "markup" syntaxes. Default is `header`.
- **captionTextTransform**: Can be one of: upper, level, capitalize, none. Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
- **captionEnding**: Can be one of: colon, newline, colon-newline, none. A caption can ends with a colon, a newline or simply nothing.
  If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
- **blankLine**: Boolean. Whether to add one more blank line (2 in total) before and after the paragraph.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

## Data Displays

### Document

Displaying an external document like PDF, TXT or DOCX.

#### Usages

To display a Word document without including the real multimedia:
```xml
<Document src="sample.docx" multimedia="false"/>
```

#### Parameters

- **src**: The source file to read the data from. This must be provided if records is not provided.
- **buffer**: Buffer. Document data buffer. Recommended to use `src` instead unless you want to use a string.
- **base64**: Base64 encoded string of the document data. Mutually exclusive with `src` and `buffer`.
- **parser**: Can be one of: auto, pdf, docx, txt. The parser to use for reading the data. If not provided, it will be inferred from the file extension.
- **multimedia**: Boolean. If true, the multimedias will be displayed. If false, the alt strings will be displayed at best effort. Default is `true`.
- **selectedPages**: The pages to be selected. This is only available **for PDF documents**. If not provided, all pages will be selected.
  You can use a string like `2` to specify a single page, or slice like `2:4` to specify a range of pages (2 inclusive, 4 exclusive).
  The pages selected are **0-indexed**. Negative indexes like `-1` is not supported here.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Image

Image (`<img>`) displays an image in the content.
Alternatively, it can also be shown as an alt text by specifying the `syntax` prop.
Note that syntax must be specified as `multimedia` to show the image.

#### Usages

```xml
<Image src="path/to/image.jpg" alt="Image description" position="bottom" />
```

#### Parameters

- **src**: The path or URL to the image file.
- **alt**: The alternative text to show when the image cannot be displayed.
- **base64**: The base64 encoded image data. It can not be specified together with `src`.
- **type**: The MIME type of the image **to be shown**. If not specified, it will be inferred from the file extension.
    If specified, the image will be converted to the specified type. Can be `image/jpeg`, `image/png`, etc., or without the `image/` prefix.
- **position**: Can be one of: top, bottom, here. The position of the image. Default is `here`.
- **maxWidth**: Number. The maximum width of the image to be shown.
- **maxHeight**: Number. The maximum height of the image to be shown.
- **resize**: Number. The ratio to resize the image to to be shown.
- **syntax**: Can be one of: markdown, html, json, yaml, xml, multimedia. Only when specified as `multimedia`, the image will be shown.
    Otherwise, the alt text will be shown. By default, it's `multimedia` when `alt` is not specified. Otherwise, it's undefined (inherit from parent).
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Object

Object (`<obj>`, `<dataObj>`) displays external data or object content.
When in serialize mode, it's serialized according to the given serializer.

#### Usages

```xml
<Object syntax="json" data="{ key: 'value' }" />
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, xml. The syntax or serializer of the content. Default is `json`.
- **data**: Object. The data object to render.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Table

Displaying a table with records and columns.

#### Usages

```xml
<table records="{{[{ name: 'Alice', age: 20 }, { name: 'Bob', age: 30 }]}}" />
```

To import an excel file, and display the first 10 records in csv syntax:

```xml
<table src="data.xlsx" parser="excel" maxRecords="10" syntax="csv" />
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, text, csv, tsv, xml. The output syntax of the content.
- **records**: Object. A list, each element is an object / dictionary / list of elements. The keys are the fields and the values are the data in cells.
- **columns**: Object. A list of column definitions. Each column definition is an object with keys "field", "header", and "description".
  The field is the key in the record object, the header is displayed in the top row, and the description is meant to be an explanation.
  Columns are optional. If not provided, the columns are inferred from the records.
- **src**: The source file to read the data from. This must be provided if records is not provided.
- **parser**: Can be one of: auto, csv, tsv, excel, json, jsonl. The parser to use for reading the data. If not provided, it will be inferred from the file extension.
- **selectedColumns**: Object. The selected columns to display. If not provided, all columns will be displayed.
  It should be an array of column field names, e.g. `["name", "age"]`; or a string like `2:4` to select columns 2 (inclusive) to 4 (exclusive).
  There is a special column name called `index` which is the enumeration of the records starting from 0.
  You can also use a special value called `+index` to add the index column to the original table.
- **selectedRecords**: Object. The selected records to display. If not provided, all records will be displayed.
  It should be an array of record indices, e.g. `[0, 1]`; or a string like `2:4` to select records 2 (inclusive) to 4 (exclusive).
- **maxRecords**: Number. The maximum number of records to display. If not provided, all records will be displayed.
- **maxColumns**: Number. The maximum number of columns to display. If not provided, all columns will be displayed.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

## Utilities

### AiMessage

Wrap the contents in a AI message.

#### Usages

```xml
<ai-msg>Paris</ai-msg>
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Conversation

Display a conversation between system, human and AI.

#### Usages

```xml
<conversation messages="{{[{ speaker: 'human', content: 'What is the capital of France?' }, { speaker: 'ai', content: 'Paris' }]}}" />
```

#### Parameters

- **messages**: Object. A list of message. Each message should have a `speaker` and a `content` field.
- **selectedMessages**: The messages to be selected. If not provided, all messages will be selected.
  You can use a string like `2` to specify a single message, or slice like `2:4` to specify a range of messages (2 inclusive, 4 exclusive).
  Or use `-6:` to select the last 6 messages.

### Folder

Displays a directory structure as a tree.

#### Usages

To display a directory structure with a filter for Python files:
```xml
<folder src="project_dir" filter=".*\.py$" maxDepth="3" />
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, text, xml. The output syntax of the content.
- **src**: The source directory path to display.
- **data**: TreeItemData[]. Alternative to src, directly provide tree data structure.
- **filter**: RegExp. A regular expression to filter files.
    The regex is applied to the folder names and file names (not the full path).
    Directories are included by default unless all of their nested content is filtered out.
    When filter is on, empty directories will not be shown.
- **maxDepth**: Number. Maximum depth of directory traversal. Default is 3.
- **showContent**: Boolean. Whether to show file contents. Default is false.

### HumanMessage

Wrap the contents in a user message.

#### Usages

```xml
<user-msg>What is the capital of France?</user-msg>
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### MessageContent

Display a message content.

#### Usages

```xml
<msg-content content="What is the capital of France?" />
```

#### Parameters

- **content**: Object. The content of the message. It can be a string, or an array of strings and multimedia content.

### SystemMessage

Wrap the contents in a system message.

#### Usages

```xml
<system-msg>Answer concisely.</system-msg>
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **name**: The name of the content, used in serialization.
- **type**: The type of the content, used in serialization.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.

### Tree

Renders a tree structure in various formats.

#### Usages

```xml
<Tree items={treeData} syntax="markdown" showContent={true} />
```

#### Parameters

- **syntax**: Can be one of: markdown, html, json, yaml, text, xml. The output syntax to use for rendering the tree
- **items**: TreeItemData[]. Array of tree items to render
- **showContent**: Boolean. Whether to show content values of tree items

### Webpage

Displays content from a webpage.

#### Usages

Display content from a URL:
```xml
<webpage url="https://example.com" />
```

Extract only specific content using a selector:
```xml
<webpage url="https://example.com" selector="main article" />
```

Convert HTML to structured POML components:
```xml
<webpage url="https://example.com" extractText="false" />
```

#### Parameters

- **url**: The URL of the webpage to fetch and display.
- **src**: Local file path to an HTML file to display.
- **buffer**: Buffer. HTML content as string or buffer.
- **base64**: Base64 encoded HTML content.
- **extractText**: Boolean. Whether to extract plain text content (true) or convert HTML to structured POML (false). Default is false.
- **selector**: CSS selector to extract specific content from the page (e.g., "article", ".content", "#main"). Default is "body".
- **syntax**: Can be one of: markdown, html, json, yaml, xml, text. The syntax of the content.
- **className**: A class name for quickly styling the current block with stylesheets.
- **speaker**: Can be one of: human, ai, system. The speaker of the content. By default, it's determined by the context and the content.
- **writerOptions**: Object. An experimental optional JSON string to customize the format of markdown headers, JSON indents, etc.