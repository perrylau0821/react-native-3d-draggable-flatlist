import React from 'react';

import type {SharedValue} from 'react-native-reanimated';

interface ReorderableCellContextData {
  index: number;
  dragHandler: () => void;
  draggedIndex: SharedValue<number>;
  draggedIndices: SharedValue<number[]>;
  isActive: boolean;
  isActiveChildren: boolean;
}

export const ReorderableCellContext = React.createContext<
  ReorderableCellContextData | undefined
>(undefined);
