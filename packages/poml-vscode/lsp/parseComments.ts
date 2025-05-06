import "poml";
import { ComponentSpec, Parameter } from "poml/base";

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { formatComponentDocumentation } from "./documentFormatter";

const basicComponents: string[] = [];
const intentions: string[] = [];
const dataDisplays: string[] = [];
const utilities: string[] = [];

function tsCommentToMarkdown(comment: string): ComponentSpec {
  // The comment is a multi-line comment starting with `/**` and ending with `*/`.
  // We first strip the leading `/**` and trailing `*/` and the leading `*` from each line.
  // Then we split the comment into lines.
  const strippedComment = comment
    .replace(/^\/\*\*?/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*( )?/, ''))
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n');

  // Recognize description, @param and @example in the comment.
  const descriptionRegex = /([\s\S]*?)(?=@param|@example|@see|$)/;
  const paramRegex = /@param\s+(\{([\S'"\|]+?)\}\s+)?(\w+)\s+-\s+([\s\S]*?)(?=@param|@example|@see|$)/g;
  const exampleRegex = /@example\s+([\s\S]*?)(?=@param|@example|@see|$)/;
  const seeRegex = /@see\s+([\s\S]*?)(?=@param|@example|@see|$)/g;

  const descriptionMatch = strippedComment.match(descriptionRegex);
  const description = descriptionMatch ? descriptionMatch[1].trim() : '';
  const params: Parameter[] = [];
  let paramMatch;
  while ((paramMatch = paramRegex.exec(strippedComment)) !== null) {
    let choices: string[] = [];
    let type: string = 'string';
    let fallbackType: string | undefined = undefined;
    if (paramMatch[2] === 'object|string') {
      type = 'object';
      fallbackType = 'string';
    } else if (paramMatch[2] === 'Buffer|string') {
      type = 'Buffer';
      fallbackType = 'string';
    } else if (paramMatch[2] === 'RegExp|string') {
      type = 'RegExp';
      fallbackType = 'string';
    } else if (paramMatch[2] === 'string|Buffer') {
      type = 'Buffer';
      fallbackType = 'string';
    } else if (paramMatch[2] && paramMatch[2].includes('|')) {
      type = 'string';
      choices = paramMatch[2].split('|').map((choice) => choice.replace(/['"\s]/g, '').trim());
    } else if (paramMatch[2]) {
      type = paramMatch[2];
    }
    const defaultMatch = paramMatch[4].match(/Default is `([\w\d]+?)`./);
    params.push({
      name: paramMatch[3],
      type,
      fallbackType,
      choices,
      description: paramMatch[4].trim(),
      defaultValue: defaultMatch ? defaultMatch[1] : undefined,
      required: false
    });
  }
  const exampleMatch = strippedComment.match(exampleRegex);
  const example = exampleMatch ? exampleMatch[1].trim() : '';
  const baseComponents: string[] = [];
  let seeMatch;
  while ((seeMatch = seeRegex.exec(strippedComment)) !== null) {
    const baseComponentsMatch = /\{@link (\w+)\} for other props available/.exec(seeMatch[1]);
    if (baseComponentsMatch) {
      baseComponents.push(baseComponentsMatch[1]);
    }
  }
  return {
    description,
    params,
    example,
    baseComponents
  }
}

function extractTsComments(text: string) {
  const comments: ComponentSpec[] = [];
  const commentRegex = /\/\*\*([\s\S]*?)\*\//g;
  let match;
  while ((match = commentRegex.exec(text)) !== null) {
    comments.push(tsCommentToMarkdown(match[1]));
  }
  return comments;
}

function extractComponentComments(text: string) {
  const comments: ComponentSpec[] = [];
  const commentRegex = /(\/\*\*([\s\S]*?)\*\/)\nexport const [\w]+ = component\(['"](\w+)['"](,[\S\s]*?)?\)/g;
  let match;
  while ((match = commentRegex.exec(text)) !== null) {
    const doc = { name: match[3], ...tsCommentToMarkdown(match[2]) };
    comments.push(doc);
  }
  return comments;
}


function* walk(folderPath: string): IterableIterator<string> {
  for (const entry of readdirSync(folderPath, { withFileTypes: true })) {
    if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      yield join(folderPath, entry.name);
    }

    if (entry.isDirectory()) {
      yield* walk(join(folderPath, entry.name));
    }
  }
}

function scanComponentDocs(folderPath: string) {
  // Walk through the folder and extract comments from all files.
  const allComments: ComponentSpec[] = [];
  for (const filePath of walk(folderPath)) {
    const tsCode = readFileSync(filePath, { encoding: 'utf-8' });
    const components = extractComponentComments(tsCode);
    const names = components.map(c => c.name!);
    allComments.push(...components);
    if (filePath.endsWith('essentials.tsx') || filePath.endsWith('utils.tsx')) {
      basicComponents.push(...names.filter(name => name !== 'Image' && name !== 'Object'));
      dataDisplays.push(...names.filter(name => name === 'Image' || name === 'Object'));
    } else if (filePath.endsWith('instructions.tsx')) {
      intentions.push(...names);
    } else if (filePath.endsWith('document.tsx') || filePath.endsWith('table.tsx')) {
      dataDisplays.push(...names);
    } else {
      utilities.push(...names);
    }
  };
  return allComments;
}

function docsToMarkdown(docs: ComponentSpec[]) {
  const parts: string[] = [];
  parts.push('# Components');
  const categories = [
    { title: 'Basic Components', names: basicComponents },
    { title: 'Intentions', names: intentions },
    { title: 'Data Displays', names: dataDisplays },
    { title: 'Utilities', names: utilities }
  ];
  for (const { title, names } of categories) {
    parts.push(`## ${title}`);
    for (const name of names.sort()) {
      const doc = docs.find(d => d.name === name)!;
      parts.push(`### ${name}`);
      parts.push(formatComponentDocumentation(doc, 4));
    }
  }
  return parts.join('\n\n');
}

const allDocs = scanComponentDocs('packages/poml');
writeFileSync('packages/poml/assets/componentDocs.json', JSON.stringify(allDocs, null, 2));
writeFileSync('docs/components.md', docsToMarkdown(allDocs));
