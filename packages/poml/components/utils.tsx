import * as React from 'react';
import { component, ReadError, trimChildrenWhiteSpace } from 'poml/base';
import {
  PropsSyntaxAny,
  Text,
  Paragraph,
  Header,
  Bold,
  computeSyntaxContext,
  SubContent,
  Newline,
  Inline,
} from 'poml/essentials';

export interface BaseCaptionedParagraphProps extends PropsSyntaxAny {
  captionSerialized?: string;
  captionStyle?: 'header' | 'bold' | 'plain' | 'hidden';
  captionTextTransform?: 'upper' | 'lower' | 'capitalize' | 'none';
  captionEnding?: 'colon' | 'newline' | 'colon-newline' | 'none';
  captionTailingSpace?: boolean;
}

interface CaptionedParagraphProps extends BaseCaptionedParagraphProps {
  caption: string;
}

// Helper components for caption text.
// Try not to use it in syntaxes other than markup.
const CaptionText = component('CaptionText')((props: CaptionedParagraphProps) => {
  const { caption, captionTextTransform = 'none', captionStyle = 'header', captionEnding, ...others } = props;
  let captionText = caption;
  switch (captionTextTransform) {
    case 'upper':
      captionText = captionText.toUpperCase();
      break;
    case 'lower':
      captionText = captionText.toLowerCase();
      break;
    case 'capitalize':
      captionText = captionText.length >= 1 ? captionText.charAt(0).toUpperCase() + captionText.slice(1) : captionText;
      break;
    case 'none':
      break;
    default:
      throw ReadError.fromProps(`Unsupported caption text transform: ${captionTextTransform}`, others);
  }
  const computedCaptionEnding =
    captionEnding === undefined
      ? captionStyle === 'bold' || captionStyle === 'plain'
        ? 'colon'
        : 'none'
      : captionEnding;
  if (computedCaptionEnding.includes('colon')) {
    return <>{captionText}:</>;
  } else {
    return <>{captionText}</>;
  }
});

export const Caption = component('Caption', {
  requiredProps: ['caption'],
})((props: CaptionedParagraphProps) => {
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    const { caption, captionStyle = 'header', captionEnding, captionTailingSpace, ...others } = props;
    if (captionStyle === 'header') {
      return (
        <Header {...others}>
          <CaptionText caption={caption} captionStyle={captionStyle} captionEnding={captionEnding} {...others} />
        </Header>
      );
    } else if (captionStyle === 'bold') {
      const result = (
        <Bold {...others}>
          <CaptionText caption={caption} captionStyle={captionStyle} captionEnding={captionEnding} {...others} />
        </Bold>
      );
      if (captionTailingSpace === undefined || captionTailingSpace) {
        if (captionEnding?.includes('newline')) {
          return (
            <>
              {result}
              <Newline />
            </>
          );
        } else {
          return <>{result} </>;
        }
      } else {
        return result;
      }
    } else if (captionStyle === 'plain') {
      const result = (
        <Inline>
          <CaptionText caption={caption} captionStyle={captionStyle} captionEnding={captionEnding} {...others} />
        </Inline>
      );
      if (captionTailingSpace === undefined || captionTailingSpace) {
        if (captionEnding?.includes('newline')) {
          return (
            <>
              {result}
              <Newline />
            </>
          );
        } else {
          return <>{result} </>;
        }
      } else {
        return result;
      }
    } else {
      return null;
    }
  } else {
    // this should seldom happen
    const { caption, captionSerialized, name, type, ...others } = props;
    if (presentation === 'serialize') {
      return (
        <Text name={name} type={type} {...others}>
          {captionSerialized}
        </Text>
      );
    } else {
      return <Text>{caption}</Text>;
    }
  }
});

/**
 * CaptionedParagraph (`<cp>` for short) creates a paragraph with a customized caption title.
 *
 * @param caption - The title or label for the paragraph. Required.
 * @param captionSerialized - The serialized version of the caption when using "serializer" syntaxes.
 *   By default, it's same as `caption`.
 * @param {'header'|'bold'|'plain'|'hidden'} captionStyle - Determines the style of the caption,
 * applicable only for "markup" syntaxes. Default is `header`.
 * @param {'upper'|'level'|'capitalize'|'none'} captionTextTransform -
 * Specifies text transformation for the caption, applicable only for "markup" syntaxes. Default is `none`.
 * @param {'colon'|'newline'|'colon-newline'|'none'} captionEnding - A caption can ends with a colon, a newline or simply nothing.
 * If not specified, it defaults to `colon` for `bold` or `plain` captionStyle, and `none` otherwise.
 *
 * @see {@link Paragraph} for other props available.
 *
 * @example
 * ```xml
 * <cp caption="Constraints">
 *   <list>
 *     <item>Do not exceed 1000 tokens.</item>
 *     <item>Please use simple words.</item>
 *   </list>
 * </cp>
 * ```
 */
export const CaptionedParagraph = component('CaptionedParagraph', {
  aliases: ['cp'],
  requiredProps: ['caption'],
})((props: React.PropsWithChildren<CaptionedParagraphProps>) => {
  const presentation = computeSyntaxContext(props);
  if (presentation === 'markup') {
    const { captionStyle = 'header', children, ...others } = props;
    const trimmedChildren = trimChildrenWhiteSpace(children, props);
    const hasContent = React.Children.count(trimmedChildren) > 0;
    if (captionStyle === 'header') {
      return (
        <Paragraph {...others}>
          <Caption captionStyle={captionStyle} captionTailingSpace={hasContent} {...others} />
          <SubContent>{trimmedChildren}</SubContent>
        </Paragraph>
      );
    } else if (captionStyle === 'bold' || captionStyle === 'plain') {
      return (
        <Paragraph {...others}>
          <Caption captionStyle={captionStyle} captionTailingSpace={hasContent} {...others} />
          {trimmedChildren}
        </Paragraph>
      );
    } else if (captionStyle === 'hidden') {
      return <Paragraph {...others}>{trimmedChildren}</Paragraph>;
    } else {
      throw ReadError.fromProps(`Unsupported caption style: ${captionStyle}`, props);
    }
  } else if (presentation === 'serialize') {
    const { children, captionSerialized, caption, ...others } = props;
    return (
      <Text name={captionSerialized || caption} {...others}>
        {children}
      </Text>
    );
  } else {
    const { children } = props;
    return <Text>{children}</Text>;
  }
});

export const parsePythonStyleSlice = (slice: string, totalLength: number): [number, number] => {
  // slices could be like :3, 3:5, 5:, 5:-1
  if (slice === ':') {
    return [0, totalLength];
  } else if (slice.endsWith(':')) {
    return [parseInt(slice.slice(0, -1)), totalLength];
  } else if (slice.startsWith(':')) {
    return [0, parseInt(slice.slice(1))];
  } else if (slice.includes(':')) {
    const [start, end] = slice.split(':').map(Number);
    return [start, end];
  } else {
    const index = parseInt(slice);
    return [index, index + 1];
  }
};
