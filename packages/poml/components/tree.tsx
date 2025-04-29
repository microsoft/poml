import * as React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { PropsSyntaxBase, computeSyntaxContext, List, ListItem, Text, Header, Code, SubContent, Object } from "poml/essentials";
import { component, expandRelative } from 'poml/base';
import { Markup, Serialize } from 'poml/presentation';

export interface TreeItemData {
  name: string;
  value?: string;  // Content value for the item
  children?: TreeItemData[];
}

export interface TreeProps extends PropsSyntaxBase {
  items: TreeItemData[];
  showContent?: boolean;
}

// TODO: explain the format with an example
function renderAsHeaderContentTree(items: TreeItemData[], parentPath = '', showContent: boolean = false): React.ReactNode[] {
  return items.map((item, index) => {
    const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;
    const hasContent = item.value && showContent;
    
    const elements: React.ReactNode[] = [
      <Header key={`header-${index}`}>{currentPath}</Header>
    ];
    
    if (hasContent) {
      const pathExtension = path.extname(item.name).toLowerCase();
      const lang = pathExtension.length > 0 ? pathExtension.slice(1) : undefined;
      elements.push(<Code key={`content-${index}`} lang={lang}>{item.value}</Code>);
    }
    
    if (item.children && item.children.length > 0) {
      elements.push(<SubContent>{renderAsHeaderContentTree(item.children, currentPath, showContent)}</SubContent>);
    }
    
    return elements;
  });
}

// TODO: explain  the format with an example
function renderAsNestedList(items: TreeItemData[], depth = 0): React.ReactNode {
  return (
    <List>
      {items.map((item, index) => (
        <ListItem key={`item-${index}`}>
          {item.name}
          {item.children && item.children.length > 0 && renderAsNestedList(item.children, depth + 1)}
        </ListItem>
      ))}
    </List>
  );
}

// TODO: explain  the format with an example
function renderAsPureTextContents(items: TreeItemData[], parentPath = ''): string {
  return items.map(item => {
    const currentPath = parentPath ? `${parentPath}/${item.name}` : item.name;
    const result: string[] = [];
    result.push(currentPath);
    
    if (item.value) {
      result.push(item.value.split('\n').map(line => `  ${line}`).join('\n'));
    }
    
    if (item.children && item.children.length > 0) {
      result.push(renderAsPureTextContents(item.children, currentPath));
    }
    
    return result;
  }).flat(Infinity).join('\n');
}

// TODO: explain  the format with an example
function renderWithBoxDrawings(items: TreeItemData[], prefix = '', isLast = true): string {
  let result = '';
  // FIXME: this is not correct, the top level should not have a prefix
  
  items.forEach((item, index) => {
    const isLastItem = index === items.length - 1;
    const connector = isLastItem ? '└─' : '├─';
    const line = `${prefix}${connector} ${item.name}`;
    result += line + '\n';
    
    if (item.value) {
      const valuePrefix = isLastItem ? '   └─ ' : '│  └─ ';
      result += `${prefix}${valuePrefix}${item.value}\n`;
    }
    
    if (item.children && item.children.length > 0) {
      const newPrefix = `${prefix}${isLastItem ? '   ' : '│  '}`;
      result += renderTextTree(item.children, prefix + (isLastItem ? '   ' : '│  '), isLastItem);
    }
  });
  
  return result;
}

// Function to convert tree items to a nested object for JSON/YAML output
function treeItemsToObject(items: TreeItemData[], showContent: boolean = false): any {
  return items.reduce((obj, item) => {
    if (item.children && item.children.length > 0) {
      obj[item.name] = treeItemsToObject(item.children, showContent);
    } else if (item.value && showContent) {
      obj[item.name] = item.value;
    } else {
      obj[item.name] = {};
    }
    return obj;
  }, {} as any);
}

/**
 * Renders a tree structure in various formats.
 * 
 * @param {'markdown'|'html'|'json'|'text'|'xml'} syntax - The output syntax to use for rendering the tree
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
  const { items, showContent, ...others }  = props;
  if (presentation === 'serialize') {
    const object = treeItemsToObject(items, showContent);
    return <Object data={object} {...others} />;
  } else if (presentation === 'free') {
    if (showContent) {
      const pureText = renderAsPureTextContents(items);
      return <Text whiteSpace="pre" {...others}>{pureText}</Text>;
    } else {
      const boxDrawings = renderWithBoxDrawings(items);
      return <Text whiteSpace="pre" {...others}>{boxDrawings}</Text>;
    }
  } else {
    if (showContent) {
      return <>{renderAsHeaderContentTree(items, '', showContent)}</>;
    } else {
      return (
        <List {...others}>
          {renderAsNestedList(items)}
        </List>
      );
    }
  }
});

export interface FolderProps extends PropsSyntaxBase {
  src?: string;
  data?: TreeItemData[];
  filter?: string | RegExp;
  maxDepth?: number;
  showContent?: boolean;
}

function readDirectoryToTreeItems(
  dirPath: string, 
  maxDepth: number = 3, 
  currentDepth: number = 0, 
  filter?: RegExp
): TreeItemData {
  const name = path.basename(dirPath);
  
  if (currentDepth >= maxDepth) {
    return { name };
  }
  
  try {
    const stats = fs.statSync(dirPath);
    
    if (!stats.isDirectory()) {
      return { name };
    }
    
    const children: TreeItemData[] = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true }).sort((a, b) => {
      // Directories first, then files
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      
      // Apply filter if present
      if (filter && !filter.test(entry.name)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        children.push(readDirectoryToTreeItems(entryPath, maxDepth, currentDepth + 1, filter));
      } else {
        children.push({ name: entry.name });
      }
    }
    
    return {
      name,
      children: children.length > 0 ? children : undefined
    };
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return { name };
  }
}

/**
 * Displays a directory structure as a tree.
 *
 * @param {'markdown'|'html'|'json'|'text'|'xml'} syntax - The output syntax of the content.
 * @param {string} src - The source directory path to display.
 * @param {TreeItemData[]} data - Alternative to src, directly provide tree data structure.
 * @param {string|RegExp} filter - A regular expression to filter files and directories.
 * @param {number} maxDepth - Maximum depth of directory traversal. Default is 3.
 * @param {boolean} showContent - Whether to show file contents.
 * 
 * @example
 * To display a directory structure with a filter for Python files:
 * ```xml
 * <folder src="project_dir" filter=".*\.py$" maxDepth="3" />
 * ```
 */
export const Folder = component('Folder')((props: FolderProps) => {
  const { src, data, filter, maxDepth = 3, ...others } = props;
  
  let treeData: TreeItemData[] = [];
  
  if (data) {
    treeData = data;
  } else if (src) {
    const resolvedPath = expandRelative(src);
    const filterRegex = filter ? (typeof filter === 'string' ? new RegExp(filter) : filter) : undefined;
    
    try {
      const folderData = readDirectoryToTreeItems(resolvedPath, maxDepth, 0, filterRegex);
      // Skip the root folder name, just show its contents
      treeData = folderData.children || [];
      
      // Add the root name as the first item
      treeData = [{ name: path.basename(resolvedPath), children: treeData }];
    } catch (error) {
      console.error(`Error processing folder ${src}:`, error);
      return <Text>Error loading folder: {src}</Text>;
    }
  } else {
    return <Text>Either src or data must be provided</Text>;
  }
  
  // FIXME: the max depth should be handled when reading the directory instead of inside.
  return <Tree items={treeData} maxDepth={maxDepth} {...others} />;
});
