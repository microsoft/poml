/**
 * NOTE: The components in this file are the lowest-level APIs and for internal use only.
 *
 * There are two main ways to present data: as markup or as serialized data.
 * 1. Markup is to be rendered as markup languages like Markdown, Wikitext, etc.
 * 2. Serialized data is to be rendered as JSON, XML, etc.
 *
 * When rendered as serialized data, the framework will output key-value pairs,
 * objects, arrays, etc. instead of bolds, italics, headers that are considered
 * helpful for human readers in markup texts.
 *
 * HTML is a special case. It can be considered as a markup language because it
 * has the tags that are used to format the text. However, it can also be considered
 * as serialized data when using its tags to represent key-value pairs.
 *
 * Presentation can be configured in stylesheet, but it's a special style that can
 * be propagated down to the children components. All other styles are only set for
 * current active component, including the serializer language, which only affects
 * the enclosing environment of the markup/serialized.
 */

import * as React from 'react';

import { component, PropsBase, irElement, ReadError, trimChildrenWhiteSpace } from './base';
import { AnyValue } from './util';

export type Presentation = 'markup' | 'serialize' | 'free' | 'multimedia';
export const DefaultMarkupLang = 'markdown';
export const DefaultSerializer = 'json';
export type Position = 'top' | 'bottom' | 'here';

export interface PropsPresentationBase extends PropsBase {
  presentation?: Presentation;
}

export interface PropsMarkupBase extends PropsPresentationBase {
  presentation?: 'markup';
  markupLang?: string;
}

export interface PropsSerializeBase extends PropsPresentationBase {
  presentation?: 'serialize';
  serializer?: string;
}

export interface PropsFreeBase extends PropsPresentationBase {
  presentation?: 'free';
}

export interface PropsMultiMediaBase extends PropsPresentationBase {
  presentation?: 'multimedia';
}

export interface InlineProps {
  inline?: boolean;
}

// The context that stores the current presentation appraoch.
// The language is preserved in the context,
// because we need to know whether to create a environment with a different lang.
const PresentationApproach = React.createContext<
  PropsMarkupBase | PropsSerializeBase | PropsFreeBase | PropsMultiMediaBase | undefined
>(undefined);

/**
 * Get the current presentation approach.
 * Used by components to determine how to render themselves.
 */
export const computePresentation = (
  props: PropsMarkupBase | PropsSerializeBase | PropsFreeBase | PropsMultiMediaBase | PropsPresentationBase,
): Presentation => {
  const result = computePresentationOrUndefined(props);
  if (!result) {
    throw ReadError.fromProps(`No presentation approach found in context or currently: ${props}`, props);
  }
  return result;
};

export const computePresentationOrUndefined = (
  props: PropsMarkupBase | PropsSerializeBase | PropsFreeBase | PropsMultiMediaBase | PropsPresentationBase,
): Presentation | undefined => {
  if (
    props.presentation === 'markup' ||
    props.presentation === 'serialize' ||
    props.presentation === 'free' ||
    props.presentation === 'multimedia'
  ) {
    return props.presentation;
  } else if ((props as any).presentation) {
    throw ReadError.fromProps(`Invalid presentation: ${(props as any).presentation}`, props);
  }
  const presentation = React.useContext(PresentationApproach);
  return presentation?.presentation;
};

export namespace Markup {
  /**
   * Encloses a markup component.
   * It could produce nothing if it's not necessary to wrap the component.
   */
  export const Environment = component('Markup.Environment')((props: React.PropsWithChildren<PropsMarkupBase>) => {
    const parentPresentation = React.useContext(PresentationApproach);

    // presentation is extracted but not used here. We are already in markup mode.
    let { presentation, markupLang, children, originalStartIndex, originalEndIndex, writerOptions, sourcePath } = props;

    if (!markupLang) {
      if (parentPresentation?.presentation === 'markup') {
        markupLang = (parentPresentation as PropsMarkupBase).markupLang;
      } else {
        markupLang = DefaultMarkupLang;
      }
    }

    return parentPresentation?.presentation === 'markup' &&
      (parentPresentation as PropsMarkupBase).markupLang === markupLang &&
      (!writerOptions || (parentPresentation as PropsMarkupBase).writerOptions === writerOptions) ? (
      <>{children}</>
    ) : (
      irElement(
        'env',
        { presentation: 'markup', markupLang, writerOptions, originalStartIndex, originalEndIndex, sourcePath },
        <PresentationApproach.Provider
          value={{
            presentation: 'markup',
            markupLang: markupLang,
            writerOptions: writerOptions,
          }}>
          {trimChildrenWhiteSpace(children, props)}
        </PresentationApproach.Provider>,
      )
    );
  });

  export const EncloseSerialize = component('Markup.EncloseSerialize')((
    props: React.PropsWithChildren<InlineProps & CodeProps>,
  ) => {
    const { children, inline = false, ...others } = props;
    return (
      <Markup.Code inline={inline} {...others}>
        {children}
      </Markup.Code>
    );
  });

  const SimpleMarkupComponent = (props: React.PropsWithChildren<PropsMarkupBase & { tagName: string }>) => {
    // Sometimes it helps to extract attributes like markupLang to avoid too many props sent to IR.
    // But this is not necessary.
    const { children, tagName, markupLang, presentation, ...others } = props;
    return (
      <Markup.Environment markupLang={markupLang} presentation={presentation} {...others}>
        {irElement(tagName, others, children)}
      </Markup.Environment>
    );
  };

  const HeaderLevel = React.createContext(1);

  export interface ParagraphProps {
    blankLine?: boolean; // whether to add 1 more blank line before and after paragraph.
  }

  // Paragraph is a block preceded by a newline and followed by a newline.
  // The paragraph in our context is the most common block element.
  // It can be nested, and represent complex sections and rich texts.
  export const Paragraph = component('Markup.Paragraph')((
    props: React.PropsWithChildren<PropsMarkupBase & ParagraphProps>,
  ) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='p'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  // Inline is a light-weight element that is wrapped by two spaces.
  export const Inline = component('Markup.Inline')((props: React.PropsWithChildren<PropsMarkupBase>) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='span'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  // NewLine explicitly adds newlines (vertical spaces).
  export interface NewlineProps {
    newlineCount?: number;
  }

  export const Newline = component('Markup.Newline')((props: PropsMarkupBase & NewlineProps) => {
    const { newlineCount, ...others } = props;
    return <Markup.Environment {...others}>{irElement('nl', { count: newlineCount, ...others })}</Markup.Environment>;
  });

  // Header is a block that is usually used to emphasize the title of a section.
  export const Header = component('Markup.Header')((
    props: React.PropsWithChildren<PropsMarkupBase & ParagraphProps>,
  ) => {
    const ctxLevel = React.useContext(HeaderLevel);
    const { children, ...others } = props;
    return (
      <Markup.Environment {...others}>
        {irElement(
          'h',
          {
            level: ctxLevel,
            ...others,
          },
          children,
        )}
      </Markup.Environment>
    );
  });

  // SubContent usually follows a header and states that the headers inside it are sub-headers.
  // It's same as a paragraph in all other aspects.
  export const SubContent = component('Markup.SubContent')((
    props: React.PropsWithChildren<PropsMarkupBase & Markup.ParagraphProps>,
  ) => {
    const { children, ...others } = props;
    const ctxLevel = React.useContext(HeaderLevel);
    // needn't trim here.
    return (
      <HeaderLevel.Provider value={ctxLevel + 1}>
        <Markup.Paragraph {...others}>{children}</Markup.Paragraph>
      </HeaderLevel.Provider>
    );
  });

  // Bold is a Inline element that is used to emphasize the text.
  export const Bold = component('Markup.Bold')((props: React.PropsWithChildren<PropsMarkupBase>) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='b'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  // Italic is a Inline element that is used to emphasize the text.
  export const Italic = component('Markup.Italic')((props: React.PropsWithChildren<PropsMarkupBase>) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='i'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  // Strikethrough is a Inline element that is used to represent deleted text.
  export const Strikethrough = component('Markup.Strikethrough')((props: React.PropsWithChildren<PropsMarkupBase>) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='s'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  // Underline is a Inline element that is used to represent underlined text.
  export const Underline = component('Markup.Underline')((props: React.PropsWithChildren<PropsMarkupBase>) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='u'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  // Code is a Inline element that is used to represent code snippets.
  export interface CodeProps {
    lang?: string;
  }

  export const Code = component('Markup.Code')((
    props: React.PropsWithChildren<PropsMarkupBase & InlineProps & CodeProps>,
  ) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='code'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  export interface ListProps {
    listStyle?: 'star' | 'dash' | 'plus' | 'decimal' | 'latin';
  }

  export const ListContext = React.createContext<ListProps | undefined>(undefined);
  export const ListItemIndexContext = React.createContext<number>(0);

  export const List = component('Markup.List')((
    props: React.PropsWithChildren<PropsMarkupBase & ListProps & ParagraphProps>,
  ) => {
    const { children, listStyle = 'dash', ...others } = props;
    if (!['star', 'dash', 'plus', 'decimal', 'latin'].includes(listStyle)) {
      throw ReadError.fromProps(`Invalid list style: ${listStyle}`, others);
    }
    return <Markup.Environment {...others}>{irElement('list', { listStyle, ...others }, children)}</Markup.Environment>;
  });

  export const ListItem = component('Markup.ListItem')((
    props: React.PropsWithChildren<PropsMarkupBase & ParagraphProps>,
  ) => {
    const { children, ...others } = props;
    return irElement('item', { ...others }, children);
  });

  export const TableContainer = component('Markup.TableContainer')((
    props: React.PropsWithChildren<PropsMarkupBase & ParagraphProps>,
  ) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='table'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  export const TableHead = component('Markup.TableHead')((props: React.PropsWithChildren<PropsMarkupBase>) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='thead'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  export const TableBody = component('Markup.TableBody')((props: React.PropsWithChildren<PropsMarkupBase>) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='tbody'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  export const TableRow = component('Markup.TableRow')((props: React.PropsWithChildren<PropsMarkupBase>) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='trow'>
        {children}
      </SimpleMarkupComponent>
    );
  });

  export const TableCell = component('Markup.TableCell')((props: React.PropsWithChildren<PropsMarkupBase>) => {
    const { children, ...others } = props;
    return (
      <SimpleMarkupComponent {...others} tagName='tcell'>
        {children}
      </SimpleMarkupComponent>
    );
  });
}

export namespace Serialize {
  /**
   * Encloses a serialize component.
   * It becomes transparent when already in a serialized environment.
   *
   * When environment exists, the writer does things to render the environment.
   * How environment handles its child elements is very similar to the Any component,
   * except when the environment only contains a single element, in which case it will be directly returned
   * if it's unnamed.
   */
  export const Environment = component('Serialize.Environment')((
    props: React.PropsWithChildren<PropsSerializeBase & InlineProps>,
  ) => {
    const parentPresentation = React.useContext(PresentationApproach);

    // presentation is extracted but not used here. We are already in serialize mode.
    // The env IR element only accepts a limited subset. Make sure others is not used here.
    let {
      presentation,
      serializer,
      children,
      originalStartIndex,
      originalEndIndex,
      writerOptions,
      sourcePath,
      inline,
      ...others
    } = props;

    if (!serializer) {
      if (parentPresentation?.presentation === 'serialize') {
        serializer = (parentPresentation as PropsSerializeBase).serializer;
      } else {
        serializer = DefaultSerializer;
      }
    }

    let elem =
      parentPresentation?.presentation === 'serialize' &&
      parentPresentation?.serializer === serializer &&
      (!writerOptions || parentPresentation?.writerOptions === writerOptions) ? (
        <>{children}</>
      ) : (
        irElement(
          'env',
          {
            presentation: 'serialize',
            serializer,
            originalStartIndex,
            originalEndIndex,
            writerOptions,
            sourcePath,
          },
          <PresentationApproach.Provider
            value={{
              presentation: 'serialize',
              serializer: serializer,
              writerOptions: writerOptions,
            }}>
            {trimChildrenWhiteSpace(children, props)}
          </PresentationApproach.Provider>,
        )
      );
    if (parentPresentation?.presentation === 'markup') {
      // If the parent is in markup mode, we need a wrapper (e.g., ```json...```).
      // Support inline rendering when requested; default remains block fence.
      elem = (
        <Markup.EncloseSerialize inline={inline ?? false} lang={serializer} {...others}>
          {elem}
        </Markup.EncloseSerialize>
      );
    }
    return elem;
  });

  export interface AnyProps {
    name?: string; // using name because key is reserved in react.
    type?: AnyValue;
  }

  /**
   * Value is a single value or (usually) a pair of key and value. The behavior is as follows:
   * 1. If the inner children are one single text element, it renders as a single value with the specified type.
   * 2. Otherwise, it can be either a list or an object depending on its children.
   *
   * Detailed implementation might differ between different writers, but generally:
   * 1. When the children contain all named values and type is not array, it presents as an object.
   * 2. When the children contain unnamed values, it presents as a list.
   * 3. When the children contain multiple elements including text elements, they are concatenated into a list.
   */
  export const Any = component('Serialize.Any')((props: React.PropsWithChildren<AnyProps & PropsSerializeBase>) => {
    const { name, type, children, ...others } = props;
    const attrs: { [key: string]: any } = {};
    if (name !== undefined) {
      attrs.name = name;
    }
    if (type === undefined) {
      if (typeof children === 'string') {
        attrs.type = 'string';
      } else if (typeof children === 'number') {
        attrs.type = Number.isInteger(children) ? 'integer' : 'float';
      } else if (typeof children === 'boolean') {
        attrs.type = 'boolean';
      } else if (children === null || children === undefined) {
        attrs.type = 'null';
      }
    } else {
      attrs.type = type;
    }
    return (
      <Serialize.Environment {...others}>{irElement('any', { name, type, ...others }, children)}</Serialize.Environment>
    );
  });

  export interface ObjectProps {
    data: any;
  }

  // Object is to quickly insert an external data into the current document.
  export const Object = component('Serialize.Object')((
    props: React.PropsWithChildren<ObjectProps & PropsSerializeBase>,
  ) => {
    const { data, ...others } = props;

    return (
      <Serialize.Environment {...others}>
        {irElement('obj', { data: JSON.stringify(data), ...others })}
      </Serialize.Environment>
    );
  });
}

export namespace Free {
  /**
   * The free environment marks the content as free-form text,
   * which will be kept as is without any processing.
   */
  export const Environment = component('Free.Environment')((
    props: React.PropsWithChildren<PropsFreeBase & InlineProps>,
  ) => {
    const parentPresentation = React.useContext(PresentationApproach);

    // presentation is extracted but not used here. We are already in serialize mode.
    // The env IR element only accepts a limited subset. Make sure others is not used here.
    const {
      presentation,
      children,
      originalStartIndex,
      originalEndIndex,
      writerOptions,
      sourcePath,
      whiteSpace = 'pre',
      inline,
      ...others
    } = props;

    let elem =
      parentPresentation?.presentation === 'free' &&
      (!writerOptions || parentPresentation?.writerOptions === writerOptions) ? (
        <>{children}</>
      ) : (
        irElement(
          'env',
          { presentation: 'free', originalStartIndex, originalEndIndex, writerOptions, whiteSpace, sourcePath },
          <PresentationApproach.Provider
            value={{
              presentation: 'free',
              writerOptions: writerOptions,
            }}>
            {trimChildrenWhiteSpace(children, { ...props, whiteSpace })}
          </PresentationApproach.Provider>,
        )
      );
    if (parentPresentation?.presentation === 'markup') {
      // If the parent is in markup mode, we need a wrapper (e.g., ```...```).
      // Support inline rendering when requested; default remains block fence.
      elem = (
        <Markup.EncloseSerialize inline={inline ?? false} {...others}>
          {elem}
        </Markup.EncloseSerialize>
      );
    } else if (parentPresentation?.presentation === 'serialize') {
      // Make it a string
      elem = <Serialize.Any {...others}>{elem}</Serialize.Any>;
    }
    return elem;
  });

  // This exists only because sometimes we needs to set attributes on free text.
  // For example, class names and speakers.
  export const Text = component('Free.Text')((props: React.PropsWithChildren<PropsFreeBase>) => {
    const { children, whiteSpace = 'pre', ...others } = props;
    return (
      <Free.Environment whiteSpace={whiteSpace} {...others}>
        {irElement('text', { whiteSpace, ...others }, children)}
      </Free.Environment>
    );
  });
}

export namespace MultiMedia {
  export interface ImageProps {
    type?: string; // image/png, image/jpeg, etc.
    base64?: string; // Used for models that does support image.
    alt?: string; // Used for models that does not support image.
    position?: Position; // Only applicable when the image is shown as image (not as text).
  }

  export interface AudioProps {
    type?: string; // audio/mpeg, audio/wav, etc.
    base64?: string; // Used for models that does support audio.
    alt?: string; // Used for models that does not support audio.
    position?: Position; // Only applicable when the audio is shown as audio (not as text).
  }

  export const Environment = component('MultiMedia.Environment')((
    props: React.PropsWithChildren<PropsMultiMediaBase>,
  ) => {
    const parentPresentation = React.useContext(PresentationApproach);

    const { presentation, children, originalStartIndex, originalEndIndex, writerOptions, sourcePath, ...others } =
      props;

    return parentPresentation?.presentation === 'multimedia' &&
      (!writerOptions || parentPresentation?.writerOptions === writerOptions) ? (
      <>{children}</>
    ) : (
      irElement(
        'env',
        { presentation: 'multimedia', originalStartIndex, originalEndIndex, writerOptions, sourcePath },
        <PresentationApproach.Provider
          value={{
            presentation: 'multimedia',
            writerOptions: writerOptions,
          }}>
          {trimChildrenWhiteSpace(children, props)}
        </PresentationApproach.Provider>,
      )
    );
  });

  export const Image = component('MultiMedia.Image')((props: PropsMultiMediaBase & ImageProps) => {
    const { ...others } = props;
    return <MultiMedia.Environment {...others}>{irElement('img', { ...others })}</MultiMedia.Environment>;
  });

  export const Audio = component('MultiMedia.Audio')((props: PropsMultiMediaBase & AudioProps) => {
    const { ...others } = props;
    return <MultiMedia.Environment {...others}>{irElement('audio', { ...others })}</MultiMedia.Environment>;
  });

  export interface ToolRequestProps {
    id: string;
    name: string;
    parameters: any;
  }

  export interface ToolResponseProps {
    id: string;
    name: string;
  }

  export const ToolRequest = component('MultiMedia.ToolRequest')((props: PropsMultiMediaBase & ToolRequestProps) => {
    const { id, name, parameters, ...others } = props;
    return (
      <MultiMedia.Environment {...others}>
        {irElement('toolrequest', { id, name, content: parameters, ...others })}
      </MultiMedia.Environment>
    );
  });

  export const ToolResponse = component('MultiMedia.ToolResponse')((
    props: React.PropsWithChildren<PropsMultiMediaBase & ToolResponseProps>,
  ) => {
    const { id, name, children, ...others } = props;
    return (
      <MultiMedia.Environment {...others}>
        {irElement('toolresponse', { id, name, ...others }, children)}
      </MultiMedia.Environment>
    );
  });
}
