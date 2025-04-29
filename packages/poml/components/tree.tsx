import * as React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { PropsSyntaxBase, computeSyntaxContext, List, ListItem, Text } from "poml/essentials";
import { component, expandRelative } from 'poml/base';

export interface TreeItemData {
  name: string;
  children?: TreeItemData[];
}

export const Tree = ({ children, ...props }: React.PropsWithChildren<PropsSyntaxBase>) => {
  const listProps = { ...props };
  return (
    <List {...listProps}>
      {children}
    </List>
  );
}

export const TreeItem = ({ name, children, ...props }: React.PropsWithChildren<{name: string} & PropsSyntaxBase>) => {
  const itemProps = { ...props };
  return (
    <ListItem {...itemProps}>
      {name}
      {children && <Tree>{children}</Tree>}
    </ListItem>
  );
};

export const SimpleTree = ({items, maxDepth = 3, ...props}: { items: TreeItemData[], maxDepth?: number } & PropsSyntaxBase) => {
  const itemToItemView = (item: TreeItemData, prefix: string, depth: number): React.ReactNode => {
    if (depth >= maxDepth) {
      return null;
    }
    const children = item.children?.map((child, index) => itemToItemView(child, `${prefix}.${index}`, depth + 1));
    return (
      <TreeItem key={prefix} name={item.name} {...props}>
        {children}
      </TreeItem>
    );
  };
  return (
    <Tree {...props}>
      {items.map((item, index) => itemToItemView(item, `${index}`, 0))}
    </Tree>
  )
};

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
 * @param {string} src - The source directory path to display.
 * @param {TreeItemData[]} data - Alternative to src, directly provide tree data structure.
 * @param {string|RegExp} filter - A regular expression to filter files and directories.
 * @param {number} maxDepth - Maximum depth of directory traversal. Default is 3.
 * @param {boolean} showContent - Whether to show file contents. Not implemented yet.
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
  
  return <SimpleTree items={treeData} maxDepth={maxDepth} {...others} />;
});
