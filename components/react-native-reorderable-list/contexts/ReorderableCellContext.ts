import React from 'react';

import type {SharedValue} from 'react-native-reanimated';

import { NodeType} from '../types';

interface ReorderableCellContextData {
  index: number;
  collapseHandler: () => void;
  isCollapsed: SharedValue<boolean>;
  isCollapsedChildren: SharedValue<boolean>;
  dragHandler: () => void;
  draggedIndex: SharedValue<number>;
  draggedIndices: SharedValue<number[]>;
  isActive: boolean;
  isActiveChildren: boolean;
   nodeType: NodeType;
}

export const ReorderableCellContext = React.createContext<
  ReorderableCellContextData | undefined
>(undefined);
