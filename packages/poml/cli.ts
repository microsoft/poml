#!/usr/bin/env node

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { commandLine } from './index';

const args = yargs(hideBin(process.argv))
  .options({
    input: { type: 'string', alias: 'i', description: 'Input string' },
    file: { type: 'string', alias: 'f', description: 'Path to input file' },
    output: { type: 'string', alias: 'o', description: 'Path to output file' },
    context: { type: 'string', array: true, alias: 'c', description: 'Context variables' },
    contextFile: { type: 'string', alias: 'context-file', description: 'Path to context JSON file' },
    stylesheet: { type: 'string', alias: 's', description: 'Path to stylesheet file' },
    stylesheetFile: { type: 'string', alias: 'stylesheet-file', description: 'Path to stylesheet JSON file' },
    trim: {
      type: 'boolean',
      alias: 't',
      description: 'Trim whitespace between elements when parsing the input',
      default: true,
    },
    speakerMode: { type: 'boolean', alias: 'chat', description: 'Output in speaker mode (JSON)', default: true },
    prettyPrint: { type: 'boolean', alias: 'p', description: 'Pretty print the output', default: false },
    strict: { type: 'boolean', description: 'Strict mode', default: true },
    cwd: {
      type: 'string',
      description: 'Working directory (defaults to file location if file is specified, otherwise current directory)',
    },
    traceDir: { type: 'string', description: 'Enable tracing and dump files to this directory' },
  })
  .parseSync();

commandLine(args);
