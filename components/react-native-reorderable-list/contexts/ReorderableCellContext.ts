import React from 'react';

import type {SharedValue} from 'react-native-reanimated';

interface ReorderableCellContextData {
  index: number;
  dragHandler: () => void;
  draggedIndex: SharedValue<number>;
  isActive: boolean;
}

export const ReorderableCellContext = React.createContext<
  ReorderableCellContextData | undefined
>(undefined);
