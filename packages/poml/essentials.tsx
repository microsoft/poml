import * as React from 'react';
import { component, expandRelative, PropsBase, ReadError, useWithCatch } from './base';
import {
  Markup,
  Serialize,
  InlineProps,
  PropsMarkupBase,
  PropsSerializeBase,
  PropsPresentationBase,
  Presentation,
  computePresentationOrUndefined,
  PropsFreeBase,
  Free,
  MultiMedia,
} from './presentation';
import * as fs from 'fs';
import { preprocessImage } from './util/image';
import { preprocessAudio } from './util/audio';

export interface PropsSyntaxBase extends PropsBase {
  syntax?: string;
}

export type PropsSyntaxAny = PropsSyntaxBase & Serialize.AnyProps;

const FREE_SYNTAXES = ['text'];

const MARKUP_SYNTAXES = ['markdown', 'html', 'csv', 'tsv'];

const SERIALIZE_SYNTAXES = ['json', 'yaml', 'xml'];

const MULTIMEDIA_SYNTAXES = ['multimedia'];

export const computeSyntaxContext = (
  props: PropsSyntaxBase,
  defaultSyntax?: string,
  invalidPresentations?: string[],
): Presentation => {
  const { syntax, ...others } = props;
  invalidPresentations = invalidPresentations ?? ['multimedia'];

  // 1. Create the full presentation style based on the syntax shortcut.
  // This is the case when syntax is explicity specified.
  let presentationStyle: PropsMarkupBase | PropsSerializeBase | PropsFreeBase | PropsPresentationBase;
  if (!syntax) {
    presentationStyle = {};
  } else if (MARKUP_SYNTAXES.includes(syntax)) {
    if (invalidPresentations.includes('markup')) {
      throw ReadError.fromProps(`Markup syntax (${syntax}) is not supported here.`, others);
    }
    presentationStyle = { presentation: 'markup', markupLang: syntax };
  } else if (SERIALIZE_SYNTAXES.includes(syntax)) {
    if (invalidPresentations.includes('serialize')) {
      throw ReadError.fromProps(`Serialize syntax (${syntax}) is not supported here.`, others);
    }
    presentationStyle = { presentation: 'serialize', serializer: syntax };
  } else if (FREE_SYNTAXES.includes(syntax)) {
    if (invalidPresentations.includes('free')) {
      throw ReadError.fromProps(`Free syntax (${syntax}) is not supported here.`, others);
    }
    presentationStyle = { presentation: 'free' };
  } else if (MULTIMEDIA_SYNTAXES.includes(syntax)) {
    if (invalidPresentations.includes('multimedia')) {
      throw ReadError.fromProps(`Multimedia syntax (${syntax}) is not supported here.`, others);
    }
    presentationStyle = { presentation: 'multimedia' };
  } else {
    throw ReadError.fromProps(`Unsupported syntax: ${syntax}`, others);
  }

  // 2. Compute the presentation context.
  // Try to inherit presentation and syntax from parents.
  // There are two cases where the inherited presentation does not count.
  // (a) No presentation is found.
  // (b) The presentation is free and the syntax is not specified.
  const presentation = computePresentationOrUndefined(presentationStyle);
  if (!presentation || (presentation === 'free' && !syntax)) {
    if (syntax) {
      // This should not happen. Must be a bug.
      throw ReadError.fromProps(
        `Syntax is specified (${syntax}) but presentation method is not found. Something is wrong.`,
        others,
      );
    }

    // Try again with a default syntax
    return computeSyntaxContext(
      { ...others, syntax: defaultSyntax || 'markdown' },
      defaultSyntax,
      invalidPresentations,
    );
  }
  return presentation;
};

// Helper component for contents that are designed for markup, but also work in other syntaxes.
export const AnyOrFree = component('AnyOrFree')((
  props: React.PropsWithChildren<PropsSyntaxAny & { presentation: Presentation; asAny: boolean }>,
) => {
  const { syntax, children, presentation, name, type, asAny, ...others } = props;
  if (presentation === 'serialize') {
    if (asAny) {
      return (
        <Serialize.Any serializer={syntax} name={name} type={type} {...others}>
          {children}
        </Serialize.Any>
      );
    } else {
      return (
        <Serialize.Environment serializer={syntax} {...others}>
          {children}
        </Serialize.Environment>
      );
    }
  } else if (presentation === 'free') {
    return <Free.Text {...others}>{children}</Free.Text>;
  } else {
    throw ReadError.fromProps(`This component is not designed for ${presentation} syntaxes.`, others);
  }
});

/**
 * Text (`<text>`, `<poml>`) is a wrapper for any contents.
 * By default, it uses `markdown` syntax and writes the contents within it directly to the output.
 * When used with "markup" syntaxes, it renders a standalone section preceded and followed by one blank line.
 * It's mostly used in the root element of a prompt, but it should also work in any other places.
 * This component will be automatically added as a wrapping root element if it's not provided:
 * 1. If the first element is pure text contents, `<poml syntax="text">` will be added.
 * 2. If the first element is a POML component, `<poml syntax="markdown">` will be added.
 *
 * @param {'markdown'|'html'|'json'|'yaml'|'xml'|'text'} syntax - The syntax of the content. Note `xml` and `text` are experimental.
 * @param className - A class name for quickly styling the current block with stylesheets.
 * @param {'human'|'ai'|'system'} speaker - The speaker of the content. By default, it's determined by the context and the content.
 * @param name - The name of the content, used in serialization.
 * @param type - The type of the content, used in serialization.
 * @param {object} writerOptions - **Experimental.**. Optional JSON string to customize the format of markdown headers, JSON indents, etc.
 * @param {'pre'|'filter'|'trim'} whiteSpace - **Experimental.** Controls how whitespace is handled in text content.
 *   `'pre'` (default when `syntax` is `text`): Preserves all whitespace as-is;
 *   `'filter'` (default when `syntax` is not `text`): Removes leading/trailing whitespace and normalizes internal whitespace in the gaps;
 *   `'trim'`: Trims whitespace from the beginning and end.
 * @param {number} charLimit - **Experimental.** Soft character limit before truncation is applied. Content exceeding this limit will be truncated with a marker.
 * @param {number} tokenLimit - **Experimental.** Soft token limit before truncation is applied. Content exceeding this limit will be truncated with a marker.
 * @param {number} priority - **Experimental.** Priority used when truncating globally. Lower numbers are dropped first when content needs to be reduced to fit limits.
 *
 * @example
 * ```xml
 * <poml syntax="text">
 * Contents of the whole prompt.
 *
 * 1. Your customized list.
 * 2. You don't need to know anything about POML.
 * </poml>
 * ```
 *
 * To render the whole prompt in markdown syntax with a "human" speaker:
 *
 * ```xml
 * <poml syntax="markdown" speaker="human">
 *   <p>You are a helpful assistant.</p>
 *   <p>What is the capital of France?</p>
 * </poml>
 * ```
 *
 * **Experimental usage with limits and priority:**
 *
 * ```xml
 * <poml syntax="markdown" tokenLimit="10">
 *   <p priority="1">This has lower priority and may be truncated first.</p>
 *   <p priority="3">This has higher priority and will be preserved longer.</p>
 * </poml>
 * ```
 */
export const Text = component('Text', ['div', 'poml'])((props: React.PropsWithChildren<PropsSyntaxAny>) => {
  const { syntax, children, name, type, ...others } = props;
  const presentation = computeSyntaxContext(props, 'markdown');

  if (presentation === 'markup') {
    return (
      <Paragraph syntax={syntax} blankLine={false} {...others}>
        {children}
      </Paragraph>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={true} name={name} type={type} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

export const Poml = Text;

/**
 * Paragraph (`<p>`) is a standalone section preceded by and followed by two blank lines in markup syntaxes.
 * It's mostly used for text contents.
 *
 * @param {boolean} blankLine - Whether to add one more blank line (2 in total) before and after the paragraph.
 *
 * @see {@link Text} for other props available.
 *
 * @example
 * ```xml
 * <p>Contents of the paragraph.</p>
 * ```
 */
export const Paragraph = component('Paragraph', ['p'])((
  props: React.PropsWithChildren<PropsSyntaxAny & Markup.ParagraphProps>,
) => {
  const { syntax, children, name, type, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.Paragraph markupLang={syntax} {...others}>
        {children}
      </Markup.Paragraph>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={true} name={name} type={type} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * Inline (`<span>`) is a container for inline content.
 * When used with markup syntaxes, it wraps text in an inline style, without any preceding or following blank characters.
 * In serializer syntaxes, it's treated as a generic value.
 * Inline elements are not designed to be used alone (especially in serializer syntaxes).
 * One might notice problematic renderings (e.g., speaker not applied) when using it alone.
 *
 * @param {'markdown'|'html'|'json'|'yaml'|'xml'|'text'} syntax - The syntax of the content.
 * @param className - A class name for quickly styling the current block with stylesheets.
 * @param {'human'|'ai'|'system'} speaker - The speaker of the content. By default, it's determined by the context and the content.
 * @param {object} writerOptions - **Experimental.**. Optional JSON string to customize the format of markdown headers, JSON indents, etc.
 * @param {'pre'|'filter'|'trim'} whiteSpace - **Experimental.** Controls how whitespace is handled in text content.
 *   `'pre'` (default when `syntax` is `text`): Preserves all whitespace as-is;
 *   `'filter'` (default when `syntax` is not `text`): Removes leading/trailing whitespace and normalizes internal whitespace in the gaps;
 *   `'trim'`: Trims whitespace from the beginning and end.
 * @param {number} charLimit - **Experimental.** Soft character limit before truncation is applied. Content exceeding this limit will be truncated with a marker.
 * @param {number} tokenLimit - **Experimental.** Soft token limit before truncation is applied. Content exceeding this limit will be truncated with a marker.
 * @param {number} priority - **Experimental.** Priority used when truncating globally. Lower numbers are dropped first when content needs to be reduced to fit limits.
 *
 * @example
 * ```xml
 * <p>I'm listening to <span>music</span> right now.</p>
 * ```
 */
export const Inline = component('Inline', ['span'])((props: React.PropsWithChildren<PropsSyntaxBase>) => {
  const { syntax, children, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.Inline markupLang={syntax} {...others}>
        {children}
      </Markup.Inline>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={false} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * Newline (`<br>`) explicitly adds a line break, primarily in markup syntaxes.
 * In serializer syntaxes, it's ignored.
 *
 * @param {number} newLineCount - The number of linebreaks to add.
 *
 * @see {@link Inline} for other props available.
 *
 * @example
 * ```xml
 * <br />
 * ```
 */
export const Newline = component('Newline', ['br'])((props: PropsSyntaxBase & Markup.NewlineProps) => {
  const { syntax, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return <Markup.Newline markupLang={syntax} {...others} />;
  } else {
    return null;
  }
});

/**
 * Header (`<h>`) renders headings in markup syntaxes.
 * It's commonly used to highlight titles or section headings.
 * The header level will be automatically computed based on the context.
 * Use SubContent (`<section>`) for nested content.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <Header syntax="markdown">Section Title</Header>
 * ```
 */
export const Header = component('Header', ['h'])((
  props: React.PropsWithChildren<PropsSyntaxAny & Markup.ParagraphProps>,
) => {
  const { syntax, children, name, type, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.Header markupLang={syntax} {...others}>
        {children}
      </Markup.Header>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={true} name={name} type={type} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * SubContent (`<section>`) renders nested content, often following a header.
 * The headers within the section will be automatically adjusted to a lower level.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <h>Section Title</h>
 * <section>
 *   <h>Sub-section Title</h>  <!-- Nested header -->
 *   <p>Sub-section details</p>
 * </section>
 * ```
 */
export const SubContent = component('SubContent', ['section'])((
  props: React.PropsWithChildren<PropsSyntaxAny & Markup.ParagraphProps>,
) => {
  const { syntax, children, name, type, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.SubContent markupLang={syntax} {...others}>
        {children}
      </Markup.SubContent>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={true} name={name} type={type} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * Bold (`<b>`) emphasizes text in a bold style when using markup syntaxes.
 *
 * @see {@link Inline} for other props available.
 *
 * @example
 * ```xml
 * <p><b>Task:</b> Do something.</p>
 * ```
 */
export const Bold = component('Bold', ['b'])((props: React.PropsWithChildren<PropsSyntaxBase>) => {
  const { syntax, children, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.Bold markupLang={syntax} {...others}>
        {children}
      </Markup.Bold>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={false} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * Italic (`<i>`) emphasizes text in an italic style when using markup syntaxes.
 *
 * @see {@link Inline} for other props available.
 *
 * @example
 * ```xml
 * Your <i>italicized</i> text.
 * ```
 */
export const Italic = component('Italic', ['i'])((props: React.PropsWithChildren<PropsSyntaxBase>) => {
  const { syntax, children, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.Italic markupLang={syntax} {...others}>
        {children}
      </Markup.Italic>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={false} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * Strikethrough (`<s>`, `<strike>`) indicates removed or invalid text in markup syntaxes.
 *
 * @see {@link Inline} for other props available.
 *
 * @example
 * ```xml
 * <s>This messages is removed.</s>
 * ```
 */
export const Strikethrough = component('Strikethrough', ['s', 'strike'])((
  props: React.PropsWithChildren<PropsSyntaxBase>,
) => {
  const { syntax, children, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.Strikethrough markupLang={syntax} {...others}>
        {children}
      </Markup.Strikethrough>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={false} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * Underline (`<u>`) draws a line beneath text in markup syntaxes.
 *
 * @see {@link Inline} for other props available.
 *
 * @example
 * ```xml
 * This text is <u>underlined</u>.
 * ```
 */
export const Underline = component('Underline', ['u'])((props: React.PropsWithChildren<PropsSyntaxBase>) => {
  const { syntax, children, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.Underline markupLang={syntax} {...others}>
        {children}
      </Markup.Underline>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={false} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * Code is used to represent code snippets or inline code in markup syntaxes.
 *
 * @param {boolean} inline - Whether to render code inline or as a block. Default is `true`.
 * @param lang - The language of the code snippet.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <code inline="true">const x = 42;</code>
 * ```
 *
 * ```xml
 * <code lang="javascript">
 * const x = 42;
 * </code>
 * ```
 */
export const Code = component('Code')((
  props: React.PropsWithChildren<PropsSyntaxAny & InlineProps & Markup.CodeProps>,
) => {
  const { syntax, children, name, type, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.Code markupLang={syntax} {...others}>
        {children}
      </Markup.Code>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={true} name={name} type={type} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * List (`<list>`) is a container for multiple ListItem (`<item>`) elements.
 * When used with markup syntaxes, a bullet or numbering is added.
 *
 * @param {'star'|'dash'|'plus'|'decimal'|'latin'} listStyle - The style for the list marker, such as dash or star. Default is `dash`.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <list listStyle="decimal">
 *   <item>Item 1</item>
 *   <item>Item 2</item>
 * </list>
 * ```
 */
export const List = component('List')((
  props: React.PropsWithChildren<PropsSyntaxAny & Markup.ListProps & Markup.ParagraphProps>,
) => {
  const { syntax, children, listStyle, name, type, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.List markupLang={syntax} listStyle={listStyle} {...others}>
        {children}
      </Markup.List>
    );
  } else {
    return (
      <AnyOrFree
        syntax={syntax}
        presentation={presentation}
        asAny={true}
        name={name}
        type={type ?? 'array'}
        {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * ListItem (`<item>`) is an item within a List component.
 * In markup mode, it is rendered with the specified bullet or numbering style.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <list listStyle="decimal">
 *   <item blankLine="true">Item 1</item>
 *   <item>Item 2</item>
 * </list>
 * ```
 */
export const ListItem = component('ListItem', ['item'])((
  props: React.PropsWithChildren<PropsSyntaxAny & Markup.ParagraphProps>,
) => {
  const { syntax, children, name, type, ...others } = props;
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    return (
      <Markup.ListItem markupLang={syntax} {...others}>
        {children}
      </Markup.ListItem>
    );
  } else {
    return (
      <AnyOrFree syntax={syntax} presentation={presentation} asAny={true} name={name} type={type} {...others}>
        {children}
      </AnyOrFree>
    );
  }
});

/**
 * DataObject (`<obj>`, `<object>`, `<dataObj>`) displays external data or object content.
 * When in serialize mode, it's serialized according to the given serializer.
 *
 * @param {'markdown'|'html'|'json'|'yaml'|'xml'} syntax - The syntax or serializer of the content. Default is `json`.
 * @param {object} data - The data object to render.
 *
 * @see {@link Inline} for other props available.
 *
 * @example
 * ```xml
 * <DataObject syntax="json" data="{ key: 'value' }" />
 * ```
 */
export const DataObject = component('Object', ['obj', 'object', 'dataObj'])((
  props: React.PropsWithChildren<PropsSyntaxBase & Serialize.ObjectProps>,
) => {
  const { syntax, children, ...others } = props;
  const presentation = computeSyntaxContext(props, 'json');
  if (presentation === 'serialize') {
    return (
      <Serialize.Object serializer={syntax} {...others}>
        {children}
      </Serialize.Object>
    );
  } else {
    return <Text syntax={syntax}>{JSON.stringify(props.data)}</Text>;
  }
});

interface ImageProps extends PropsSyntaxBase, MultiMedia.ImageProps {
  src?: string;
  maxWidth?: number;
  maxHeight?: number;
  resize?: number;
}

/**
 * Image (`<img>`) displays an image in the content.
 * Alternatively, it can also be shown as an alt text by specifying the `syntax` prop.
 * Note that syntax must be specified as `multimedia` to show the image.
 *
 * @see {@link Inline} for other props available.
 *
 * @param {string} src - The path or URL to the image file.
 * @param {string} alt - The alternative text to show when the image cannot be displayed.
 * @param {string} base64 - The base64 encoded image data. It can not be specified together with `src`.
 * @param {string} type - The MIME type of the image **to be shown**. If not specified, it will be inferred from the file extension.
 *   If specified, the image will be converted to the specified type. Can be `image/jpeg`, `image/png`, etc., or without the `image/` prefix.
 * @param {'top'|'bottom'|'here'} position - The position of the image. Default is `here`.
 * @param {number} maxWidth - The maximum width of the image to be shown.
 * @param {number} maxHeight - The maximum height of the image to be shown.
 * @param {number} resize - The ratio to resize the image to to be shown.
 * @param {'markdown'|'html'|'json'|'yaml'|'xml'|'multimedia'} syntax - Only when specified as `multimedia`, the image will be shown.
 *   Otherwise, the alt text will be shown. By default, it's `multimedia` when `alt` is not specified. Otherwise, it's undefined (inherit from parent).
 *
 * @example
 * ```xml
 * <Image src="path/to/image.jpg" alt="Image description" position="bottom" />
 * ```
 */
export const Image = component('Image', { aliases: ['img'], asynchorous: true })((props: ImageProps) => {
  let { syntax, src, base64, alt, type, position, maxWidth, maxHeight, resize, ...others } = props;
  if (!alt) {
    syntax = syntax ?? 'multimedia';
  }
  const presentation = computeSyntaxContext({ ...props, syntax }, 'multimedia', []);
  if (presentation === 'multimedia') {
    if (src) {
      if (base64) {
        throw ReadError.fromProps('Cannot specify both `src` and `base64`.', others);
      }
      const isUrl = /^https?:\/\//i.test(src);
      if (!isUrl) {
        src = expandRelative(src);
        if (!fs.existsSync(src)) {
          throw ReadError.fromProps(`Image file not found: ${src}`, others);
        }
      }
    } else if (!base64) {
      throw ReadError.fromProps('Either `src` or `base64` must be specified.', others);
    }
    const image = useWithCatch(preprocessImage({ src, base64, type, maxWidth, maxHeight, resize }), others);
    if (!image) {
      return null;
    }
    return (
      <MultiMedia.Image
        presentation={presentation}
        base64={image.base64}
        position={position}
        type={image.mimeType}
        alt={alt}
        {...others}
      />
    );
  } else {
    return <Inline syntax={syntax}>{alt}</Inline>;
  }
});

interface AudioProps extends PropsSyntaxBase, MultiMedia.AudioProps {
  src?: string;
}

/**
 * Audio (`<audio>`) embeds an audio file in the content.
 *
 * Accepts either a file path (`src`) or base64-encoded audio data (`base64`).
 * The MIME type can be provided via `type` or will be inferred from the file extension.
 *
 * @param {string} src - Path to the audio file. If provided, the file will be read and encoded as base64.
 * @param {string} base64 - Base64-encoded audio data. Cannot be used together with `src`.
 * @param {string} alt - The alternative text to show when the image cannot be displayed.
 * @param {string} type - The MIME type of the audio (e.g., audio/mpeg, audio/wav). If not specified, it will be inferred from the file extension.
 *   The type must be consistent with the real type of the file. The consistency will NOT be checked or converted.
 *   The type can be specified with or without the `audio/` prefix.
 * @param {'top'|'bottom'|'here'} position - The position of the image. Default is `here`.
 * @param {'markdown'|'html'|'json'|'yaml'|'xml'|'multimedia'} syntax - Only when specified as `multimedia`, the image will be shown.
 *   Otherwise, the alt text will be shown. By default, it's `multimedia` when `alt` is not specified. Otherwise, it's undefined (inherit from parent).
 *
 * @example
 * ```xml
 * <Audio src="path/to/audio.mp3" />
 * ```
 * @example
 * ```xml
 * <Audio base64="..." type="audio/wav" />
 * ```
 */
export const Audio = component('Audio', { aliases: ['audio'], asynchorous: true })((props: AudioProps) => {
  let { syntax, src, base64, type, ...others } = props;
  const presentation = computeSyntaxContext(props, 'multimedia', []);
  if (presentation === 'multimedia') {
    if (src) {
      if (base64) {
        throw ReadError.fromProps('Cannot specify both `src` and `base64`.', others);
      }
      src = expandRelative(src);
      if (!fs.existsSync(src)) {
        throw ReadError.fromProps(`Audio file not found: ${src}`, others);
      }
    } else if (!base64) {
      throw ReadError.fromProps('Either `src` or `base64` must be specified.', others);
    }
    const audio = useWithCatch(preprocessAudio({ src, base64, type }), others);
    if (!audio) {
      return null;
    }
    return <MultiMedia.Audio presentation={presentation} base64={audio.base64} type={audio.mimeType} {...others} />;
  } else {
    return null;
  }
});

export interface ToolRequestProps extends PropsSyntaxBase, MultiMedia.ToolRequestProps {}

export interface ToolResponseProps extends PropsSyntaxBase, MultiMedia.ToolResponseProps {}

/**
 * ToolRequest represents an AI-generated tool request with parameters.
 * Used to display tool calls made by AI models.
 *
 * @param {string} id - Tool request ID
 * @param {string} name - Tool name
 * @param {any} parameters - Tool input parameters
 * @param {'human'|'ai'|'system'} speaker - The speaker of the content. Default is `ai`.
 *
 * @example
 * ```xml
 * <ToolRequest id="123" name="search" parameters={{ query: "hello" }} />
 * ```
 */
export const ToolRequest = component('ToolRequest', { aliases: ['toolRequest'] })((props: ToolRequestProps) => {
  let { syntax, id, name, parameters, speaker, ...others } = props;
  syntax = syntax ?? 'multimedia';
  const presentation = computeSyntaxContext({ ...props, syntax }, 'multimedia', []);

  if (presentation === 'multimedia') {
    return (
      <MultiMedia.ToolRequest
        presentation={presentation}
        id={id}
        name={name}
        parameters={parameters}
        speaker={speaker ?? 'ai'}
        {...others}
      />
    );
  } else {
    return <DataObject syntax={syntax} speaker={speaker ?? 'ai'} data={{ id, name, parameters }} {...others} />;
  }
});

/**
 * ToolResponse represents the result of a tool execution.
 * Used to display tool execution results with rich content.
 *
 * @param {'markdown'|'html'|'json'|'yaml'|'xml'|'text'} syntax - The syntax of ToolResponse is special.
 *   It is always `multimedia` for itself. The syntax is used to render the content inside.
 *   If not specified, it will inherit from the parent context.
 * @param {string} id - Tool call ID to respond to
 * @param {string} name - Tool name
 * @param {'human'|'ai'|'system'|'tool'} speaker - The speaker of the content. Default is `tool`.
 *
 * @example
 * ```xml
 * <ToolResponse id="123" name="search">
 *  <Paragraph>Search results for "hello":</Paragraph>
 *  <List>
 *   <ListItem>Result 1</ListItem>
 *   <ListItem>Result 2</ListItem>
 *  </List>
 * </ToolResponse>
 * ```
 */
export const ToolResponse = component('ToolResponse', { aliases: ['toolResponse'] })((
  props: React.PropsWithChildren<ToolResponseProps>,
) => {
  const { syntax, id, name, children, speaker, ...others } = props;
  const presentation = computeSyntaxContext(props);
  let syntaxFromContext = syntax;
  if (syntaxFromContext === undefined) {
    if (presentation === 'markup') {
      syntaxFromContext = 'markdown';
    } else if (presentation === 'serialize') {
      syntaxFromContext = 'json';
    } else if (presentation === 'free') {
      syntaxFromContext = 'text';
    } else if (presentation === 'multimedia') {
      syntaxFromContext = 'multimedia';
    }
  }

  return (
    <MultiMedia.ToolResponse presentation={'multimedia'} id={id} name={name} speaker={speaker ?? 'tool'} {...others}>
      <Inline syntax={syntaxFromContext}>{children}</Inline>
    </MultiMedia.ToolResponse>
  );
});
