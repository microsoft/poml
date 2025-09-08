import * as React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import {
  PropsSyntaxBase,
  computeSyntaxContext,
  List,
  ListItem,
  Text,
  Header,
  Code,
  SubContent,
  DataObject,
} from 'poml/essentials';
import { component, expandRelative } from 'poml/base';

export interface TreeItemData {
  name: string;
  value?: string; // Content value for the item
  children?: TreeItemData[];
}

export interface TreeProps extends PropsSyntaxBase {
  items: TreeItemData[];
  showContent?: boolean;
}

// FIXME: The comment is not in the right format due to the parser limitation
/*
 * # Project
 *
 * ## Project/src
 *
 * ###  Project/src/index.js
 *
 * ```js
 * console.log("hello")
 * ```
 *
 * ### Project/package.json
 *
 * ```json
 * { "name": "project" }
 * ```
 **/
function treeToHeaderContentTree(
  items: TreeItemData[],
  parentPath = '',
  showContent: boolean = false,
): React.ReactNode[] {
  return items.map((item, index) => {
    const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;
    const hasContent = item.value && showContent;

    const elements: React.ReactNode[] = [<Header key={`header-${index}`}>{currentPath}</Header>];

    if (hasContent) {
      const pathExtension = path.extname(item.name).toLowerCase();
      const lang = pathExtension.length > 0 ? pathExtension.slice(1) : undefined;
      elements.push(
        <Code key={`content-${index}`} lang={lang} inline={false} whiteSpace='pre'>
          {item.value}
        </Code>,
      );
    }

    if (item.children && item.children.length > 0) {
      elements.push(<SubContent>{treeToHeaderContentTree(item.children, currentPath, showContent)}</SubContent>);
    }

    return elements;
  });
}

/*
 * Example:
 * - Project
 *   - src
 *     - index.js
 *   - package.json
 **/
function treeToNestedList(items: TreeItemData[], depth = 0): React.ReactNode {
  return (
    <List blankLine={false}>
      {items.map((item, index) => (
        <ListItem key={`item-${index}`}>
          {item.name}
          {item.children && item.children.length > 0 && treeToNestedList(item.children, depth + 1)}
        </ListItem>
      ))}
    </List>
  );
}

/*
 * Example:
 * .git/
 * .git/branches/
 * .git/config
 * ==> start .git/config <==
 * [core]
 *         repositoryformatversion = 0
 *         filemode = true
 *         bare = false
 *         logallrefupdates = true
 * ==> end .git/config <==
 *
 * Reference: https://askubuntu.com/questions/1095947/show-tree-of-directory-with-files-content
 */
function treeToPureTextContents(items: TreeItemData[], parentPath = ''): string {
  return items
    .map((item) => {
      const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      const result: string[] = [];

      // Always output path
      result.push(currentPath);

      // If the item has content, format with start/end markers
      if (item.value) {
        result.push(`==> start ${currentPath} <==`);
        result.push(item.value);
        result.push(`==> end ${currentPath} <==`);
        result.push(''); // Add an extra blank line after content
      }

      if (item.children && item.children.length > 0) {
        result.push(treeToPureTextContents(item.children, currentPath));
      }

      return result;
    })
    .flat(Infinity)
    .join('\n');
}

/*
 * Example:
 * Project
 * ├── src
 * │   └── index.js
 * └── package.json
 **/
function treeToBoxDrawings(items: TreeItemData[], prefix = '', isRoot = true): string {
  const lines: string[] = [];

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;

    if (isRoot && !item.children) {
      // This is a root-level item without children (category header)
      lines.push(`${item.name}`);
    } else if (isRoot) {
      // This is a root-level item with children (category header)
      lines.push(`${item.name}`);

      if (item.children && item.children.length > 0) {
        // Process children with box drawing characters
        const childPrefix = '';
        lines.push(treeToBoxDrawings(item.children, childPrefix, false));
      }
    } else {
      // This is a non-root item, add box drawing characters
      lines.push(`${prefix}${isLast ? '└── ' : '├── '}${item.name}`);

      if (item.children && item.children.length > 0) {
        // Calculate new prefix for children
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        lines.push(treeToBoxDrawings(item.children, childPrefix, false));
      }
    }
  });

  return lines.join('\n');
}

// Function to convert tree items to a nested object for JSON/YAML output
function treeItemsToObject(items: TreeItemData[], showContent: boolean = false): any {
  return items.reduce((obj, item) => {
    if (item.children && item.children.length > 0) {
      obj[item.name] = treeItemsToObject(item.children, showContent);
    } else if (item.value && showContent) {
      obj[item.name] = item.value;
    } else {
      obj[item.name] = null;
    }
    return obj;
  }, {} as any);
}

/**
 * Renders a tree structure in various formats.
 *
 * @param {'markdown'|'html'|'json'|'yaml'|'text'|'xml'} syntax - The output syntax to use for rendering the tree
 * @param {TreeItemData[]} items - Array of tree items to render
 * @param {boolean} showContent - Whether to show content values of tree items
 *
 * @example
 * ```xml
 * <Tree items={treeData} syntax="markdown" showContent={true} />
 * ```
 */
export const Tree = component('Tree')((props: TreeProps) => {
  const presentation = computeSyntaxContext(props);
  const { items, showContent, ...others } = props;
  if (presentation === 'serialize') {
    const object = treeItemsToObject(items, showContent);
    return <DataObject data={object} {...others} />;
  } else if (presentation === 'free') {
    if (showContent) {
      const pureText = treeToPureTextContents(items);
      return (
        <Text whiteSpace='pre' {...others}>
          {pureText}
        </Text>
      );
    } else {
      const boxDrawings = treeToBoxDrawings(items);
      return (
        <Text whiteSpace='pre' {...others}>
          {boxDrawings}
        </Text>
      );
    }
  } else {
    if (showContent) {
      return <Text {...others}>{treeToHeaderContentTree(items, '', showContent)}</Text>;
    } else {
      return <List {...others}>{treeToNestedList(items)}</List>;
    }
  }
});

function readDirectoryToTreeItems(
  dirPath: string,
  maxDepth: number,
  currentDepth: number,
  showContent: boolean,
  filter?: RegExp,
): TreeItemData | null {
  const name = path.basename(dirPath);

  if (currentDepth >= maxDepth) {
    return { name };
  }

  try {
    const stats = fs.statSync(dirPath);

    if (!stats.isDirectory()) {
      // For files, apply filter immediately
      if (filter && !filter.test(name)) {
        return null;
      }
      return { name };
    }

    // For directories, process children first
    const children: TreeItemData[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true }).sort((a, b) => {
      // Directories first, then files
      if (a.isDirectory() && !b.isDirectory()) {
        return -1;
      }
      if (!a.isDirectory() && b.isDirectory()) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // For directories, recursively process and check if it has any matching children
        const directoryItem = readDirectoryToTreeItems(entryPath, maxDepth, currentDepth + 1, showContent, filter);
        if (directoryItem && (directoryItem.children || !filter)) {
          children.push(directoryItem);
        }
      } else {
        // For files, check if they match the filter
        if (filter && !filter.test(entry.name)) {
          continue;
        }

        if (showContent) {
          // TODO: support other file types.
          const content = fs.readFileSync(entryPath, 'utf-8');
          children.push({ name: entry.name, value: content });
        } else {
          children.push({ name: entry.name });
        }
      }
    }

    // If we have a filter and no children matched, return null
    if (filter && children.length === 0) {
      return null;
    }

    return {
      name,
      children: children.length > 0 ? children : undefined,
    };
  } catch (error) {
    throw new Error(`Error reading directory ${dirPath}: ${error}`);
  }
}

export interface FolderProps extends PropsSyntaxBase {
  src?: string;
  data?: TreeItemData[];
  filter?: string | RegExp;
  maxDepth?: number;
  showContent?: boolean;
}

/**
 * Displays a directory structure as a tree.
 *
 * @param {'markdown'|'html'|'json'|'yaml'|'text'|'xml'} syntax - The output syntax of the content.
 * @param {string} src - The source directory path to display.
 * @param {TreeItemData[]} data - Alternative to src, directly provide tree data structure.
 * @param {RegExp|string} filter - A regular expression to filter files.
 *   The regex is applied to the folder names and file names (not the full path).
 *   Directories are included by default unless all of their nested content is filtered out.
 *   When filter is on, empty directories will not be shown.
 * @param {number} maxDepth - Maximum depth of directory traversal. Default is 3.
 * @param {boolean} showContent - Whether to show file contents. Default is false.
 *
 * @example
 * To display a directory structure with a filter for Python files:
 * ```xml
 * <folder src="project_dir" filter=".*\.py$" maxDepth="3" />
 * ```
 */
export const Folder = component('Folder')((props: FolderProps) => {
  const { src, data, filter, showContent, maxDepth = 3, ...others } = props;

  let treeData: TreeItemData[] = [];

  if (data) {
    treeData = data;
  } else if (src) {
    const resolvedPath = expandRelative(src);
    const filterRegex = filter ? (typeof filter === 'string' ? new RegExp(filter) : filter) : undefined;

    try {
      const folderData = readDirectoryToTreeItems(resolvedPath, maxDepth ?? 3, 0, showContent ?? false, filterRegex);

      if (folderData) {
        // If we got results, add them to the tree
        treeData = folderData.children || [];
        // Add the root name as the first item
        treeData = [{ name: path.basename(resolvedPath), children: treeData }];
      } else {
        // If we got null result (everything was filtered out), return empty tree
        treeData = [{ name: path.basename(resolvedPath) }];
      }
    } catch (error) {
      throw new Error(`Error processing folder ${src}: ${error}`);
    }
  } else {
    throw new Error('Either src or data must be provided');
  }

  return <Tree items={treeData} showContent={showContent} {...others} />;
});
