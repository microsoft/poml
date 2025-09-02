import 'poml';
import { ComponentSpec, Parameter } from 'poml/base';

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { formatComponentDocumentation } from './documentFormatter';

const checkMode = process.argv.includes('--check');
let hasChanges = false;

function writeOrCheck(filePath: string, content: string) {
  let existing: string | undefined;
  try {
    existing = readFileSync(filePath, 'utf8');
  } catch {
    existing = undefined;
  }

  if (existing !== content) {
    if (checkMode) {
      console.error(`${filePath} is out of date.`);
      hasChanges = true;
    } else {
      writeFileSync(filePath, content);
      console.log(`Updated ${filePath}`);
    }
  }
}

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
      required: false,
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
    baseComponents,
  };
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
    const names = components.map((c) => c.name!);
    allComments.push(...components);
    if (filePath.endsWith('essentials.tsx') || filePath.endsWith('utils.tsx')) {
      basicComponents.push(
        ...names.filter((name) => name !== 'Image' && name !== 'Object' && !name.startsWith('Tool')),
      );
      dataDisplays.push(...names.filter((name) => name === 'Image' || name === 'Object'));
      utilities.push(...names.filter((name) => name.startsWith('Tool')));
    } else if (filePath.endsWith('instructions.tsx')) {
      intentions.push(...names);
    } else if (filePath.endsWith('message.tsx')) {
      utilities.push(...names);
    } else {
      dataDisplays.push(...names);
    }
  }
  return allComments;
}

function docsToMarkdown(docs: ComponentSpec[]) {
  const parts: string[] = [];
  parts.push('# Components');
  const categories = [
    { title: 'Basic Components', names: basicComponents },
    { title: 'Intentions', names: intentions },
    { title: 'Data Displays', names: dataDisplays },
    { title: 'Utilities', names: utilities },
  ];
  for (const { title, names } of categories) {
    parts.push(`## ${title}`);
    for (const name of names.sort()) {
      const doc = docs.find((d) => d.name === name)!;
      parts.push(`### ${name}`);
      parts.push(formatComponentDocumentation(doc, 4));
    }
  }
  return parts.join('\n\n');
}

function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') // Handles cases like "XMLFile" -> "XML_File"
    .replace(/([a-z\d])([A-Z])/g, '$1_$2') // Handles "camelCase" -> "camel_Case"
    .toLowerCase(); // Converts to lowercase: "XML_File" -> "xml_file"
}

function getPythonType(jsonType: string, paramName: string): string {
  const lcJsonType = jsonType.toLowerCase();
  switch (lcJsonType) {
    case 'string':
      return 'str';
    case 'boolean':
      return 'bool';
    case 'buffer':
      return 'bytes';
    case 'number':
      // Heuristic for int vs float based on common parameter names
      if (
        paramName.includes('max') ||
        paramName.includes('count') ||
        paramName.includes('depth') ||
        paramName.endsWith('Index')
      ) {
        return 'int';
      }
      return 'float';
    case 'object':
      return 'Any'; // Could be Dict[str, Any]
    case 'regexp':
      return 'str'; // Python uses strings for regex patterns
    default:
      if (jsonType.endsWith('[]')) {
        // Handles array types like TreeItemData[]
        return 'List[Any]'; // Generic list type
      }
      // For unknown or complex non-array types (e.g., a specific object schema name)
      return 'Any';
  }
}

function generatePythonMethod(tag: ComponentSpec): string {
  const methodName = camelToSnake(tag.name!);
  let paramsSignatureList: string[] = ['        self'];
  let argsDocstring = '';
  const callArgsList: string[] = [`tag_name="${tag.name}"`];

  tag.params.forEach((param) => {
    const paramName = param.name; // Use original JSON name for Python parameter
    const pythonType = getPythonType(param.type, paramName);
    const typeHint = `Optional[${pythonType}]`;

    paramsSignatureList.push(`        ${paramName}: ${typeHint} = None`);
    callArgsList.push(`${paramName}=${paramName}`);

    let paramDesc = param.description.replace(/\n/g, '\n                ');
    if (param.defaultValue !== undefined) {
      const defValStr = typeof param.defaultValue === 'string' ? `"${param.defaultValue}"` : param.defaultValue;
      paramDesc += ` Default is \`${defValStr}\`.`;
    }
    if (param.choices && param.choices.length > 0) {
      paramDesc += ` Choices: ${param.choices.map((c) => `\`${JSON.stringify(c)}\``).join(', ')}.`;
    }
    argsDocstring += `            ${paramName} (${typeHint}): ${paramDesc}\n`;
  });

  paramsSignatureList.push('        **kwargs: Any');

  const paramsString = paramsSignatureList.join(',\n');

  let docstring = `"""${tag.description.replace(/\n/g, '\n        ')}\n\n`;
  if (argsDocstring) {
    docstring += `        Args:\n${argsDocstring}`;
  }
  if (tag.example) {
    const exampleIndented = tag.example
      .replace(/\\/g, '\\\\') // Escape backslashes for string literal
      .replace(/"""/g, '\\"\\"\\"') // Escape triple quotes if any in example
      .replace(/\n/g, '\n            ');
    docstring += `\n        Example:\n            ${exampleIndented}\n`;
  }
  docstring += `        """`;

  const methodBody = `return self.tag(
            ${callArgsList.join(',\n            ')},
            **kwargs,
        )`;

  return `
    def ${methodName}(
${paramsString},
    ):
        ${docstring}
        ${methodBody}
`;
}

function generatePythonFile(jsonData: ComponentSpec[]): string {
  let pythonCode = `# fmt: off
# This file is auto-generated from component documentation.
# Do not edit manually. Run \`npm run build-comment\` to regenerate.

from typing import Optional, Any, Union, List, Dict  # isort:skip
# from numbers import Number # For more specific number types if needed

class _TagLib:

    def tag(self, tag_name: str, **kwargs: Any) -> Any:
        """Helper method to create a tag with the given name and attributes.
        Implemented by subclasses.
        """
        raise NotImplementedError("This method should be implemented by subclasses.")
`;

  jsonData.forEach((tag) => {
    if (!tag.name) {
      console.warn('Skipping tag with no name:', tag);
      return;
    }
    pythonCode += generatePythonMethod(tag);
  });

  return pythonCode;
}

const allDocs = scanComponentDocs('packages/poml');
const pythonCode = generatePythonFile(allDocs);
writeOrCheck('packages/poml/assets/componentDocs.json', JSON.stringify(allDocs, null, 2));
writeOrCheck('docs/language/components.md', docsToMarkdown(allDocs));
writeOrCheck('python/poml/_tags.py', pythonCode);

if (checkMode) {
  if (hasChanges) {
    console.error('Component documentation is out of date. Run `npm run generate-component-spec` to update.');
    process.exit(1);
  } else {
    console.log('Component documentation is up to date.');
  }
} else {
  console.log('Component documentation generated successfully!');
}
