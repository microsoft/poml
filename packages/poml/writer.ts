import * as cheerio from 'cheerio';
import * as xmlbuilder from 'xmlbuilder2';

import {
  ErrorCollection,
  Speaker,
  Message,
  SystemError,
  ValidSpeakers,
  WriteError,
  ContentMultiMedia,
  RichContent,
  SourceMapRichContent,
  SourceMapMessage,
  richContentFromSourceMap,
} from './base';
import { Position } from './presentation';
import yaml from 'js-yaml';
import { encodingForModel, Tiktoken } from 'js-tiktoken';

// Use the special character to indicate a placeholder for multimedia.
const SPECIAL_CHARACTER = 'À';

// Position indicates the targetted position of the multimedia.
// Index indicates the place it's currently at, which must be a special character.
type PositionalContentMultiMedia = ContentMultiMedia & { position: Position; index: number };

// This is a workaround with tsdoc
type StringTableRow = string[];

interface MappingNode {
  originalStart?: number; // Original start index in the input source code
  originalEnd?: number; // Original end index in the input source code
  inputStart: number; // Start index in the IR
  inputEnd: number; // End index in the IR
  outputStart: number;
  outputEnd: number;
}

interface SpeakerNode {
  start: number;
  end: number;
  speaker: Speaker;
}

interface WriterPartialResult {
  output: string;
  multimedia: PositionalContentMultiMedia[];
  mappings: MappingNode[];
}

interface WriterResult {
  input: string;
  output: string;
  multimedia: PositionalContentMultiMedia[];
  mappings: MappingNode[];
  speakers: SpeakerNode[];
}

interface SourceSegment {
  outStart: number;
  outEnd: number;
  irStart: number;
  irEnd: number;
  inputStart: number;
  inputEnd: number;
  content: RichContent;
}

class Writer<WriterOptions> {
  protected ir: string = '';
  protected options: WriterOptions;
  protected tokenizerCache: { [model: string]: Tiktoken } = {};

  constructor(ir?: string, options?: WriterOptions) {
    if (ir) {
      this.reset(ir);
    }
    this.options = this.initializeOptions(options);
  }

  protected initializeOptions(options?: WriterOptions): WriterOptions {
    return options || ({} as WriterOptions);
  }

  protected reset(ir: string): void {
    this.ir = ir;
  }

  protected truncateText(text: string, charLimit?: number, tokenLimit?: number, options?: TruncateOptions): string {
    const {
      truncateMarker = ' (...truncated)',
      truncateDirection = 'end',
      tokenEncodingModel = 'gpt-4o',
    } = options || (this.options as any);
    let truncated = text;
    let changed = false;

    if (charLimit !== undefined && truncated.length > charLimit) {
      changed = true;
      if (truncateDirection === 'start') {
        truncated = truncated.slice(truncated.length - charLimit);
      } else if (truncateDirection === 'middle') {
        const head = Math.ceil(charLimit / 2);
        const tail = charLimit - head;
        truncated = truncated.slice(0, head) + truncated.slice(truncated.length - tail);
      } else {
        truncated = truncated.slice(0, charLimit);
      }
    }

    if (tokenLimit !== undefined) {
      // Optimization: Check byte count first to potentially bypass tokenizer loading
      // Since tokens are typically at least 1 byte, if byte count < token limit, we're safe
      const byteCount = Buffer.byteLength(truncated, 'utf8');
      if (byteCount <= tokenLimit) {
        // Byte count is within limit, so token count must also be within limit
        // Skip expensive tokenizer loading and encoding
      } else {
        let enc = this.tokenizerCache[tokenEncodingModel];
        if (!enc) {
          enc = encodingForModel(tokenEncodingModel as any);
          this.tokenizerCache[tokenEncodingModel] = enc;
        }
        const tokens = enc.encode(truncated);
        if (tokens.length > tokenLimit) {
          changed = true;
          if (truncateDirection === 'start') {
            truncated = enc.decode(tokens.slice(tokens.length - tokenLimit));
          } else if (truncateDirection === 'middle') {
            const head = Math.ceil(tokenLimit / 2);
            const tail = tokenLimit - head;
            truncated = enc.decode(tokens.slice(0, head).concat(tokens.slice(tokens.length - tail)));
          } else {
            truncated = enc.decode(tokens.slice(0, tokenLimit));
          }
        }
      }
    }

    if (!changed) {
      return text;
    }
    if (truncateDirection === 'start') {
      return truncateMarker + truncated;
    } else if (truncateDirection === 'middle') {
      const mid = Math.ceil(truncated.length / 2);
      return truncated.slice(0, mid) + truncateMarker + truncated.slice(mid);
    } else {
      return truncated + truncateMarker;
    }
  }

  protected createMappingNode(element: cheerio.Cheerio<any>, outputLength: number): MappingNode {
    const parseAttrAsInt = (attrName: string): number | undefined => {
      const attrValue = element.attr(attrName);
      return attrValue !== undefined && !isNaN(parseInt(attrValue, 10)) ? parseInt(attrValue, 10) : undefined;
    };

    return {
      originalStart: parseAttrAsInt('original-start-index'),
      originalEnd: parseAttrAsInt('original-end-index'),
      inputStart: element[0].startIndex,
      inputEnd: element[0].endIndex,
      outputStart: 0,
      outputEnd: outputLength - 1,
    };
  }

  /**
   * Add an offset to mapping nodes.
   *
   * @param mappings - Original mappings.
   * @param indent - The offset amount.
   * @param ignoreBefore - Ignore the mappings before this index.
   * @returns - The new mappings.
   */
  protected indentMappings(mappings: MappingNode[], indent: number, ignoreBefore: number): MappingNode[] {
    return mappings.map((mapping) => {
      return {
        ...mapping,
        outputStart: mapping.outputStart >= ignoreBefore ? mapping.outputStart + indent : mapping.outputStart,
        outputEnd: mapping.outputStart >= ignoreBefore ? mapping.outputEnd + indent : mapping.outputEnd,
      };
    });
  }

  protected indentMultiMedia(
    multimedia: PositionalContentMultiMedia[],
    indent: number,
    ignoreBefore: number,
  ): PositionalContentMultiMedia[] {
    return multimedia.map((media) => {
      return {
        ...media,
        index: media.index >= ignoreBefore ? media.index + indent : media.index,
      };
    });
  }

  protected raiseError(message: string, element: cheerio.Cheerio<any>): WriterPartialResult {
    const parseAttrAsInt = (attrName: string): number | undefined => {
      const attrValue = element.attr(attrName);
      return attrValue !== undefined && !isNaN(parseInt(attrValue, 10)) ? parseInt(attrValue, 10) : undefined;
    };
    const emptyOutput = {
      output: '',
      multimedia: [],
      mappings: [],
    };

    if (element.length === 0) {
      // Ignore the error if the element is not even ready
      return emptyOutput;
    }

    ErrorCollection.add(
      new WriteError(
        message,
        parseAttrAsInt('original-start-index'),
        parseAttrAsInt('original-end-index'),
        element[0].sourcePath,
        element[0].startIndex,
        element[0].endIndex,
        this.ir,
      ),
    );
    return emptyOutput;
  }

  public writeElementTree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    throw new SystemError('Method not implemented.');
  }

  /**
   * Convert an IR string into {@link RichContent} without exposing mapping information.
   *
   * The method delegates to {@link writeWithSourceMap} and then collapses the
   * returned segments back into a single rich content value.
   */
  public write(ir: string): RichContent {
    const segments = this.writeWithSourceMap(ir);
    return richContentFromSourceMap(segments);
  }

  /**
   * Convert an IR string into an array of speaker messages.
   *
   * It internally uses {@link writeMessagesWithSourceMap} and removes the
   * mapping information from each message.
   */
  public writeMessages(ir: string): Message[] {
    const messages = this.writeMessagesWithSourceMap(ir);
    return messages.map((m) => ({
      speaker: m.speaker,
      content: richContentFromSourceMap(m.content),
    }));
  }

  public assignSpeakers(result: WriterPartialResult, $: cheerio.CheerioAPI): SpeakerNode[] {
    const speakers: SpeakerNode[] = [];
    let defaultSpeaker: Speaker = 'system';
    let systemSpeakerSpecified: boolean = false;
    const segments: SpeakerNode[] = [];

    const querySegmentFromMapping = (startIndex: number, endIndex: number) => {
      return result.mappings.find((segment) => segment.inputStart === startIndex && segment.inputEnd === endIndex);
    };

    const getSpecifiedSpeaker = (element: cheerio.Cheerio<any>) => {
      const speaker = element.attr('speaker') as Speaker | undefined;
      if (speaker && !ValidSpeakers.includes(speaker)) {
        this.raiseError(`"${speaker}" is not a valid speaker.`, element);
        return undefined;
      }
      return speaker;
    };

    const assignSpeakerForElement = (element: cheerio.Cheerio<any>, inheritedSpeaker: Speaker | undefined) => {
      let specifiedSpeaker = getSpecifiedSpeaker(element);
      if (specifiedSpeaker === 'system') {
        systemSpeakerSpecified = true;
      }
      // When human has appeared, the default speaker becomes human.
      if (specifiedSpeaker == 'human' && defaultSpeaker == 'system') {
        defaultSpeaker = 'human';
      }

      if (element.length === 0) {
        return;
      }

      const segment = querySegmentFromMapping(element[0].startIndex, element[0].endIndex);
      if (specifiedSpeaker && !segment) {
        console.warn(`Speaker is specified but no exact corresponding output can be found in ${element.html()}`);
      }
      const speaker = specifiedSpeaker || inheritedSpeaker || defaultSpeaker;

      if (segment) {
        segments.push({ start: segment.outputStart, end: segment.outputEnd, speaker });
      }

      if (specifiedSpeaker) {
        inheritedSpeaker = specifiedSpeaker;
      }

      element.children().each((_, child) => {
        const speaker = getSpecifiedSpeaker($(child));
        if (speaker) {
          inheritedSpeaker = speaker;
        }
        assignSpeakerForElement($(child), inheritedSpeaker);
      });
    };

    assignSpeakerForElement(this.getRoot($), undefined);

    const allIndicesSet = new Set<number>();
    segments.forEach((segment) => {
      allIndicesSet.add(segment.start);
      allIndicesSet.add(segment.end);
    });
    const essentialIndices = Array.from(allIndicesSet).sort((a, b) => a - b);
    const colorSpeakers: Speaker[] = new Array(essentialIndices.length).fill('system');
    segments.forEach((segment) => {
      const startIndex = essentialIndices.findIndex((index) => index == segment.start);
      const endIndex = essentialIndices.findIndex((index) => index == segment.end);
      for (let i = startIndex; i <= endIndex; i++) {
        colorSpeakers[i] = segment.speaker;
      }
    });
    let currentStart: number | undefined = undefined;
    for (let i = 0; i < essentialIndices.length; i++) {
      const speaker = colorSpeakers[i];
      if (i === 0 || (i > 0 && speaker !== colorSpeakers[i - 1])) {
        currentStart = essentialIndices[i];
      }
      if (i === essentialIndices.length - 1 || (i < essentialIndices.length - 1 && speaker !== colorSpeakers[i + 1])) {
        // time to end this segment
        if (currentStart === undefined) {
          throw new SystemError('currentStart is not expected to be undefined');
        }
        speakers.push({ start: currentStart, end: essentialIndices[i], speaker: speaker });
      }
    }

    // If there's only one speaker and it's system, change it to human.
    if (speakers.length == 1 && speakers[0].speaker == 'system' && !systemSpeakerSpecified) {
      speakers[0].speaker = 'human';
    }

    return speakers;
  }

  /**
   * Render the IR string and return detailed mapping for each produced content
   * segment.
   *
   * Each returned {@link SourceMapRichContent} describes the slice of the input
   * IR that generated the piece of output.
   */
  public writeWithSourceMap(ir: string): SourceMapRichContent[] {
    const result = this.generateWriterResult(ir);
    const segments = this.buildSourceMap(result);
    return segments.map((s) => ({
      startIndex: s.inputStart,
      endIndex: s.inputEnd,
      irStartIndex: s.irStart,
      irEndIndex: s.irEnd,
      content: s.content,
    }));
  }

  /**
   * Similar to {@link writeWithSourceMap} but groups the segments into speaker
   * messages.
   */
  public writeMessagesWithSourceMap(ir: string): SourceMapMessage[] {
    const result = this.generateWriterResult(ir);
    const segments = this.buildSourceMap(result);
    return result.speakers
      .map((sp) => {
        const msgSegs = segments.filter((seg) => seg.outStart >= sp.start && seg.outEnd <= sp.end);
        const nonWs = msgSegs.filter((seg) => !(typeof seg.content === 'string' && seg.content.trim() === ''));
        // Use only non-whitespace segments when computing the overall source range
        // for this message so that trailing or leading padding does not expand the
        // reported span. If the message contains nothing but whitespace we fall
        // back to considering all segments.
        const relevant = nonWs.length ? nonWs : msgSegs;
        if (!relevant.length) {
          // If there are no relevant segments, we cannot produce an empty message.
          return {
            startIndex: 0, // in this case, we cannot determine the start index
            endIndex: 0,
            irStartIndex: 0,
            irEndIndex: 0,
            speaker: sp.speaker,
            content: [],
          };
        }
        return {
          startIndex: Math.min(...relevant.map((seg) => seg.inputStart)),
          endIndex: Math.max(...relevant.map((seg) => seg.inputEnd)),
          irStartIndex: Math.min(...relevant.map((seg) => seg.irStart)),
          irEndIndex: Math.max(...relevant.map((seg) => seg.irEnd)),
          speaker: sp.speaker,
          content: msgSegs.map((seg) => ({
            startIndex: seg.inputStart,
            endIndex: seg.inputEnd,
            irStartIndex: seg.irStart,
            irEndIndex: seg.irEnd,
            content: seg.content,
          })),
        };
      })
      .filter((msg) => msg !== undefined);
  }

  /**
   * Transform a {@link WriterResult} into discrete source map segments.
   *
   * The segments are ordered so that rich content can be reconstructed in
   * the correct visual order while preserving multimedia positioning.
   */
  protected buildSourceMap(result: WriterResult): SourceSegment[] {
    // Collect every boundary within the output that could signify a change in
    // source location.  These come from the input/output mappings as well as
    // multimedia positions.  Splitting the output on these boundaries ensures
    // each segment corresponds to a single source range.
    const boundaries = new Set<number>();
    result.mappings.forEach((m) => {
      boundaries.add(m.outputStart);
      boundaries.add(m.outputEnd + 1);
    });
    result.multimedia.forEach((m) => {
      boundaries.add(m.index);
      boundaries.add(m.index + 1);
    });
    boundaries.add(0);
    boundaries.add(result.output.length);
    const points = Array.from(boundaries).sort((a, b) => a - b);

    // `top` multimedia should appear before all textual content while `bottom`
    // multimedia should come last.  We therefore keep three buckets and merge
    // them at the end.
    const topSegments: SourceSegment[] = [];
    const middleSegments: SourceSegment[] = [];
    const bottomSegments: SourceSegment[] = [];

    const originalStartIndices = result.mappings.map((m) => m.originalStart).filter((m) => m !== undefined);
    const sourceStartIndex = originalStartIndices.length > 0 ? Math.min(...originalStartIndices) : 0;
    const originalEndIndices = result.mappings.map((m) => m.originalEnd).filter((m) => m !== undefined);
    const sourceEndIndex = originalEndIndices.length > 0 ? Math.max(...originalEndIndices) : 0;

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      if (start >= end) {
        continue;
      }
      const slice = result.output.slice(start, end);

      // Find the most specific mapping that covers this slice.  This allows the
      // resulting segment to map back to the tightest IR range responsible for
      // the output.
      let chosen: MappingNode | undefined;

      // The chosen IR might not have a precise original start or end index, so we
      // choose a fallback based on the original mappings.
      let chosenOriginal: MappingNode | undefined;

      for (const m of result.mappings) {
        if (start >= m.outputStart && end - 1 <= m.outputEnd) {
          if (!chosen || m.outputEnd - m.outputStart < chosen.outputEnd - chosen.outputStart) {
            chosen = m;
          }
          if (
            m.originalStart !== undefined &&
            m.originalEnd !== undefined &&
            (!chosenOriginal ||
              m.originalEnd - m.originalStart < chosenOriginal.originalEnd! - chosenOriginal.originalStart!)
          ) {
            chosenOriginal = m;
          }
        }
      }
      if (!chosen) {
        // Mappings must be non-empty here because the points are derived from the
        // mappings. If we cannot find a mapping, use the first one as a fallback.
        chosen = result.mappings[0];
      }

      // If a multimedia item starts at this boundary, emit it instead of text.
      const media = result.multimedia.find((m) => m.index === start);
      if (media) {
        const { position, index, ...rest } = media;
        const segment: SourceSegment = {
          outStart: start,
          outEnd: end - 1,
          irStart: chosen.inputStart,
          irEnd: chosen.inputEnd,
          inputStart: chosenOriginal?.originalStart ?? sourceStartIndex,
          inputEnd: chosenOriginal?.originalEnd ?? sourceEndIndex,
          content: [rest],
        };
        if (position === 'top') {
          topSegments.push(segment);
        } else if (position === 'bottom') {
          bottomSegments.push(segment);
        } else {
          middleSegments.push(segment);
        }
      } else if (slice !== SPECIAL_CHARACTER && slice.length > 0) {
        // Normal textual slice.
        middleSegments.push({
          outStart: start,
          outEnd: end - 1,
          irStart: chosen.inputStart,
          irEnd: chosen.inputEnd,
          inputStart: chosenOriginal?.originalStart ?? sourceStartIndex,
          inputEnd: chosenOriginal?.originalEnd ?? sourceEndIndex,
          content: slice,
        });
      }
    }

    middleSegments.sort((a, b) => a.outStart - b.outStart);
    // Order the buckets so that `top` items are emitted before any textual
    // content and `bottom` items are emitted last. When filtering these
    // segments by speaker boundaries, each top or bottom item still appears
    // within the correct message.
    return [...topSegments, ...middleSegments, ...bottomSegments];
  }

  /**
   * Execute the main writing logic and gather mapping, multimedia and speaker
   * information before it is broken down into smaller segments.
   */
  private generateWriterResult(ir: string): WriterResult {
    this.reset(ir);
    const $ = cheerio.load(
      ir,
      {
        scriptingEnabled: false,
        xml: { xmlMode: true, withStartIndices: true, withEndIndices: true },
      },
      false,
    );
    const partialResult = this.writeElementTree(this.getRoot($), $);
    return {
      input: ir,
      output: partialResult.output,
      mappings: partialResult.mappings,
      multimedia: partialResult.multimedia,
      speakers: this.assignSpeakers(partialResult, $),
    };
  }

  private getRoot($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
    return $($.root().children()[0]);
  }
}

export class EnvironmentDispatcher extends Writer<any> {
  public writeElementTree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    if (element.is('env')) {
      let options: any = undefined;
      try {
        const optionsString = element.attr('writer-options');
        if (optionsString) {
          options = JSON.parse(optionsString);
        }
      } catch (e) {
        this.raiseError(`Invalid JSON for writer-options: ${element.attr('writer-options')}`, element);
      }
      if (element.attr('presentation') === 'markup') {
        const markupLanguage = element.attr('markup-lang') || 'markdown';
        if (markupLanguage === 'markdown') {
          return new MarkdownWriter(this.ir, options).writeElementTree(element, $);
        } else if (markupLanguage === 'html') {
          return new HtmlWriter(this.ir, options).writeElementTree(element, $);
        } else if (markupLanguage === 'csv') {
          return new CsvWriter(this.ir, options).writeElementTree(element, $);
        } else if (markupLanguage === 'tsv') {
          return new TsvWriter(this.ir, options).writeElementTree(element, $);
        } else {
          return this.raiseError(`Invalid markup language: ${markupLanguage}`, element);
        }
      } else if (element.attr('presentation') === 'serialize') {
        const serializer = element.attr('serializer') || 'json';
        if (serializer === 'json') {
          return new JsonWriter(this.ir, options).writeElementTree(element, $);
        } else if (serializer === 'yaml') {
          return new YamlWriter(this.ir, options).writeElementTree(element, $);
        } else if (serializer === 'xml') {
          return new XmlWriter(this.ir, options).writeElementTree(element, $);
        } else {
          return this.raiseError(`Invalid serializer: ${serializer}`, element);
        }
      } else if (element.attr('presentation') === 'free') {
        return new FreeWriter(this.ir, options).writeElementTree(element, $);
      } else if (element.attr('presentation') === 'multimedia') {
        return new MultiMediaWriter(this.ir, options).writeElementTree(element, $);
      } else {
        return this.raiseError(`Invalid presentation: ${element}`, element);
      }
    } else {
      // Not even an environment, consider writing it as a markdown
      return new MarkdownWriter(this.ir).writeElementTree(element, $);
    }
  }
}

/**
 * A box-like structure simualtes HTML-like box model in markdown rendering.
 * The before and after are considered as the margin of the box.
 * They indicates there should be at least "before" element and "after" element
 * before and after the text, and can be shared between consecutive boxes and nested boxes.
 * The mapping is relative to current output section.
 */
interface MarkdownBox {
  text: string;
  before: string;
  after: string;
  mappings: MappingNode[];
  multimedia: PositionalContentMultiMedia[];
  priority?: number;
}

interface TruncateOptions {
  truncateMarker?: string;
  truncateDirection?: 'start' | 'middle' | 'end';
  tokenEncodingModel?: string;
}

interface MarkdownOptions extends TruncateOptions {
  markdownBaseHeaderLevel: number;
  markdownTableCollapse: boolean;

  /* temporarily put csv options here as they used a similar impl */
  csvSeparator: string;
  csvHeader: boolean;
}

export class MarkdownWriter extends Writer<MarkdownOptions> {
  protected initializeOptions(options?: MarkdownOptions | undefined): MarkdownOptions {
    options = options || ({} as MarkdownOptions);
    return {
      markdownBaseHeaderLevel: options.markdownBaseHeaderLevel ?? 1,
      markdownTableCollapse: options.markdownTableCollapse ?? false,
      csvSeparator: options.csvSeparator ?? ',',
      csvHeader: options.csvHeader ?? true,
      truncateMarker: options.truncateMarker ?? ' (...truncated)',
      truncateDirection: options.truncateDirection ?? 'end',
      tokenEncodingModel: options.tokenEncodingModel ?? 'gpt-4o',
    };
  }

  protected raiseErrorAndReturnEmpty(message: string, element: cheerio.Cheerio<any>): MarkdownBox {
    this.raiseError(message, element);
    return { text: '', before: '', after: '', mappings: [], multimedia: [] };
  }

  protected makeBox(
    text: string | MarkdownBox,
    layout: 'block' | 'newline' | 'inline',
    element: cheerio.Cheerio<any>,
  ): MarkdownBox {
    const newBeforeAfter = layout === 'block' ? '\n\n' : layout === 'newline' ? '\n' : '';
    const charLimitAttr = element.attr('char-limit');
    const tokenLimitAttr = element.attr('token-limit');
    const priorityAttr = element.attr('priority');
    const charLimit = charLimitAttr !== undefined ? parseInt(charLimitAttr, 10) : undefined;
    const tokenLimit = tokenLimitAttr !== undefined ? parseInt(tokenLimitAttr, 10) : undefined;
    const priority = priorityAttr !== undefined ? parseFloat(priorityAttr) : undefined;
    if (typeof text === 'string') {
      const truncated = this.truncateText(text, charLimit, tokenLimit, this.options);
      return {
        text: truncated,
        before: newBeforeAfter,
        after: newBeforeAfter,
        mappings: [this.createMappingNode(element, truncated.length)],
        multimedia: [],
        priority,
      };
    } else {
      const combinedText = text.text;
      const truncated = this.truncateText(combinedText, charLimit, tokenLimit, this.options);
      return {
        text: truncated,
        before: this.consolidateSpace(newBeforeAfter, text.before),
        after: this.consolidateSpace(text.after, newBeforeAfter),
        mappings: [...text.mappings, this.createMappingNode(element, truncated.length)],
        multimedia: text.multimedia,
        priority,
      };
    }
  }

  private wrapBox(
    box: MarkdownBox,
    wrapBefore: string,
    wrapAfter: string,
    element?: cheerio.Cheerio<any>,
  ): MarkdownBox {
    const text = wrapBefore + box.text + wrapAfter;
    const mappings = this.indentMappings(box.mappings, wrapBefore.length, 0);
    if (element) {
      mappings.push(this.createMappingNode(element, text.length));
    }
    return {
      text: text,
      before: box.before,
      after: box.after,
      mappings: mappings,
      multimedia: this.indentMultiMedia(box.multimedia, wrapBefore.length, 0),
    };
  }

  private wrapBoxEveryLine(box: MarkdownBox, wrapBefore: string, wrapAfter: string) {
    const lines = box.text.split('\n');
    let accumulatedLength = 0;
    let mappings: MappingNode[] = box.mappings;
    let multimedia: PositionalContentMultiMedia[] = box.multimedia;
    const text = lines
      .map((line) => {
        const result = wrapBefore + line + wrapAfter;
        mappings = this.indentMappings(mappings, wrapBefore.length, accumulatedLength);
        multimedia = this.indentMultiMedia(multimedia, wrapBefore.length, accumulatedLength);
        accumulatedLength += result.length + 1; // length of '\n'
        return result;
      })
      .join('\n');
    return {
      text: text,
      before: box.before,
      after: box.after,
      mappings: mappings,
      multimedia: multimedia,
    };
  }

  private consolidateSpace(space1: string, space2: string) {
    let result = space1 + space2;
    for (let i = 1; i <= Math.min(space1.length, space2.length); i++) {
      if (space1.slice(-i) === space2.slice(0, i)) {
        result = space1 + space2.slice(i);
      }
    }
    return result;
  }

  private reduceBoxesByLimit(boxes: MarkdownBox[], charLimit?: number, tokenLimit?: number): MarkdownBox[] {
    if (boxes.length === 0 || (charLimit === undefined && tokenLimit === undefined)) {
      return boxes;
    }

    const tokenModel = (this.options as any).tokenEncodingModel || 'gpt-4o';
    const getTokenLength = (t: string) => {
      if (tokenLimit === undefined) {
        return 0;
      }
      // Optimization: Use byte count as conservative estimate before tokenizing
      const byteCount = Buffer.byteLength(t, 'utf8');
      const BYTES_PER_TOKEN_ESTIMATE = 4;
      // If byte count is small enough, we can estimate it's within token limits
      // This is a heuristic - for very short strings, byte count ≈ token count
      if (byteCount <= tokenLimit) {
        return Math.ceil(byteCount / BYTES_PER_TOKEN_ESTIMATE); // Conservative estimate
      }

      let enc = this.tokenizerCache[tokenModel];
      if (!enc) {
        enc = encodingForModel(tokenModel as any);
        this.tokenizerCache[tokenModel] = enc;
      }
      return enc.encode(t).length;
    };

    const totalChars = (arr: MarkdownBox[]) => arr.reduce((a, b) => a + b.text.length, 0);
    const totalTokens = (arr: MarkdownBox[]) => arr.reduce((a, b) => a + getTokenLength(b.text), 0);
    let current = [...boxes];
    while (current.length > 0) {
      const exceeds =
        (charLimit !== undefined && totalChars(current) > charLimit) ||
        (tokenLimit !== undefined && totalTokens(current) > tokenLimit);
      if (!exceeds) {
        break;
      }
      const priorities = current.map((b) => b.priority ?? 0);
      const minP = Math.min(...priorities);
      if (current.every((b) => (b.priority ?? 0) === minP)) {
        break;
      }
      current = current.filter((b) => (b.priority ?? 0) !== minP);
    }

    return current;
  }

  private concatMarkdownBoxes(boxes: MarkdownBox[], element?: cheerio.Cheerio<any>): MarkdownBox {
    const charLimitAttr = element?.attr('char-limit');
    const tokenLimitAttr = element?.attr('token-limit');
    const charLimit = charLimitAttr !== undefined ? parseInt(charLimitAttr, 10) : undefined;
    const tokenLimit = tokenLimitAttr !== undefined ? parseInt(tokenLimitAttr, 10) : undefined;
    const multimedia: PositionalContentMultiMedia[] = [];

    // Remove all spaces children before and after block elements
    // or between two multimedia-only nodes so images do not create
    // stray blank lines when placed consecutively.
    let removedSpace = boxes;

    while (true) {
      let afterRemoveSpace = removedSpace.filter((child, i) => {
        const afterBlock =
          i > 0 && (removedSpace[i - 1].after.includes('\n') || /^\n+$/.test(removedSpace[i - 1].text));
        const beforeBlock =
          i < removedSpace.length - 1 &&
          (removedSpace[i + 1].before.includes('\n') || /^\n+$/.test(removedSpace[i + 1].text));
        // When a whitespace-only box is sandwiched between two multimedia
        // boxes (e.g., two consecutive images), we treat it like the spaces
        // around a block element so it doesn't generate a blank line.
        const afterMedia =
          i > 0 &&
          removedSpace[i - 1].multimedia.length > 0 &&
          removedSpace[i - 1].multimedia.length === removedSpace[i - 1].text.length;
        const beforeMedia =
          i < removedSpace.length - 1 &&
          removedSpace[i + 1].multimedia.length > 0 &&
          removedSpace[i + 1].multimedia.length === removedSpace[i + 1].text.length;
        return !((afterBlock || beforeBlock || afterMedia || beforeMedia) && /^[ \t]*$/.test(child.text));
      });
      if (afterRemoveSpace.length === removedSpace.length) {
        break;
      }
      // Repeat until no more space can be removed
      removedSpace = afterRemoveSpace;
    }

    removedSpace = this.reduceBoxesByLimit(removedSpace, charLimit, tokenLimit);

    // When concatenating, we handle 3 cases.
    // 1. If both ends are text, the same space characters will be overlapped and consolidated.
    // 2. If one end is text and the other end is multimedia (floated), the multimedia will be as if it doesn't exist.
    //    This case is only handled when it only contains multimedia. If there's text in between, we assume it's already handled.
    // 3. If one end is text and the other end is multimedia (adhered), the multimedia will eat up the space characters.

    const enumerate = (boxes: MarkdownBox[]) => {
      return boxes.map((box, i) => {
        return { box, index: i };
      });
    };

    // See the comment above for the explanation.
    const asIfNotExist = (box: MarkdownBox): boolean => {
      return (
        box.multimedia.length > 0 &&
        box.multimedia.length === box.text.length &&
        box.multimedia.every((media) => media.position !== 'here')
      );
    };

    const textBoxQueue = enumerate(removedSpace).filter(({ box }) => !asIfNotExist(box));
    const multimediaQueue = enumerate(removedSpace).filter(({ box }) => asIfNotExist(box));

    const mappings: MappingNode[] = [];

    // When concatenating, make sure all multimedia boxes are skipped.
    // Multimedia boxes are instead directly adhered to the previous box.
    // Kinda like a merge sort.
    let text = '';
    let before = '';
    let after = '';
    let i = 0,
      j = 0;
    while (i < textBoxQueue.length || j < multimediaQueue.length) {
      if (
        i === textBoxQueue.length ||
        (j < multimediaQueue.length && multimediaQueue[j].index < textBoxQueue[i].index)
      ) {
        const multimediaBox = multimediaQueue[j].box;
        mappings.push(...this.indentMappings(multimediaBox.mappings, text.length, 0));
        multimedia.push(...this.indentMultiMedia(multimediaBox.multimedia, text.length, 0));
        text += multimediaBox.text;
        j++;
      } else {
        const box = textBoxQueue[i].box;
        if (i === 0) {
          before = box.before;
        }
        mappings.push(...this.indentMappings(box.mappings, text.length, 0));
        // It still could contain inner multimedia
        multimedia.push(...this.indentMultiMedia(box.multimedia, text.length, 0));
        text += box.text;
        if (i === textBoxQueue.length - 1) {
          after = box.after;
        } else {
          let thisAfter: string;
          if (
            box.multimedia.filter((media) => media.position === 'here' && media.index + 1 === box.text.length).length >
            0
          ) {
            // Has an adhered multimedia at the end
            thisAfter = '';
          } else if (
            textBoxQueue[i + 1].box.multimedia.filter((media) => media.position === 'here' && media.index === 0)
              .length > 0
          ) {
            thisAfter = '';
          } else {
            thisAfter = this.consolidateSpace(box.after, textBoxQueue[i + 1].box.before);
          }
          text += thisAfter;
        }
        i++;
      }
    }

    let finalText = text;
    if (charLimit !== undefined || tokenLimit !== undefined) {
      finalText = this.truncateText(finalText, charLimit, tokenLimit, this.options);
    }

    return { text: finalText, before, after, mappings, multimedia };
  }

  private indentText(text: string, indent: number, firstLineIndent: number) {
    const lines = text.split('\n');
    return lines
      .map((line, i) => {
        if (!line) {
          return line;
        } else if (i === 0) {
          return ' '.repeat(firstLineIndent) + line;
        } else {
          return ' '.repeat(indent) + line;
        }
      })
      .join('\n');
  }

  private handleParagraph = (
    innerParagraphs: MarkdownBox,
    element: cheerio.Cheerio<any>,
    indent?: number,
    firstLineIndent?: number,
    blankLine?: boolean,
  ) => {
    innerParagraphs.text = this.indentText(
      innerParagraphs.text,
      indent ?? 0,
      Math.max(0, (firstLineIndent ?? 0) + (indent ?? 0)),
    );
    if (element.attr('blank-line') === 'true') {
      blankLine = true;
    } else if (element.attr('blank-line') === 'false') {
      blankLine = false;
    }
    if (blankLine || blankLine === undefined) {
      return this.makeBox(innerParagraphs, 'block', element);
    } else {
      return this.makeBox(innerParagraphs, 'newline', element);
    }
  };

  private writeElementTrees(
    elements: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI,
    element?: cheerio.Cheerio<any>,
  ): MarkdownBox {
    const children: MarkdownBox[] = elements
      .toArray()
      .filter((element) => element.type !== 'comment')
      .map((element) => {
        if (element.type === 'text') {
          return { text: element.data, before: '', after: '', mappings: [], multimedia: [] };
        } else {
          return this.writeElementTreeImpl($(element), $);
        }
      });

    return this.concatMarkdownBoxes(children, element);
  }

  private handleList(listStyle: string, listSelf: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): MarkdownBox {
    let indexIncrement = 0;
    const renderListItem = (item: any) => {
      const selectedItem = $(item);
      if (item.type === 'text') {
        return this.makeBox(item.data, 'inline', selectedItem);
      }
      if (!selectedItem.is('item')) {
        return this.writeElementTreeImpl(selectedItem, $);
      }
      let bullet: string;
      ++indexIncrement;
      switch (listStyle) {
        case 'star':
          bullet = '* ';
          break;
        case 'dash':
          bullet = '- ';
          break;
        case 'plus':
          bullet = '+ ';
          break;
        case 'decimal':
          bullet = `${indexIncrement}. `;
          break;
        case 'latin':
          bullet = String.fromCharCode(0x61 + indexIncrement - 1) + '. ';
          break;
        default:
          this.raiseError(`Invalid list style: ${listStyle}`, selectedItem);
          return this.makeBox('', 'block', selectedItem);
      }
      const paragraph = this.writeElementTrees(selectedItem.contents(), $);
      const paragraphWithBullet = this.wrapBox(paragraph, bullet, '', selectedItem);
      const doubleNewLine = paragraphWithBullet.text.includes('\n\n');
      return this.handleParagraph(paragraphWithBullet, selectedItem, bullet.length, -bullet.length, doubleNewLine);
    };

    const items = listSelf
      .contents()
      .toArray()
      .map((item) => renderListItem(item));
    return this.handleParagraph(this.concatMarkdownBoxes(items, listSelf), listSelf);
  }

  protected processMultipleTableRows(elements: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): StringTableRow[] {
    const escapeInTable = (text: string) => {
      return text.replace(/\|/g, '\\|');
    };

    return elements
      .contents()
      .toArray()
      .map((element) => {
        if (!$(element).is('trow')) {
          this.raiseError(`Invalid table head, expect trow: ${element}`, $(element));
          return [];
        }
        return $(element)
          .contents()
          .toArray()
          .map((cell) => {
            if (!$(cell).is('tcell')) {
              this.raiseError(`Invalid table cell, expect tcell: ${cell}`, $(element));
              return '';
            }
            return escapeInTable(this.writeElementTrees($(cell).contents(), $).text);
          });
      });
  }

  protected handleTable(
    tableHeadElements: cheerio.Cheerio<any>,
    tableBodyElements: cheerio.Cheerio<any>,
    tableElement: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI,
  ): MarkdownBox {
    const tableHead = this.processMultipleTableRows(tableHeadElements, $);
    const tableBody = this.processMultipleTableRows(tableBodyElements, $);
    const numberOfColumns = Math.max(...tableHead.map((row) => row.length), ...tableBody.map((row) => row.length));
    const columnWidths = [...Array(numberOfColumns).keys()].map((i) => {
      return Math.max(
        ...tableHead.map((row) => (row[i] ? row[i].length : 0)),
        ...tableBody.map((row) => (row[i] ? row[i].length : 0)),
      );
    });
    // TODO: alignment and collapse config
    // Currently follows the format here: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-tables
    const makeRow = (row: string[], isHeader: boolean) => {
      if (isHeader && row.length !== numberOfColumns) {
        row = [...row, ...[...Array(numberOfColumns - row.length).keys()].map(() => '')];
      }
      return (
        '| ' +
        row
          .map((cell, i) => {
            if (this.options.markdownTableCollapse) {
              return cell + ' |';
            } else {
              return cell.padEnd(columnWidths[i]) + ' |';
            }
          })
          .join(' ')
      );
    };
    const makeSeparator = () => {
      return (
        '| ' +
        columnWidths
          .map((width) => '-'.repeat(this.options.markdownTableCollapse && width >= 3 ? 3 : width))
          .join(' | ') +
        ' |'
      );
    };
    const renderedTable = [
      ...tableHead.map((row) => makeRow(row, true)),
      makeSeparator(),
      ...tableBody.map((row) => makeRow(row, false)),
    ];
    return this.makeBox(renderedTable.join('\n'), 'block', tableElement);
  }

  protected writeElementTreeImpl(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): MarkdownBox {
    if (element.is('p')) {
      let paragraphs = this.writeElementTrees(element.contents(), $, element);
      return this.handleParagraph(paragraphs, element);
    } else if (element.is('span')) {
      return this.makeBox(this.writeElementTrees(element.contents(), $, element), 'inline', element);
    } else if (element.is('nl')) {
      const nlText = '\n'.repeat(parseInt(element.attr('count') || '1'));
      return {
        text: nlText,
        before: '',
        after: '',
        mappings: [this.createMappingNode(element, nlText.length)],
        multimedia: [],
      };
    } else if (element.is('h')) {
      let paragraphs = this.writeElementTrees(element.contents(), $, element);
      const level = parseInt(element.attr('level') || '1') + this.options.markdownBaseHeaderLevel - 1;
      return this.handleParagraph(this.wrapBoxEveryLine(paragraphs, '#'.repeat(level) + ' ', ''), element);
    } else if (element.is('b')) {
      return this.wrapBox(this.writeElementTrees(element.contents(), $, element), '**', '**', element);
    } else if (element.is('i')) {
      return this.wrapBox(this.writeElementTrees(element.contents(), $, element), '*', '*', element);
    } else if (element.is('s')) {
      return this.wrapBox(this.writeElementTrees(element.contents(), $, element), '~~', '~~', element);
    } else if (element.is('u')) {
      return this.wrapBox(this.writeElementTrees(element.contents(), $, element), '__', '__', element);
    } else if (element.is('code')) {
      let paragraphs;
      if (element.attr('inline') === 'false') {
        const lang = element.attr('lang') || '';
        paragraphs = this.wrapBox(this.writeElementTrees(element.contents(), $, element), '```' + lang + '\n', '\n```');
        return this.handleParagraph(paragraphs, element);
      } else {
        // inline = true or undefined
        return this.wrapBox(this.writeElementTrees(element.contents(), $, element), '`', '`', element);
      }
    } else if (element.is('table')) {
      const contents = element.contents();
      if (contents.length !== 2 || (!contents.first().is('thead') && !contents.first().is('tbody'))) {
        return this.raiseErrorAndReturnEmpty(`Invalid table, expect two children thead and tbody: ${element}`, element);
      }
      const [tableHeadElements, tableBodyElements] = contents.toArray();
      return this.handleParagraph(this.handleTable($(tableHeadElements), $(tableBodyElements), $(element), $), element);
    } else if (element.is('thead') || element.is('tbody') || element.is('trow') || element.is('tcell')) {
      return this.raiseErrorAndReturnEmpty(
        'thead, tbody, trow, tcell do not appear alone without a table context',
        element,
      );
    } else if (element.is('list')) {
      const listStyle = element.attr('list-style');
      return this.handleList(listStyle || 'dash', element, $);
    } else if (element.is('item')) {
      return this.raiseErrorAndReturnEmpty('item does not appear alone without a list context', element);
    } else if (element.is('env')) {
      if (element.attr('presentation') === 'markup' && element.attr('markup-lang') === this.markupLanguage()) {
        return this.makeBox(this.writeElementTrees(element.contents(), $, element), 'inline', element);
      } else {
        const content = new EnvironmentDispatcher(this.ir).writeElementTree(element, $);
        const { output, mappings, multimedia } = content;
        return this.makeBox({ text: output, before: '', after: '', mappings, multimedia }, 'inline', $(element));
      }
    } else {
      return this.raiseErrorAndReturnEmpty(`Not implemented element type ${element}`, element);
    }
  }

  public writeElementTree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    const markdownBox = this.writeElementTreeImpl(element, $);
    return {
      output: markdownBox.text,
      mappings: markdownBox.mappings,
      multimedia: markdownBox.multimedia,
    };
  }

  protected markupLanguage(): string {
    return 'markdown';
  }
}

type XMLNode = ReturnType<typeof xmlbuilder.create>;

interface HtmlOptions {
  htmlPrettyPrint: boolean;
  htmlIndent: string;
}

export class HtmlWriter extends Writer<HtmlOptions> {
  private inTableHead = false;

  protected initializeOptions(options?: HtmlOptions | undefined): HtmlOptions {
    return {
      htmlPrettyPrint: options?.htmlPrettyPrint ?? true,
      htmlIndent: options?.htmlIndent ?? '  ',
    };
  }

  private handleTableHeadBody(document: XMLNode, element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI) {
    if (!(element.is('thead') || element.is('tbody') || element.is('tcell') || element.is('trow'))) {
      this.raiseError(`Only thead, tbody and tcell should be handled, not ${element}`, element);
      return;
    }
    const originalTableHead = this.inTableHead;
    if (element.is('thead')) {
      this.inTableHead = true;
    }
    if (element.is('tcell')) {
      if (this.inTableHead) {
        this.fillNodeContents(document.ele('th'), element, $);
      } else {
        this.fillNodeContents(document.ele('td'), element, $);
      }
    } else if (element.is('trow')) {
      this.fillNodeContents(document.ele('tr'), element, $);
    } else {
      const tagName = element.is('thead') ? 'thead' : 'tbody';
      this.fillNodeContents(document.ele(tagName), element, $);
    }
    this.inTableHead = originalTableHead;
  }

  private fillNodeContents(document: XMLNode, element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI) {
    element
      .contents()
      .toArray()
      .forEach((child) => {
        if (child.type === 'text') {
          document.txt(child.data);
        } else {
          this.addNode(document, $(child), $);
        }
      });
  }

  private addNode(document: XMLNode, element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI) {
    if (element.is('h')) {
      const level = element.attr('level') || '1';
      const tagName = `h${level}`;
      this.fillNodeContents(document.ele(tagName), element, $);
    } else if (element.is('code')) {
      this.fillNodeContents(document.ele('pre').ele('code'), element, $);
    } else if (element.is('nl')) {
      const count = parseInt(element.attr('count') || '1');
      for (let i = 0; i < count; i++) {
        document.ele('br');
      }
    } else if (element.is('thead') || element.is('tbody') || element.is('trow') || element.is('tcell')) {
      this.handleTableHeadBody(document, element, $);
    } else if (element.is('env')) {
      if (element.attr('presentation') === 'markup' && element.attr('markup-lang') === 'html') {
        this.fillNodeContents(document, element, $);
      } else {
        const inner = new EnvironmentDispatcher(this.ir).writeElementTree(element, $);
        if (inner.multimedia.length > 0) {
          this.raiseError('Multimedia cannot be nested in HTML.', element);
        }
        document.txt(inner.output);
      }
    } else {
      const tagName = element.prop('tagName')?.toLowerCase() || 'div';
      this.fillNodeContents(document.ele(tagName), element, $);
    }
  }

  public writeElementTree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    const document = xmlbuilder.create();
    this.addNode(document, element, $);
    const html = document.end({
      prettyPrint: this.options.htmlPrettyPrint,
      indent: this.options.htmlIndent,
      headless: true,
    });
    return {
      output: html,
      mappings: [this.createMappingNode(element, html.length)],
      multimedia: [],
    };
  }
}

export class CsvWriter extends MarkdownWriter {
  protected handleTable(
    tableHeadElements: cheerio.Cheerio<any>,
    tableBodyElements: cheerio.Cheerio<any>,
    tableElement: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI,
  ): MarkdownBox {
    const tableHead = this.processMultipleTableRows(tableHeadElements, $);
    const tableBody = this.processMultipleTableRows(tableBodyElements, $);
    const makeCell = (cell: string) => {
      if (cell.includes(this.options.csvSeparator)) {
        if (cell.includes('"')) {
          cell = cell.replace(/"/g, '""');
        }
        cell = '"' + cell + '"';
      }
      return cell;
    };
    const makeRow = (row: string[]) => {
      return row.map(makeCell).join(this.options.csvSeparator);
    };
    let renderedTable: string[];
    if (this.options.csvHeader) {
      renderedTable = [...tableHead.map(makeRow), ...tableBody.map(makeRow)];
    } else {
      renderedTable = [...tableBody.map(makeRow)];
    }
    return this.makeBox(renderedTable.join('\n'), 'block', tableElement);
  }

  protected writeElementTreeImpl(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): MarkdownBox {
    if (
      element.is('table') ||
      element.is('thead') ||
      element.is('tbody') ||
      element.is('trow') ||
      element.is('tcell') ||
      element.is('env')
    ) {
      return super.writeElementTreeImpl(element, $);
    } else {
      return this.raiseErrorAndReturnEmpty(`Not implemented element type in csv ${element}`, element);
    }
  }

  protected markupLanguage(): string {
    return 'csv';
  }
}

export class TsvWriter extends CsvWriter {
  protected initializeOptions(options?: MarkdownOptions | undefined): MarkdownOptions {
    return super.initializeOptions({ csvSeparator: '\t', ...options } as MarkdownOptions);
  }

  protected markupLanguage(): string {
    return 'tsv';
  }
}

class SerializeWriter<WriterOptions> extends Writer<WriterOptions> {
  public get serializeLanguage(): string {
    throw new SystemError('Method serializeLanguage not implemented.');
  }

  protected parseText(element: cheerio.Cheerio<any>, text: string, type: string): any {
    let value: any = null;
    switch (type) {
      case 'string':
        value = text;
        break;
      case 'integer':
        value = parseInt(text);
        break;
      case 'float':
        value = parseFloat(text);
        break;
      case 'boolean':
        if (text === 'true') {
          value = true;
        } else if (text === 'false') {
          value = false;
        } else {
          this.raiseError(`Invalid boolean value: ${text}`, element);
        }
        break;
      case 'null':
        value = null;
        break;
      case 'array':
        value = [text];
        break;
      case undefined:
        value = text;
        break;
      default:
        this.raiseError(`Invalid type: ${type}`, element);
    }
    return value;
  }

  protected parseAny(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI, singleAsObject?: boolean): any {
    if (element.is('any') || element.is('env')) {
      const contents = element.contents().toArray();
      if (contents.length === 1 && contents[0].type === 'text') {
        return this.parseText(element, contents[0].data, element.attr('type') || 'string');
      } else if (contents.length === 0) {
        return null;
      } else {
        // > 1 or non-text
        const namedValues: { name?: string; value: any }[] = contents
          .filter((child) => child.type === 'text' || child.type === 'tag')
          .map((child) => {
            if (child.type === 'text') {
              return { value: child.data };
            } else if ($(child).is('any')) {
              const name = $(child).attr('name');
              const value = this.parseAny($(child), $);
              if (name !== undefined) {
                return { name, value };
              } else {
                return { value };
              }
            } else {
              return { value: this.parseGeneralElement($(child), $) };
            }
          });

        const enforceArray = element.attr('type') === 'array';
        singleAsObject = singleAsObject ?? enforceArray;

        if (singleAsObject === false && namedValues.length === 1 && namedValues[0].name === undefined) {
          // This happens in env.
          return namedValues[0].value;
        }

        // Without all white space elements, can it be an object?
        const namedValuesWithoutWhiteSpace = namedValues.filter(
          (val) => typeof val.value !== 'string' || val.value.trim() !== '',
        );

        // If all values have names, return an object
        if (namedValuesWithoutWhiteSpace.every((val) => val.name !== undefined) && element.attr('type') !== 'array') {
          return namedValuesWithoutWhiteSpace.reduce((acc, val) => {
            if (val.name === undefined) {
              this.raiseError(`Value must have a name in object context: ${element}`, element);
              return acc;
            }
            acc[val.name] = val.value;
            return acc;
          }, {} as any);
        } else if (
          namedValuesWithoutWhiteSpace.every((val) => typeof val.value === 'string') &&
          element.attr('type') !== 'array'
        ) {
          // All sub items are strings, concatenate them directly.
          // We need the white spaces here.
          return namedValuesWithoutWhiteSpace.map((val) => val.value).join(' ');
        } else {
          // Otherwise, return an array
          return namedValuesWithoutWhiteSpace.map((value) => value.value);
        }
      }
    }
  }

  protected parseObject(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): any {
    if (!element.is('obj')) {
      this.raiseError(`Not an obj: ${element}`, element);
      return null;
    }
    const jsonData = element.attr('data');
    if (jsonData === undefined) {
      this.raiseError(`No data attribute in obj: ${element}`, element);
      return null;
    }
    const data = JSON.parse(jsonData);
    return data;
  }

  protected parseEnv(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): any {
    if (!element.is('env')) {
      this.raiseError(`Not an env: ${element}`, element);
      return null;
    }
    if (element.attr('presentation') === 'serialize') {
      const serializer = element.attr('serializer');
      if (serializer !== undefined && serializer !== this.serializeLanguage) {
        const inner = new EnvironmentDispatcher(this.ir).writeElementTree(element, $);
        if (inner.multimedia.length > 0) {
          this.raiseError('Multimedia with cannot be nested in serialize.', element);
        }
        return inner.output;
      } else {
        return this.parseAny(element, $, false);
      }
    } else if (element.attr('presentation') === 'markup') {
      const inner = new EnvironmentDispatcher(this.ir).writeElementTree(element, $);
      if (inner.multimedia.length > 0) {
        this.raiseError('Multimedia cannot be nested in serialize.', element);
      }
      return inner.output;
    } else {
      this.raiseError(`Invalid presentation: ${element}`, element);
      return null;
    }
  }

  protected parseGeneralElement(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): any {
    if (element.is('any')) {
      return this.parseAny(element, $);
    } else if (element.is('obj')) {
      return this.parseObject(element, $);
    } else if (element.is('env')) {
      return this.parseEnv(element, $);
    } else {
      const tagName = element.prop('tagName');
      this.raiseError(`Invalid element with tag name: ${tagName}`, element);
      return null;
    }
  }
}

interface JsonOptions {
  jsonSpace: number | string;
}

export class JsonWriter extends SerializeWriter<JsonOptions> {
  public get serializeLanguage(): string {
    return 'json';
  }

  protected initializeOptions(options?: JsonOptions | undefined): JsonOptions {
    return {
      jsonSpace: options?.jsonSpace ?? 2,
    };
  }

  public writeElementTree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    const data = this.parseGeneralElement(element, $);
    const jsonText = JSON.stringify(data, null, this.options.jsonSpace);
    return {
      output: jsonText,
      mappings: [this.createMappingNode(element, jsonText.length)],
      multimedia: [],
    };
  }
}

interface YamlOptions {
  yamlIndent: number;
  yamlTrimEnd: boolean;
}

export class YamlWriter extends SerializeWriter<YamlOptions> {
  public get serializeLanguage(): string {
    return 'yaml';
  }

  protected initializeOptions(options?: YamlOptions | undefined): YamlOptions {
    return {
      yamlIndent: options?.yamlIndent ?? 2,
      yamlTrimEnd: options?.yamlTrimEnd ?? true,
    };
  }

  public writeElementTree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    const data = this.parseGeneralElement(element, $);
    const yamlText = yaml.dump(data, {
      indent: this.options.yamlIndent,
    });
    return {
      output: this.options.yamlTrimEnd ? yamlText.trimEnd() : yamlText,
      mappings: [this.createMappingNode(element, yamlText.length)],
      multimedia: [],
    };
  }
}

interface XmlOptions {
  xmlPrettyPrint: boolean;
  xmlIndent: string;
  xmlListItemName: string;
  xmlSlugify: boolean;
}

export class XmlWriter extends SerializeWriter<XmlOptions> {
  public get serializeLanguage(): string {
    return 'xml';
  }

  protected initializeOptions(options?: XmlOptions | undefined): XmlOptions {
    return {
      xmlPrettyPrint: options?.xmlPrettyPrint ?? true,
      xmlIndent: options?.xmlIndent ?? '  ',
      xmlListItemName: options?.xmlListItemName ?? 'item',
      xmlSlugify: options?.xmlSlugify ?? true,
    };
  }

  private tagSlugify(name: string): string {
    // Rules:
    // Element names are case-sensitive
    // Element names must start with a letter or underscore
    // Element names cannot start with the letters xml (or XML, or Xml, etc)
    // Element names can contain letters, digits, hyphens, underscores, and periods
    // Element names cannot contain spaces

    if (!this.options.xmlSlugify) {
      return name;
    }

    // First replace all that is not a letter, digit, hyphen, underscore, period with a hyphen
    name = name.replace(/[^a-zA-Z0-9\-_\.]/g, '-');
    // If the first character is not a letter or underscore, add an underscore
    if (!/^[a-zA-Z_]/.test(name)) {
      name = '_' + name;
    }
    // If the name starts with xml (or Xml), add an underscore
    if (/^xml/i.test(name)) {
      name = '_' + name;
    }
    return name;
  }

  private addNode(document: XMLNode, object: any) {
    if (object === null || object === undefined) {
      // do nothing
    } else if (typeof object === 'object') {
      if (Array.isArray(object)) {
        for (const item of object) {
          if ((typeof item === 'object' && item && Object.keys(item).length > 1) || typeof item !== 'object') {
            this.addNode(document.ele(this.options.xmlListItemName), item);
          } else {
            this.addNode(document, item);
          }
        }
      } else {
        Object.entries(object).forEach(([key, value]) => {
          const node = document.ele(this.tagSlugify(key));
          this.addNode(node, value);
        });
      }
    } else {
      document.txt(object.toString());
    }
  }

  public writeElementTree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    const data = this.parseGeneralElement(element, $);
    const document = xmlbuilder.fragment();
    this.addNode(document, data);
    const xmlText = document.end({
      prettyPrint: this.options.xmlPrettyPrint,
      indent: this.options.xmlIndent,
      headless: true,
    });
    return {
      output: xmlText,
      mappings: [this.createMappingNode(element, xmlText.length)],
      multimedia: [],
    };
  }
}

type FreeOptions = TruncateOptions;

export class FreeWriter extends Writer<FreeOptions> {
  protected initializeOptions(options?: FreeOptions | undefined): FreeOptions {
    return {
      truncateMarker: options?.truncateMarker ?? ' (...truncated)',
      truncateDirection: options?.truncateDirection ?? 'end',
      tokenEncodingModel: options?.tokenEncodingModel ?? 'gpt-4o',
    };
  }

  private handleFree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    let resultText: string = '';
    const mappings: MappingNode[] = [];
    const multimedia: PositionalContentMultiMedia[] = [];
    const charLimitAttr = element.attr('char-limit');
    const tokenLimitAttr = element.attr('token-limit');
    const charLimit = charLimitAttr !== undefined ? parseInt(charLimitAttr, 10) : undefined;
    const tokenLimit = tokenLimitAttr !== undefined ? parseInt(tokenLimitAttr, 10) : undefined;
    for (const child of element.contents().toArray()) {
      if (child.type === 'text') {
        // if (child.data.trim() === '') {
        //   // Dangling white spaces often appear between elements.
        //   // We don't want to keep them.
        // } else {
        resultText += child.data;
        // }
      } else {
        const result = this.writeElementTree($(child), $);
        mappings.push(...this.indentMappings(result.mappings, resultText.length, 0));
        multimedia.push(...this.indentMultiMedia(result.multimedia, resultText.length, 0));
        resultText += result.output;
      }
    }
    resultText = this.truncateText(resultText, charLimit, tokenLimit, this.options);
    mappings.push(this.createMappingNode(element, resultText.length));
    return {
      output: resultText,
      mappings: mappings,
      multimedia: multimedia,
    };
  }

  public writeElementTree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    if (element.is('env')) {
      if (element.attr('presentation') === 'free') {
        return this.handleFree(element, $);
      } else {
        return new EnvironmentDispatcher(this.ir).writeElementTree(element, $);
      }
    } else if (element.is('text')) {
      return this.handleFree(element, $);
    } else {
      return this.raiseError('Free writer is unable to process non-env element.', element);
    }
  }
}

type MultiMediaOptions = any;

export class MultiMediaWriter extends Writer<MultiMediaOptions> {
  protected initializeOptions(options?: MultiMediaOptions | undefined): MultiMediaOptions {
    return {};
  }

  private handleImageOrAudio(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    if (!element.is('img') && !element.is('audio')) {
      return this.raiseError(`Invalid element: Only <img> or <audio> tags are allowed. Found: ${element}`, element);
    }
    const base64 = element.attr('base64');
    const alt = element.attr('alt');
    const type = element.attr('type') || 'image'; // image by default
    if (base64) {
      const position = element.attr('position') || 'here';
      if (!['here', 'top', 'bottom'].includes(position)) {
        return this.raiseError(`Invalid position: ${position}`, element);
      }
      return {
        output: SPECIAL_CHARACTER,
        mappings: [this.createMappingNode(element, 1)],
        multimedia: [{ type: type, position: position as Position, index: 0, base64, alt }],
      };
    } else if (alt) {
      return {
        output: alt,
        mappings: [this.createMappingNode(element, alt.length)],
        multimedia: [],
      };
    } else {
      return this.raiseError('No base64 or alt attribute in multimedia.', element);
    }
  }

  private handleToolRequest(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    if (!element.is('toolrequest')) {
      return this.raiseError(`Invalid element: Only <toolrequest> tags are allowed. Found: ${element}`, element);
    }
    const id = element.attr('id');
    const name = element.attr('name');
    const content = element.attr('content');

    if (!id || !name) {
      return this.raiseError('Tool request must have id and name attributes.', element);
    }

    let parameters: any;
    try {
      parameters = content ? JSON.parse(content) : {};
    } catch (e) {
      return this.raiseError(`Invalid JSON content in tool request: ${content}`, element);
    }

    return {
      output: SPECIAL_CHARACTER,
      mappings: [this.createMappingNode(element, 1)],
      multimedia: [
        {
          type: 'application/vnd.poml.toolrequest',
          position: 'here' as Position,
          index: 0,
          content: parameters,
          id,
          name,
        },
      ],
    };
  }

  private handleToolResponse(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    if (!element.is('toolresponse')) {
      return this.raiseError(`Invalid element: Only <toolresponse> tags are allowed. Found: ${element}`, element);
    }
    const id = element.attr('id');
    const name = element.attr('name');

    if (!id || !name) {
      return this.raiseError('Tool response must have id and name attributes.', element);
    }

    // Extract children content using source indices.
    // This is a bit hacky and we will lose all the mappings from the children.
    // But make it work without hack requires a refactor of multimedia processing.
    const childrenContentPartial = this.writeElementTrees(element.contents(), $);
    const resultWithSourceMap = this.buildSourceMap({
      input: this.ir,
      output: childrenContentPartial.output,
      mappings: childrenContentPartial.mappings,
      multimedia: childrenContentPartial.multimedia,
      speakers: [],
    }).map((s) => ({
      startIndex: s.inputStart,
      endIndex: s.inputEnd,
      irStartIndex: s.irStart,
      irEndIndex: s.irEnd,
      content: s.content,
    }));
    const childrenContent = richContentFromSourceMap(resultWithSourceMap);
    if (childrenContent === '' || (Array.isArray(childrenContent) && childrenContent.length === 0)) {
      return this.raiseError('Tool response must have children content.', element);
    }

    return {
      output: SPECIAL_CHARACTER,
      mappings: [this.createMappingNode(element, 1)],
      multimedia: [
        {
          type: 'application/vnd.poml.toolresponse',
          position: 'here' as Position,
          index: 0,
          content: childrenContent,
          id,
          name,
        },
      ],
    };
  }

  public writeElementTrees(elements: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    const children: WriterPartialResult[] = elements
      .toArray()
      .filter((element) => element.type === 'tag')
      .map((element) => this.writeElementTree($(element), $));

    let mappings: MappingNode[] = [];
    let multimedia: PositionalContentMultiMedia[] = [];
    let output = '';
    for (const child of children) {
      mappings.push(...this.indentMappings(child.mappings, output.length, 0));
      multimedia.push(...this.indentMultiMedia(child.multimedia, output.length, 0));
      output += child.output;
    }
    return { output, mappings, multimedia };
  }

  public writeElementTree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    if (element.is('env')) {
      if (element.attr('presentation') === 'multimedia') {
        return this.writeElementTrees(element.contents(), $);
      } else {
        return new EnvironmentDispatcher(this.ir).writeElementTree(element, $);
      }
    } else if (element.is('img') || element.is('audio')) {
      return this.handleImageOrAudio(element, $);
    } else if (element.is('toolrequest')) {
      return this.handleToolRequest(element, $);
    } else if (element.is('toolresponse')) {
      return this.handleToolResponse(element, $);
    } else {
      return this.raiseError('Multimedia writer is unable to process this element.', element);
    }
  }
}
