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
  RichContent
} from './base';
import { Position } from './presentation';
import yaml from 'js-yaml';

// Use the special character to indicate a placeholder for multimedia.
const SPECIAL_CHARACTER = 'À';

// Position indicates the targetted position of the multimedia.
// Index indicates the place it's currently at, which must be a special character.
type PositionalContentMultiMedia = ContentMultiMedia & { position: Position; index: number };

interface MappingNode {
  inputStart: number;
  inputEnd: number;
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

class Writer<WriterOptions> {
  protected ir: string = '';
  protected options: WriterOptions;

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

  protected createMappingNode(element: cheerio.Cheerio<any>, outputLength: number): MappingNode {
    return {
      inputStart: element[0].startIndex,
      inputEnd: element[0].endIndex,
      outputStart: 0,
      outputEnd: outputLength - 1
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
  protected indentMappings(
    mappings: MappingNode[],
    indent: number,
    ignoreBefore: number
  ): MappingNode[] {
    return mappings.map(mapping => {
      return {
        inputStart: mapping.inputStart,
        inputEnd: mapping.inputEnd,
        outputStart:
          mapping.outputStart >= ignoreBefore ? mapping.outputStart + indent : mapping.outputStart,
        outputEnd:
          mapping.outputStart >= ignoreBefore ? mapping.outputEnd + indent : mapping.outputEnd
      };
    });
  }

  protected indentMultiMedia(
    multimedia: PositionalContentMultiMedia[],
    indent: number,
    ignoreBefore: number
  ): PositionalContentMultiMedia[] {
    return multimedia.map(media => {
      return {
        ...media,
        index: media.index >= ignoreBefore ? media.index + indent : media.index
      };
    });
  }

  protected raiseError(message: string, element: cheerio.Cheerio<any>): WriterPartialResult {
    const parseAttrAsInt = (attrName: string): number | undefined => {
      const attrValue = element.attr(attrName);
      return attrValue !== undefined && !isNaN(parseInt(attrValue, 10))
        ? parseInt(attrValue, 10)
        : undefined;
    };
    const emptyOutput = {
      output: '',
      multimedia: [],
      mappings: []
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
        element[0].startIndex,
        element[0].endIndex,
        this.ir
      )
    );
    return emptyOutput;
  }

  public writeElementTree(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): WriterPartialResult {
    throw new SystemError('Method not implemented.');
  }

  public write(ir: string): RichContent {
    const result = this.writeWithSourceMap(ir);
    return this.richContentFromString(result.output, result.multimedia);
  }

  public writeMessages(ir: string): Message[] {
    const result = this.writeWithSourceMap(ir);
    return result.speakers.map(node => {
      const speakerString = result.output.slice(node.start, node.end + 1);
      const speakerMultimedia = this.indentMultiMedia(
        result.multimedia.filter(media => media.index >= node.start && media.index <= node.end),
        -node.start,
        0
      );
      return {
        speaker: node.speaker,
        content: this.richContentFromString(speakerString, speakerMultimedia)
      };
    });
  }

  public assignSpeakers(result: WriterPartialResult, $: cheerio.CheerioAPI): SpeakerNode[] {
    const speakers: SpeakerNode[] = [];
    let defaultSpeaker: Speaker = 'system';
    let systemSpeakerSpecified: boolean = false;
    const segments: SpeakerNode[] = [];

    const querySegmentFromMapping = (startIndex: number, endIndex: number) => {
      return result.mappings.find(
        segment => segment.inputStart === startIndex && segment.inputEnd === endIndex
      );
    };

    const getSpecifiedSpeaker = (element: cheerio.Cheerio<any>) => {
      const speaker = element.attr('speaker') as Speaker | undefined;
      if (speaker && !ValidSpeakers.includes(speaker)) {
        this.raiseError(`"${speaker}" is not a valid speaker.`, element);
        return undefined;
      }
      return speaker;
    };

    const assignSpeakerForElement = (
      element: cheerio.Cheerio<any>,
      inheritedSpeaker: Speaker | undefined
    ) => {
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
        console.warn(
          `Speaker is specified but no exact corresponding output can be found in ${element.html()}`
        );
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
    segments.forEach(segment => {
      allIndicesSet.add(segment.start);
      allIndicesSet.add(segment.end);
    });
    const essentialIndices = Array.from(allIndicesSet).sort((a, b) => a - b);
    const colorSpeakers: Speaker[] = new Array(essentialIndices.length).fill('system');
    segments.forEach(segment => {
      const startIndex = essentialIndices.findIndex(index => index == segment.start);
      const endIndex = essentialIndices.findIndex(index => index == segment.end);
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
      if (
        i === essentialIndices.length - 1 ||
        (i < essentialIndices.length - 1 && speaker !== colorSpeakers[i + 1])
      ) {
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

  public writeWithSourceMap(ir: string): WriterResult {
    this.reset(ir);
    const $ = cheerio.load(
      ir,
      {
        scriptingEnabled: false,
        xml: { xmlMode: true, withStartIndices: true, withEndIndices: true }
      },
      false
    );
    const partialResult = this.writeElementTree(this.getRoot($), $);
    return {
      input: ir,
      output: partialResult.output,
      mappings: partialResult.mappings,
      multimedia: partialResult.multimedia,
      speakers: this.assignSpeakers(partialResult, $)
    };
  }

  private richContentFromString(
    text: string,
    multimedia: PositionalContentMultiMedia[]
  ): RichContent {
    // The string contains several positions which are meant to be places for multimedia.
    // We need to split the string into segments and insert multimedia in between.
    multimedia = multimedia.sort((a, b) => a.index - b.index);
    const topMedia = multimedia.filter(media => media.position === 'top');
    const bottomMedia = multimedia.filter(media => media.position === 'bottom');

    const removePositionIndex = (media: PositionalContentMultiMedia): ContentMultiMedia => {
      const { position, index, ...rest } = media;
      return rest;
    };

    const segments: RichContent = topMedia.map(removePositionIndex);
    const appendSegment = (segment: string) => {
      if (segments.length > 0 && typeof segments[segments.length - 1] === 'string') {
        segments[segments.length - 1] += segment;
      } else if (segment.length > 0) {
        segments.push(segment);
      }
    };

    let lastOccurrence: number = -1;
    for (const occur of multimedia) {
      appendSegment(text.slice(lastOccurrence + 1, occur.index));
      if (occur.position === 'here') {
        segments.push(removePositionIndex(occur));
      }
      lastOccurrence = occur.index;
    }
    appendSegment(text.slice(lastOccurrence + 1));
    segments.push(...bottomMedia.map(removePositionIndex));

    if (segments.length === 1 && typeof segments[0] === 'string') {
      return segments[0];
    }
    return segments;
  }

  private getRoot($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
    return $($.root().children()[0]);
  }
}

export class EnvironmentDispatcher extends Writer<any> {
  public writeElementTree(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): WriterPartialResult {
    if (element.is('env')) {
      let options: any = undefined;
      try {
        const optionsString = element.attr('writer-options');
        if (optionsString) {
          options = JSON.parse(optionsString);
        }
      } catch (e) {
        this.raiseError(
          `Invalid JSON for writer-options: ${element.attr('writer-options')}`,
          element
        );
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
}

interface MarkdownOptions {
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
      csvHeader: options.csvHeader ?? true
    };
  }

  protected raiseErrorAndReturnEmpty(message: string, element: cheerio.Cheerio<any>): MarkdownBox {
    this.raiseError(message, element);
    return { text: '', before: '', after: '', mappings: [], multimedia: [] };
  }

  protected makeBox(
    text: string | MarkdownBox,
    layout: 'block' | 'newline' | 'inline',
    element: cheerio.Cheerio<any>
  ): MarkdownBox {
    const newBeforeAfter = layout === 'block' ? '\n\n' : layout === 'newline' ? '\n' : '';
    if (typeof text === 'string') {
      return {
        text: text,
        before: newBeforeAfter,
        after: newBeforeAfter,
        mappings: [this.createMappingNode(element, text.length)],
        multimedia: []
      };
    } else {
      return {
        text: text.text,
        before: this.consolidateSpace(newBeforeAfter, text.before),
        after: this.consolidateSpace(text.after, newBeforeAfter),
        mappings: [...text.mappings, this.createMappingNode(element, text.text.length)],
        multimedia: text.multimedia
      };
    }
  }

  private wrapBox(
    box: MarkdownBox,
    wrapBefore: string,
    wrapAfter: string,
    element?: cheerio.Cheerio<any>
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
      multimedia: this.indentMultiMedia(box.multimedia, wrapBefore.length, 0)
    };
  }

  private wrapBoxEveryLine(box: MarkdownBox, wrapBefore: string, wrapAfter: string) {
    const lines = box.text.split('\n');
    let accumulatedLength = 0;
    let mappings: MappingNode[] = box.mappings;
    let multimedia: PositionalContentMultiMedia[] = box.multimedia;
    const text = lines
      .map(line => {
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
      multimedia: multimedia
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

  private concatMarkdownBoxes(boxes: MarkdownBox[]): MarkdownBox {
    const multimedia: PositionalContentMultiMedia[] = [];

    // Remove all spaces children before and after block elements
    let removedSpace = boxes;

    while (true) {
      let afterRemoveSpace = removedSpace.filter((child, i) => {
        const afterBlock = i > 0 && (
          removedSpace[i - 1].after.includes('\n') || /^\n+$/.test(removedSpace[i - 1].text));
        const beforeBlock =
          i < removedSpace.length - 1 && (
            removedSpace[i + 1].before.includes('\n') || /^\n+$/.test(removedSpace[i + 1].text));
        return !((afterBlock || beforeBlock) && /^[ \t]*$/.test(child.text));
      });
      if (afterRemoveSpace.length === removedSpace.length) {
        break;
      }
      // Repeat until no more space can be removed
      removedSpace = afterRemoveSpace;
    }

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
        box.multimedia.every(media => media.position !== 'here')
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
            box.multimedia.filter(
              media => media.position === 'here' && media.index + 1 === box.text.length
            ).length > 0
          ) {
            // Has an adhered multimedia at the end
            thisAfter = '';
          } else if (
            textBoxQueue[i + 1].box.multimedia.filter(
              media => media.position === 'here' && media.index === 0
            ).length > 0
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

    return { text, before, after, mappings, multimedia };
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
    blankLine?: boolean
  ) => {
    innerParagraphs.text = this.indentText(
      innerParagraphs.text,
      indent ?? 0,
      Math.max(0, (firstLineIndent ?? 0) + (indent ?? 0))
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

  private writeElementTrees(elements: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): MarkdownBox {
    const children: MarkdownBox[] = elements
      .toArray()
      .filter(element => element.type !== 'comment')
      .map(element => {
        if (element.type === 'text') {
          return { text: element.data, before: '', after: '', mappings: [], multimedia: [] };
        } else {
          return this.writeElementTreeImpl($(element), $);
        }
      });

    return this.concatMarkdownBoxes(children);
  }

  private handleList(
    listStyle: string,
    listSelf: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): MarkdownBox {
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
      return this.handleParagraph(
        paragraphWithBullet,
        selectedItem,
        bullet.length,
        -bullet.length,
        doubleNewLine
      );
    };

    const items = listSelf.contents().toArray().map((item) => renderListItem(item));
    return this.handleParagraph(this.concatMarkdownBoxes(items), listSelf);
  }

  protected processMultipleTableRows(elements: cheerio.Cheerio<any>, $: cheerio.CheerioAPI) {
    const escapeInTable = (text: string) => {
      return text.replace(/\|/g, '\\|');
    };

    return elements
      .contents()
      .toArray()
      .map(element => {
        if (!$(element).is('trow')) {
          this.raiseError(`Invalid table head, expect trow: ${element}`, $(element));
          return [];
        }
        return $(element)
          .contents()
          .toArray()
          .map(cell => {
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
    $: cheerio.CheerioAPI
  ): MarkdownBox {
    const tableHead = this.processMultipleTableRows(tableHeadElements, $);
    const tableBody = this.processMultipleTableRows(tableBodyElements, $);
    const numberOfColumns = Math.max(
      ...tableHead.map(row => row.length),
      ...tableBody.map(row => row.length)
    );
    const columnWidths = [...Array(numberOfColumns).keys()].map(i => {
      return Math.max(
        ...tableHead.map(row => (row[i] ? row[i].length : 0)),
        ...tableBody.map(row => (row[i] ? row[i].length : 0))
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
          .map(width => '-'.repeat(this.options.markdownTableCollapse && width >= 3 ? 3 : width))
          .join(' | ') +
        ' |'
      );
    };
    const renderedTable = [
      ...tableHead.map(row => makeRow(row, true)),
      makeSeparator(),
      ...tableBody.map(row => makeRow(row, false))
    ];
    return this.makeBox(renderedTable.join('\n'), 'block', tableElement);
  }

  protected writeElementTreeImpl(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): MarkdownBox {
    if (element.is('p')) {
      let paragraphs = this.writeElementTrees(element.contents(), $);
      return this.handleParagraph(paragraphs, element);
    } else if (element.is('span')) {
      return this.makeBox(this.writeElementTrees(element.contents(), $), 'inline', element);
    } else if (element.is('nl')) {
      const nlText = '\n'.repeat(parseInt(element.attr('count') || '1'));
      return {
        text: nlText,
        before: '',
        after: '',
        mappings: [this.createMappingNode(element, nlText.length)],
        multimedia: []
      };
    } else if (element.is('h')) {
      let paragraphs = this.writeElementTrees(element.contents(), $);
      const level =
        parseInt(element.attr('level') || '1') + this.options.markdownBaseHeaderLevel - 1;
      return this.handleParagraph(
        this.wrapBoxEveryLine(paragraphs, '#'.repeat(level) + ' ', ''),
        element
      );
    } else if (element.is('b')) {
      return this.wrapBox(this.writeElementTrees(element.contents(), $), '**', '**', element);
    } else if (element.is('i')) {
      return this.wrapBox(this.writeElementTrees(element.contents(), $), '*', '*', element);
    } else if (element.is('s')) {
      return this.wrapBox(this.writeElementTrees(element.contents(), $), '~~', '~~', element);
    } else if (element.is('u')) {
      return this.wrapBox(this.writeElementTrees(element.contents(), $), '__', '__', element);
    } else if (element.is('code')) {
      let paragraphs;
      if (element.attr('inline') === 'false') {
        const lang = element.attr('lang') || '';
        paragraphs = this.wrapBox(
          this.writeElementTrees(element.contents(), $),
          '```' + lang + '\n',
          '\n```'
        );
        return this.handleParagraph(paragraphs, element);
      } else {
        // inline = true or undefined
        return this.wrapBox(this.writeElementTrees(element.contents(), $), '`', '`', element);
      }
    } else if (element.is('table')) {
      const contents = element.contents();
      if (
        contents.length !== 2 ||
        (!contents.first().is('thead') && !contents.first().is('tbody'))
      ) {
        return this.raiseErrorAndReturnEmpty(
          `Invalid table, expect two children thead and tbody: ${element}`,
          element
        );
      }
      const [tableHeadElements, tableBodyElements] = contents.toArray();
      return this.handleParagraph(
        this.handleTable($(tableHeadElements), $(tableBodyElements), $(element), $),
        element
      );
    } else if (
      element.is('thead') ||
      element.is('tbody') ||
      element.is('trow') ||
      element.is('tcell')
    ) {
      return this.raiseErrorAndReturnEmpty(
        'thead, tbody, trow, tcell do not appear alone without a table context',
        element
      );
    } else if (element.is('list')) {
      const listStyle = element.attr('list-style');
      return this.handleList(listStyle || 'dash', element, $);
    } else if (element.is('item')) {
      return this.raiseErrorAndReturnEmpty(
        'item does not appear alone without a list context',
        element
      );
    } else if (element.is('env')) {
      if (
        element.attr('presentation') === 'markup' &&
        element.attr('markup-lang') === this.markupLanguage()
      ) {
        return this.makeBox(this.writeElementTrees(element.contents(), $), 'inline', element);
      } else {
        const content = new EnvironmentDispatcher(this.ir).writeElementTree(element, $);
        const { output, mappings, multimedia } = content;
        return this.makeBox(
          { text: output, before: '', after: '', mappings, multimedia },
          'inline',
          $(element)
        );
      }
    } else {
      return this.raiseErrorAndReturnEmpty(`Not implemented element type ${element}`, element);
    }
  }

  public writeElementTree(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): WriterPartialResult {
    const markdownBox = this.writeElementTreeImpl(element, $);
    return {
      output: markdownBox.text,
      mappings: markdownBox.mappings,
      multimedia: markdownBox.multimedia
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
      htmlIndent: options?.htmlIndent ?? '  '
    };
  }

  private handleTableHeadBody(
    document: XMLNode,
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ) {
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

  private fillNodeContents(
    document: XMLNode,
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ) {
    element
      .contents()
      .toArray()
      .forEach(child => {
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

  public writeElementTree(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): WriterPartialResult {
    const document = xmlbuilder.create();
    this.addNode(document, element, $);
    const html = document.end({
      prettyPrint: this.options.htmlPrettyPrint,
      indent: this.options.htmlIndent,
      headless: true
    });
    return {
      output: html,
      mappings: [this.createMappingNode(element, html.length)],
      multimedia: []
    };
  }
}

export class CsvWriter extends MarkdownWriter {
  protected handleTable(
    tableHeadElements: cheerio.Cheerio<any>,
    tableBodyElements: cheerio.Cheerio<any>,
    tableElement: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
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

  protected writeElementTreeImpl(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): MarkdownBox {
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
      return this.raiseErrorAndReturnEmpty(
        `Not implemented element type in csv ${element}`,
        element
      );
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
      default:
        this.raiseError(`Invalid type: ${type}`, element);
    }
    return value;
  }

  protected parseAny(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI,
    singleAsObject?: boolean
  ): any {
    if (element.is('any') || element.is('env')) {
      const contents = element.contents().toArray();
      if (contents.length === 1 && contents[0].type === 'text') {
        return this.parseText(element, contents[0].data, element.attr('type') || 'string');
      } else if (contents.length === 0) {
        return null;
      } else {
        // > 1 or non-text
        const namedValues: { name?: string; value: any }[] = contents
          .filter(child => child.type === 'text' || child.type === 'tag')
          .map(child => {
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

        if (
          singleAsObject === false &&
          namedValues.length === 1 &&
          namedValues[0].name === undefined
        ) {
          // This happens in env.
          return namedValues[0].value;
        }

        // Without all white space elements, can it be an object?
        const namedValuesWithoutWhiteSpace = namedValues.filter(
          val => typeof val.value !== 'string' || val.value.trim() !== ''
        );

        // If all values have names, return an object
        if (
          namedValuesWithoutWhiteSpace.every(val => val.name !== undefined) &&
          element.attr('type') !== 'array'
        ) {
          return namedValuesWithoutWhiteSpace.reduce((acc, val) => {
            if (val.name === undefined) {
              this.raiseError(`Value must have a name in object context: ${element}`, element);
              return acc;
            }
            acc[val.name] = val.value;
            return acc;
          }, {} as any);
        } else if (
          namedValuesWithoutWhiteSpace.every(val => typeof val.value === 'string') &&
          element.attr('type') !== 'array'
        ) {
          // All sub items are strings, concatenate them directly.
          // We need the white spaces here.
          return namedValuesWithoutWhiteSpace.map(val => val.value).join(' ');
        } else {
          // Otherwise, return an array
          return namedValuesWithoutWhiteSpace.map(value => value.value);
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
      jsonSpace: options?.jsonSpace ?? 2
    };
  }

  public writeElementTree(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): WriterPartialResult {
    const data = this.parseGeneralElement(element, $);
    const jsonText = JSON.stringify(data, null, this.options.jsonSpace);
    return {
      output: jsonText,
      mappings: [this.createMappingNode(element, jsonText.length)],
      multimedia: []
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
      yamlTrimEnd: options?.yamlTrimEnd ?? true
    };
  }

  public writeElementTree(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): WriterPartialResult {
    const data = this.parseGeneralElement(element, $);
    const yamlText = yaml.dump(data, {
      indent: this.options.yamlIndent
    });
    return {
      output: this.options.yamlTrimEnd ? yamlText.trimEnd() : yamlText,
      mappings: [this.createMappingNode(element, yamlText.length)],
      multimedia: []
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
      xmlSlugify: options?.xmlSlugify ?? true
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

  public writeElementTree(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): WriterPartialResult {
    const data = this.parseGeneralElement(element, $);
    const document = xmlbuilder.fragment();
    this.addNode(document, data);
    const xmlText = document.end({
      prettyPrint: this.options.xmlPrettyPrint,
      indent: this.options.xmlIndent,
      headless: true
    });
    return {
      output: xmlText,
      mappings: [this.createMappingNode(element, xmlText.length)],
      multimedia: []
    };
  }
}

interface FreeOptions { }

export class FreeWriter extends Writer<FreeOptions> {
  protected initializeOptions(options?: FreeOptions | undefined): FreeOptions {
    return {};
  }

  private handleFree(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    let resultText: string = '';
    const mappings: MappingNode[] = [];
    const multimedia: PositionalContentMultiMedia[] = [];
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
    mappings.push(this.createMappingNode(element, resultText.length));
    return {
      output: resultText,
      mappings: mappings,
      multimedia: multimedia
    };
  }

  public writeElementTree(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): WriterPartialResult {
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

interface MultiMediaOptions { }

export class MultiMediaWriter extends Writer<MultiMediaOptions> {
  protected initializeOptions(options?: MultiMediaOptions | undefined): MultiMediaOptions {
    return {};
  }

  private handleImageOrAudio(element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): WriterPartialResult {
    if (!element.is('img') && !element.is('audio')) {
      return this.raiseError(`Not an img or audio: ${element}`, element);
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
        multimedia: [{ type: type, position: position as Position, index: 0, base64, alt }]
      };
    } else if (alt) {
      return {
        output: alt,
        mappings: [this.createMappingNode(element, alt.length)],
        multimedia: []
      };
    } else {
      return this.raiseError('No base64 or alt attribute in multimedia.', element);
    }
  }

  public writeElementTrees(
    elements: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): WriterPartialResult {
    const children: WriterPartialResult[] = elements
      .toArray()
      .filter(element => element.type === 'tag')
      .map(element => this.writeElementTree($(element), $));

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

  public writeElementTree(
    element: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): WriterPartialResult {
    if (element.is('env')) {
      if (element.attr('presentation') === 'multimedia') {
        return this.writeElementTrees(element.contents(), $);
      } else {
        return new EnvironmentDispatcher(this.ir).writeElementTree(element, $);
      }
    } else if (element.is('img') || element.is('audio')) {
      return this.handleImageOrAudio(element, $);
    } else {
      return this.raiseError('Multimedia writer is unable to process this element.', element);
    }
  }
}
