
export type NodeType = 'root' | 'branch' | 'leaf';

export interface TreeItem {
  id: string;
  parentId: string | null;
  [key: string]: any;
}

export const getNodeType = <T extends TreeItem>(item: T, data: T[]): NodeType => {
  const hasChildren = data.some(i => i.parentId === item.id);
  const hasParent = item.parentId !== null;
  
  if (!hasParent) return 'root';
  if (hasChildren) return 'branch';
  return 'leaf';
};
