import * as React from 'react';
import { readFileSync, writeFileSync } from './util/fs';
import { renderToString } from "react-dom/server";
import path from 'path';
import { EnvironmentDispatcher } from "./writer";
import { ErrorCollection, Message, RichContent, StyleSheetProvider, SystemError, SourceMapRichContent, SourceMapMessage, richContentFromSourceMap } from './base';
import { PomlFile, PomlReaderOptions } from './file';
import './presentation';
import './essentials';
import "./components";
import { reactRender } from './util/reactRender';
import { dumpTrace, setTrace, clearTrace, isTracing, parseJsonWithBuffers } from './util/trace';

export type { RichContent, Message, SourceMapRichContent, SourceMapMessage };
export { richContentFromSourceMap };

export const read = async (
  element: React.ReactElement | string,
  options?: PomlReaderOptions,
  context?: { [key: string]: any },
  stylesheet?: { [key: string]: any },
  sourcePath?: string,
): Promise<string> => {
  let readElement: React.ReactElement;
  if (typeof element === 'string') {
    readElement = new PomlFile(element, options, sourcePath).react(context);
  } else {
    if (options || context) {
      console.warn('Options and context are ignored when element is React.ReactElement');
    }
    readElement = element;
  }
  if (stylesheet) {
    readElement = React.createElement(StyleSheetProvider, { stylesheet }, readElement);
  }
  return await reactRender(readElement);
};

// Read and also returning the POML file
// A hacky way to get the POML file from the React element
// Do not use it in production code
export const _readWithFile = async (
  element: React.ReactElement | string,
  options?: PomlReaderOptions,
  context?: { [key: string]: any },
  stylesheet?: { [key: string]: any },
  sourcePath?: string,
): Promise<[string, PomlFile | undefined]> => {
  let readElement: React.ReactElement;
  let pomlFile: PomlFile | undefined;
  if (typeof element === 'string') {
    pomlFile = new PomlFile(element, options, sourcePath);
    readElement = pomlFile.react(context);
  } else {
    if (options || context) {
      console.warn('Options and context are ignored when element is React.ReactElement');
    }
    readElement = element;
  }
  if (stylesheet) {
    readElement = React.createElement(StyleSheetProvider, { stylesheet }, readElement);
  }
  return [
    await reactRender(readElement),
    pomlFile
  ];
};

interface WriteOptions {
  speaker?: boolean;
}

interface WriteOptionsNoSpeakerMode extends WriteOptions {
  speaker?: false;
}

interface WriteOptionsSpeakerMode extends WriteOptions {
  speaker: true;
}


export function write(ir: string, options?: WriteOptionsNoSpeakerMode): RichContent;
export function write(ir: string, options: WriteOptionsSpeakerMode): Message[];
export function write(ir: string, options?: WriteOptions): RichContent | Message[];
/**
 * Entry point for turning a parsed IR string into rich content or a list of
 * speaker messages. The heavy lifting is done by `EnvironmentDispatcher`.
 */
export function write(ir: string, options?: WriteOptions): RichContent | Message[] {
  const writer = new EnvironmentDispatcher();
  if (options?.speaker) {
    return writer.writeMessages(ir);
  } else {
    return writer.write(ir);
  }
};

export function writeWithSourceMap(ir: string, options?: WriteOptionsNoSpeakerMode): SourceMapRichContent[];
export function writeWithSourceMap(ir: string, options: WriteOptionsSpeakerMode): SourceMapMessage[];
export function writeWithSourceMap(ir: string, options?: WriteOptions): SourceMapRichContent[] | SourceMapMessage[];
/**
 * Variant of {@link write} that also exposes a source map describing the
 * mapping between input indices and output content.
 */
export function writeWithSourceMap(ir: string, options?: WriteOptions): SourceMapRichContent[] | SourceMapMessage[] {
  const writer = new EnvironmentDispatcher();
  if (options?.speaker) {
    return writer.writeMessagesWithSourceMap(ir);
  } else {
    return writer.writeWithSourceMap(ir);
  }
};

export const poml = async (element: React.ReactElement | string): Promise<RichContent> => {
  ErrorCollection.clear();
  const readResult = await read(element);
  const result = write(readResult);
  if (!ErrorCollection.empty()) {
    throw ErrorCollection.first();
  }
  return result;
}

interface CliArgs {
  input?: string;
  file?: string;
  output?: string;
  context?: string[];
  contextFile?: string;
  stylesheet?: string;
  stylesheetFile?: string;
  trim?: boolean;
  speakerMode?: boolean;
  prettyPrint?: boolean;
  strict?: boolean;
  cwd?: string;
  traceDir?: string;
}

interface CliResult {
  messages: Message[] | RichContent;
  schema?: { [key: string]: any };
  tools?: { [key: string]: any }[];
  runtime?: { [key: string]: any };
}

export async function commandLine(args: CliArgs) {
  const readOptions = {
    trim: args.trim,
  };

  if (args.traceDir) {
    setTrace(true, args.traceDir);
  }

  // Determine the working directory
  let workingDirectory: string;
  if (args.cwd) {
    workingDirectory = path.resolve(args.cwd);
  } else {
    workingDirectory = process.cwd();
  }

  let input: string;
  let sourcePath: string | undefined;
  if (args.input && args.file) {
    throw new Error('Cannot specify both input and file');
  } else if (args.input) {
    input = args.input;
  } else if (args.file) {
    const filePath = path.resolve(workingDirectory, args.file);
    input = readFileSync(filePath, { encoding: 'utf8' });
    sourcePath = filePath;
  } else {
    throw new Error('Must specify either input or file');
  }

  let context: { [key: string]: any } = {};
  if (args.context) {
    for (const pair of args.context) {
      if (!pair.includes('=')) {
        throw new Error(`Invalid context variable, must include one '=': ${pair}`);
      }
      const [key, value] = pair.split('=', 2);
      context[key] = value;
    }
  } else if (args.contextFile) {
    const contextFilePath = path.resolve(workingDirectory, args.contextFile);
    const contextFromFile = parseJsonWithBuffers(readFileSync(contextFilePath, { encoding: 'utf8' }));
    context = { ...context, ...contextFromFile };
  }

  let stylesheet: { [key: string]: any } = {};
  if (args.stylesheetFile) {
    const stylesheetFilePath = path.resolve(workingDirectory, args.stylesheetFile);
    stylesheet = { ...stylesheet, ...parseJsonWithBuffers(readFileSync(stylesheetFilePath, { encoding: 'utf8' })) };
  }
  if (args.stylesheet) {
    stylesheet = { ...stylesheet, ...JSON.parse(args.stylesheet) };
  }

  ErrorCollection.clear();

  const pomlFile = new PomlFile(input, readOptions, sourcePath);
  let reactElement = pomlFile.react(context);
  reactElement = React.createElement(StyleSheetProvider, { stylesheet }, reactElement);

  const ir = await read(input, readOptions, context, stylesheet, sourcePath);

  const speakerMode = args.speakerMode === true || args.speakerMode === undefined;
  const prettyPrint = args.prettyPrint === true;
  let resultMessages = write(ir, { speaker: speakerMode });
  const prettyOutput = speakerMode
    ? (resultMessages as Message[]).map((message) => `===== ${message.speaker} =====\n\n${renderContent(message.content)}`).join('\n\n')
    : renderContent(resultMessages as RichContent);
  const result: CliResult = {
    messages: resultMessages,
    schema: pomlFile.getResponseSchema()?.toOpenAPI(),
    tools: pomlFile.getToolsSchema()?.toOpenAI(),
    runtime: pomlFile.getRuntimeParameters(),
  }
  const output = prettyPrint ? prettyOutput : JSON.stringify(result);

  if (isTracing()) {
    try {
      dumpTrace(input, context, stylesheet, result, sourcePath, prettyOutput);
    } catch (err: any) {
      ErrorCollection.add(new SystemError('Failed to dump trace', { cause: err }));
    }
  }

  if (args.strict === true || args.strict === undefined) {
    if (!ErrorCollection.empty()) {
      throw ErrorCollection.first();
    }
  }

  if (args.output) {
    const outputPath = path.resolve(workingDirectory, args.output);
    writeFileSync(outputPath, output);
  } else {
    process.stdout.write(output);
  }
}

const renderContent = (content: RichContent) => {
  if (typeof content === 'string') {
    return content;
  }
  const outputs: string[] = content.map((part) => {
    if (typeof part === 'string') {
      return part;
    } else {
      const media = JSON.stringify(part);
      if (media.length > 100) {
        return media.slice(0, 100) + '...';
      } else {
        return media;
      }
    }
  });
  return outputs.join('\n\n');
}

export { setTrace, clearTrace, parseJsonWithBuffers, dumpTrace };
