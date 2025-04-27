// import * as React from 'react';
// import { List, Item, BlockProps } from '../poml';

import { PropsSyntaxBase } from "poml/essentials";

export interface TreeItemData {
  name: string;
  children?: TreeItemData[];
}

// export interface SimpleTreeProps extends BlockProps {
//   items: TreeItemData[];
//   maxDepth?: number;
// }

// export interface TreeProps extends BlockProps {
//   presentation: 'list' | 'json'
// }

// export interface TreeItemProps extends BlockProps {
//   name: string;
// }

// export const Tree = ({ children, ...props }: React.PropsWithChildren<BlockProps>) => {
//   const listProps = { ...props };
//   listProps.stub = listProps.stub || 'tree';
//   return (
//     <List {...listProps}>
//       {children}
//     </List>
//   );
// }

// export const TreeItem = ({ name, children, ...props }: React.PropsWithChildren<TreeItemProps>) => {
//   const itemProps = { ...props };
//   itemProps.stub = itemProps.stub || 'tree-item';
//   return (
//     <Item {...itemProps}>
//       {name}
//       {children && <Tree>{children}</Tree>}
//     </Item>
//   );
// };


// export const SimpleTree = ({items, maxDepth = 3, ...props}: SimpleTreeProps) => {
//   const itemToItemView = (item: TreeItemData, prefix: string, depth: number): React.ReactNode => {
//     if (depth >= maxDepth) {
//       return null;
//     }
//     const children = item.children?.map((child, index) => itemToItemView(child, `${prefix}.${index}`, depth + 1));
//     return (
//       <TreeItem key={prefix} name={item.name}>
//         {children}
//       </TreeItem>
//     );
//   };
//   return (
//     <Tree>
//       {items.map((item, index) => itemToItemView(item, `${index}`, 0))}
//     </Tree>
//   )
// };


export interface FolderProps extends PropsSyntaxBase {
  src?: string;
  data?: TreeItemData[];
  filter?: string | RegExp;
  maxDepth?: number;
  showContent?: boolean;
}

