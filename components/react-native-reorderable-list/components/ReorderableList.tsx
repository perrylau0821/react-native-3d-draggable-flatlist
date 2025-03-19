import React, {forwardRef} from 'react';
import {FlatList} from 'react-native';

import {ReorderableListCore} from './ReorderableListCore';
import type {ReorderableListProps} from '../types';

const ReorderableListWithRef = <T,>(
  {scrollEnabled = true, ...rest}: ReorderableListProps<T>,
  ref: React.Ref<FlatList<T>>,
) => (
  <ReorderableListCore
    {...rest}
    ref={ref}
    scrollEnabled={scrollEnabled}
    initialScrollViewScrollEnabled={true}
    scrollable={true}
    scrollViewContainerRef={undefined}
    scrollViewScrollOffsetY={undefined}
    scrollViewHeightY={undefined}
    outerScrollGesture={undefined}
    scrollViewScrollEnabled={undefined}
  />
);

export const ReorderableList = forwardRef(ReorderableListWithRef) as <T>(
  props: ReorderableListProps<T> & React.RefAttributes<FlatList<T>>,
) => JSX.Element;
