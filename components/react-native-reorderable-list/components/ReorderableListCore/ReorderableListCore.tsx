import React, {useCallback, useMemo} from 'react';
import {
  CellRendererProps,
  FlatList,
  Platform,
  ScrollView,
} from 'react-native';

import {
  Gesture,
  GestureDetector,
  NativeGesture,
} from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useComposedEventHandler,
} from 'react-native-reanimated';

import {AUTOSCROLL_CONFIG} from './autoscrollConfig';
import {useReorderableListCore} from './useReorderableListCore';
import {ReorderableListContext} from '../../contexts';
import type {ReorderableListProps} from '../../types';
import {ReorderableListCell} from '../ReorderableListCell';

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList,
) as unknown as <T>(
  props: FlatListProps<T> & {ref?: React.Ref<FlatList<T>>},
) => React.ReactElement;

interface ReorderableListCoreProps<T> extends ReorderableListProps<T> {
  scrollViewContainerRef: React.RefObject<ScrollView> | undefined;
  scrollViewHeightY: SharedValue<number> | undefined;
  scrollViewScrollOffsetY: SharedValue<number> | undefined;
  scrollViewScrollEnabled: SharedValue<boolean> | undefined;
  outerScrollGesture: NativeGesture | undefined;
  initialScrollViewScrollEnabled: boolean | undefined;
  scrollable: boolean | undefined;
  scrollEnabled: boolean | undefined;
}

const ReorderableListCore = <T,>(
  {
    autoscrollThreshold = 0.1,
    autoscrollThresholdOffset,
    autoscrollSpeedScale = 1,
    autoscrollDelay = AUTOSCROLL_CONFIG.delay,
    autoscrollActivationDelta = 5,
    animationDuration = 200,
    onLayout,
    onReorder,
    onScroll,
    onDragStart,
    onDragEnd,
    onIndexChange,
    scrollViewContainerRef,
    scrollViewHeightY,
    scrollViewScrollOffsetY,
    scrollViewScrollEnabled,
    initialScrollViewScrollEnabled,
    scrollable,
    outerScrollGesture,
    cellAnimations,
    shouldUpdateActiveItem,
    panEnabled = true,
    panActivateAfterLongPress,
    depthExtractor,
    ...rest
  }: ReorderableListCoreProps<T>,
  ref: React.ForwardedRef<FlatList<T>>,
) => {
  const {
    gestureHandler,
    handleScroll,
    handleFlatListLayout,
    handleRef,
    startDrag,
    listContextValue,
    itemOffset,
    itemHeight,
    dragY,
    draggedIndex,
    draggedIndices,
    duration,
  } = useReorderableListCore({
    ref,
    autoscrollThreshold,
    autoscrollThresholdOffset,
    autoscrollSpeedScale,
    autoscrollDelay,
    autoscrollActivationDelta,
    animationDuration,
    onLayout,
    onReorder,
    onDragStart,
    onDragEnd,
    onIndexChange,
    scrollViewContainerRef,
    scrollViewHeightY,
    scrollViewScrollOffsetY,
    scrollViewScrollEnabled,
    initialScrollEnabled:
      typeof rest.scrollEnabled === 'undefined' ? true : rest.scrollEnabled,
    initialScrollViewScrollEnabled:
      typeof initialScrollViewScrollEnabled === 'undefined'
        ? true
        : initialScrollViewScrollEnabled,
    nestedScrollable: scrollable,
    cellAnimations,
    shouldUpdateActiveItem,
    panEnabled,
    panActivateAfterLongPress,
    depthExtractor,
    data:rest.data
  });

  const combinedGesture = useMemo(() => {
    if (outerScrollGesture && !(Platform.OS === 'android' && scrollable)) {
      return Gesture.Simultaneous(outerScrollGesture, gestureHandler);
    }
    return gestureHandler;
  }, [scrollable, outerScrollGesture, gestureHandler]);

  const composedScrollHandler = useComposedEventHandler([
    handleScroll,
    onScroll || null,
  ]);

  const renderAnimatedCell = useCallback(
    ({item, cellKey, ...props}: CellRendererProps<T>) => (
      <ReorderableListCell
        {...props}
        item={item}
        data={rest.data}
        key={`${cellKey}+${props.index}`}
        itemOffset={itemOffset}
        itemHeight={itemHeight}
        dragY={dragY}
        draggedIndex={draggedIndex}
        draggedIndices={draggedIndices}
        animationDuration={duration}
        startDrag={startDrag}
      />
    ),
    [itemOffset, itemHeight, dragY, draggedIndex, draggedIndices, duration, startDrag],
  );

  return (
    <ReorderableListContext.Provider value={listContextValue}>
      <GestureDetector gesture={combinedGesture}>
        <AnimatedFlatList
          {...rest}
          ref={handleRef}
          CellRendererComponent={renderAnimatedCell}
          onLayout={handleFlatListLayout}
          onScroll={composedScrollHandler}
          scrollEventThrottle={1}
          horizontal={false}
          removeClippedSubviews={false}
          numColumns={1}
        />
      </GestureDetector>
    </ReorderableListContext.Provider>
  );
};

const MemoizedReorderableListCore = React.memo(
  React.forwardRef(ReorderableListCore),
) as <T>(
  props: ReorderableListCoreProps<T> & {
    ref?: React.ForwardedRef<FlatList<T> | null>;
  },
) => React.ReactElement;

export {MemoizedReorderableListCore as ReorderableListCore};