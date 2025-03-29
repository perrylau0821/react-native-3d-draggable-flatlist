import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  unstable_batchedUpdates,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import {
  Gesture,
  GestureUpdateEvent,
  PanGestureHandlerEventPayload,
  State,
} from 'react-native-gesture-handler';
import Animated, {
  AnimatedRef,
  Easing,
  SharedValue,
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  OPACITY_ANIMATION_CONFIG_DEFAULT,
  SCALE_ANIMATION_CONFIG_DEFAULT,
} from './animationDefaults';
import {AUTOSCROLL_CONFIG} from './autoscrollConfig';
import {
  ReorderableListCellAnimations,
  ReorderableListDragEndEvent,
  ReorderableListDragStartEvent,
  ReorderableListIndexChangeEvent,
  ReorderableListState,
} from '../../types';
import type {ReorderableListReorderEvent} from '../../types';

const version = React.version.split('.');
const hasAutomaticBatching = version.length
  ? parseInt(version[0], 10) >= 18
  : false;

interface UseReorderableListCoreArgs<T> {
  ref: React.ForwardedRef<FlatList<T>>;
  autoscrollThreshold: number;
  autoscrollThresholdOffset: {top?: number; bottom?: number} | undefined;
  autoscrollSpeedScale: number;
  autoscrollDelay: number;
  autoscrollActivationDelta: number;
  animationDuration: number;
  onReorder: (event: ReorderableListReorderEvent) => void;
  onDragStart?: (event: ReorderableListDragStartEvent) => void;
  onDragEnd?: (event: ReorderableListDragEndEvent) => void;
  onIndexChange?: (event: ReorderableListIndexChangeEvent) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  scrollViewContainerRef: React.RefObject<ScrollView> | undefined;
  scrollViewHeightY: SharedValue<number> | undefined;
  scrollViewScrollOffsetY: SharedValue<number> | undefined;
  scrollViewScrollEnabled: SharedValue<boolean> | undefined;
  initialScrollEnabled: boolean | undefined;
  initialScrollViewScrollEnabled: boolean | undefined;
  nestedScrollable: boolean | undefined;
  cellAnimations: ReorderableListCellAnimations | undefined;
  shouldUpdateActiveItem: boolean | undefined;
  panEnabled: boolean;
  panActivateAfterLongPress: number | undefined;
  depthExtractor?: (item: T) => number;
  data: T[];
}

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

const triggerSelectionHaptic = () => {
  if (Platform.OS !== 'web') {
     
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

export const useReorderableListCore = <T>({
  ref,
  autoscrollThreshold,
  autoscrollThresholdOffset,
  autoscrollSpeedScale,
  autoscrollDelay,
  autoscrollActivationDelta,
  animationDuration,
  onReorder,
  onDragStart,
  onDragEnd,
  onLayout,
  onIndexChange,
  scrollViewContainerRef,
  scrollViewHeightY,
  scrollViewScrollOffsetY,
  scrollViewScrollEnabled,
  initialScrollEnabled,
  initialScrollViewScrollEnabled,
  nestedScrollable,
  cellAnimations,
  shouldUpdateActiveItem,
  panActivateAfterLongPress,
  panEnabled,
  depthExtractor,
  data
}: UseReorderableListCoreArgs<T>) => {
  const flatListRef = useAnimatedRef<FlatList>();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeIndices, setActiveIndices] = useState([])
  const scrollEnabled = useSharedValue(initialScrollEnabled);
  const gestureState = useSharedValue<State>(State.UNDETERMINED);
  const currentY = useSharedValue(0);
  const currentTranslationY = useSharedValue(0);
  const currentItemDragCenterY = useSharedValue<number | null>(null);
  const startItemDragCenterY = useSharedValue<number>(0);
  const flatListScrollOffsetY = useSharedValue(0);
  const flatListHeightY = useSharedValue(0);
  const nestedFlatListPositionY = useSharedValue(0);
  const dragScrollTranslationY = useSharedValue(0);
  const dragInitialScrollOffsetY = useSharedValue(0);
  const scrollViewDragScrollTranslationY = useSharedValue(0);
  const scrollViewDragInitialScrollOffsetY = useSharedValue(0);
  const draggedHeight = useSharedValue(0);
  const itemOffset = useSharedValue<number[]>([]);
  const itemHeight = useSharedValue<number[]>([]);
  const autoscrollTrigger = useSharedValue(-1);
  const lastAutoscrollTrigger = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const dragYOffsets = useSharedValue<number[]>([]); 
  const currentIndex = useSharedValue(-1);
  const currentIndices = useSharedValue<number[]>([]); 
  const draggedIndex = useSharedValue(-1);
  const draggedIndices = useSharedValue<number[]>([]);
  const state = useSharedValue<ReorderableListState>(ReorderableListState.IDLE);
  const dragEndHandlers = useSharedValue<
    ((from: number, to: number) => void)[][]
  >([]);
  const startY = useSharedValue(0);
  const duration = useSharedValue(animationDuration);
  const scaleDefault = useSharedValue(1);
  const opacityDefault = useSharedValue(1);
  const dragDirection = useSharedValue(0);
  const lastDragDirectionPivot = useSharedValue<number | null>(null);
  const autoscrollDelta = useSharedValue(autoscrollActivationDelta);

  useEffect(() => {
    duration.value = animationDuration;
    autoscrollDelta.value = autoscrollActivationDelta;
  }, [duration, animationDuration, autoscrollDelta, autoscrollActivationDelta]);

  const listContextValue = useMemo(
    () => ({
      draggedHeight,
      currentIndex,
      currentIndices,
      draggedIndex,
      draggedIndices,
      dragEndHandlers,
      activeIndex,
      activeIndices,
      cellAnimations: {
        ...cellAnimations,
        transform:
          cellAnimations && 'transform' in cellAnimations
            ? cellAnimations.transform
            : [{scale: scaleDefault}],
        opacity:
          cellAnimations && 'opacity' in cellAnimations
            ? cellAnimations.opacity
            : opacityDefault,
      },
      depthExtractor,
      data
    }),
    [
      draggedHeight,
      currentIndex,
      currentIndices,
      draggedIndex,
      draggedIndices,
      dragEndHandlers,
      activeIndex,
      activeIndices,
      cellAnimations,
      scaleDefault,
      opacityDefault,
      depthExtractor,
      data
    ],
  );

  const setDragDirection = useCallback(
    (e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      'worklet';

      const direction = e.velocityY > 0 ? 1 : -1;
      if (direction !== dragDirection.value) {
        if (lastDragDirectionPivot.value === null) {
          lastDragDirectionPivot.value = e.absoluteY;
        } else if (
          Math.abs(e.absoluteY - lastDragDirectionPivot.value) >=
          autoscrollDelta.value
        ) {
          dragDirection.value = direction;
          lastDragDirectionPivot.value = e.absoluteY;
        }
      }
    },
    [dragDirection, lastDragDirectionPivot, autoscrollDelta],
  );

  const setCurrentItemDragCenterY = useCallback(
    (e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
      'worklet';

      if (currentItemDragCenterY.value === null) {
        if (currentIndex.value >= 0) {
          const itemCenter = itemHeight.value[currentIndex.value] * 0.5;
          const itemY =
            itemOffset.value[currentIndex.value] -
            (flatListScrollOffsetY.value +
              scrollViewDragScrollTranslationY.value);

          const value = itemY + itemCenter + e.translationY;
          startItemDragCenterY.value = value;
          currentItemDragCenterY.value = value;
        }
      } else {
        currentItemDragCenterY.value =
          startItemDragCenterY.value + e.translationY;
      }
    },
    [
      currentItemDragCenterY,
      currentIndex,
      startItemDragCenterY,
      itemOffset,
      itemHeight,
      flatListScrollOffsetY,
      scrollViewDragScrollTranslationY,
    ],
  );

  const panGestureHandler = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(e => {
          if (state.value === ReorderableListState.IDLE) {
            startY.value = e.y;
            currentY.value = e.y;
            currentTranslationY.value = e.translationY;
            dragY.value = e.translationY;
            gestureState.value = e.state;
          }
        })
        .onUpdate(e => {
          if (state.value === ReorderableListState.DRAGGED) {
            setDragDirection(e);
          }

          if (state.value !== ReorderableListState.RELEASED) {
            setCurrentItemDragCenterY(e);

            currentY.value = startY.value + e.translationY;
            currentTranslationY.value = e.translationY;
            dragY.value =
              e.translationY +
              dragScrollTranslationY.value +
              scrollViewDragScrollTranslationY.value;
            gestureState.value = e.state;
          }
        })
        .onEnd(e => (gestureState.value = e.state))
        .onFinalize(e => (gestureState.value = e.state)),
    [
      state,
      startY,
      currentY,
      currentTranslationY,
      dragY,
      gestureState,
      dragScrollTranslationY,
      scrollViewDragScrollTranslationY,
      setDragDirection,
      setCurrentItemDragCenterY,
    ],
  );

  const panGestureHandlerWithOptions = useMemo(() => {
    if (typeof panActivateAfterLongPress === 'number') {
      panGestureHandler.activateAfterLongPress(panActivateAfterLongPress);
    }

    if (!panEnabled) {
      panGestureHandler.enabled(panEnabled);
    }

    return panGestureHandler;
  }, [panActivateAfterLongPress, panEnabled, panGestureHandler]);

  const gestureHandler = useMemo(
    () => Gesture.Simultaneous(Gesture.Native(), panGestureHandlerWithOptions),
    [panGestureHandlerWithOptions],
  );

  const setScrollEnabled = useCallback(
    (enabled: boolean) => {
      if (initialScrollEnabled) {
        scrollEnabled.value = enabled;
        flatListRef.current?.setNativeProps({scrollEnabled: enabled});
      }

      if (
        scrollViewContainerRef &&
        scrollViewScrollEnabled &&
        initialScrollViewScrollEnabled
      ) {
        scrollViewScrollEnabled.value = enabled;
        scrollViewContainerRef.current?.setNativeProps({
          scrollEnabled: enabled,
        });
      }
    },
    [
      initialScrollEnabled,
      flatListRef,
      scrollEnabled,
      initialScrollViewScrollEnabled,
      scrollViewContainerRef,
      scrollViewScrollEnabled,
    ],
  );

  const resetSharedValues = useCallback(() => {
    'worklet';

    state.value = ReorderableListState.IDLE;
    draggedIndex.value = -1;
    draggedIndices.value = [];
    dragY.value = 0;
    dragScrollTranslationY.value = 0;
    scrollViewDragScrollTranslationY.value = 0;
    dragDirection.value = 0;
    lastDragDirectionPivot.value = null;
    currentItemDragCenterY.value = null;
  }, [
    state,
    draggedIndex,
    draggedIndices,
    dragY,
    dragScrollTranslationY,
    scrollViewDragScrollTranslationY,
    dragDirection,
    lastDragDirectionPivot,
    currentItemDragCenterY,
  ]);

  const resetSharedValuesAfterAnimations = useCallback(() => {
    setTimeout(runOnUI(resetSharedValues), duration.value);
  }, [resetSharedValues, duration]);

  // const reorder = (fromIndex: number, toIndex: number) => {
  //   runOnUI(resetSharedValues)();

  //   if (fromIndex !== toIndex) {
  //     const updateState = () => {
  //       onReorder({from: fromIndex, to: toIndex});
  //     };

  //     if (!hasAutomaticBatching) {
  //       unstable_batchedUpdates(updateState);
  //     } else {
  //       updateState();
  //     }
  //   }
  // };

  const reorder = (fromIndex: number, toIndex: number, groupIndices: number[]) => {
    runOnUI(resetSharedValues)();
  
    if (fromIndex !== toIndex) {
      const updateState = () => {
        // Calculate the offset between from and to positions
        const offset = toIndex - fromIndex;
        
        // Map the group indices to their new positions
        const fromIndices = groupIndices;
        const toIndices = groupIndices.map(index => index + offset);
  
        onReorder({
          from: fromIndex,
          to: toIndex,
          fromIndices: fromIndices,
          toIndices: toIndices
        });
      };
  
      if (!hasAutomaticBatching) {
        unstable_batchedUpdates(updateState);
      } else {
        updateState();
      }
    }
  };


  // const recomputeLayout = useCallback(
  //   (from: number, to: number) => {
  //     'worklet';

  //     const itemDirection = to > from;
  //     const index1 = itemDirection ? from : to;
  //     const index2 = itemDirection ? to : from;

  //     const newOffset1 = itemOffset.value[index1];
  //     const newHeight1 = itemHeight.value[index2];
  //     const newOffset2 =
  //       itemOffset.value[index2] +
  //       itemHeight.value[index2] -
  //       itemHeight.value[index1];
  //     const newHeight2 = itemHeight.value[index1];

  //     itemOffset.value[index1] = newOffset1;
  //     itemHeight.value[index1] = newHeight1;
  //     itemOffset.value[index2] = newOffset2;
  //     itemHeight.value[index2] = newHeight2;
  //   },
  //   [itemOffset, itemHeight],
  // );
  const recomputeLayout = useCallback(
    (from: number, to: number) => {
      'worklet';
      // everytime is one step ****
      const length = currentIndices.value.length;
      const itemDirection = to > from;
      // const index1 = itemDirection ? from : to;
      // const index2 = itemDirection ? to-1 : to+length;
      
//       const newOffset1 = itemOffset.value[index1];
//       const newHeight1 = itemHeight.value[index2];
//       const newOffset2 =
//         itemOffset.value[index2] +
//         itemHeight.value[index2] -
//         itemHeight.value[index1];
//       const newHeight2 = itemHeight.value[index1];

// console.log({to,from,newHeight2, newHeight1});
//       itemOffset.value[index1] = newOffset1;
//       itemHeight.value[index1] = newHeight1;

      if (itemDirection) {
        // go down

        /* GET */
        // item being moved
        const newHOther = itemHeight.value[from+length];
        const newTOther = itemOffset.value[from];
        // drag items
        let sumLastHs = 0;
        let newH = [];
        let newT = [];
        for (let i=0; i<length; i++){
          newH[i] = itemHeight.value[from+i];
          newT[i] = itemOffset.value[from]+itemHeight.value[from+length]+sumLastHs;
          sumLastHs = newH[i] + sumLastHs;
        }

        /* SET */
        // item being moved
        itemHeight.value[to-1] = newHOther;
        itemOffset.value[to-1] = newTOther;
        // drag items
        for (let i=0; i<length; i++){           
          itemHeight.value[to+i] = newH[i];
          itemOffset.value[to+i] = newT[i];
        }
          // console.log({from,i,newH:newH, newT:newT});
        
      } else {
        // go up

         /* GET */
        // item being moved
        const newHOther = itemHeight.value[to];
        const newTOther = itemOffset.value[to]+draggedHeight.value;
        // drag items
        let sumLastHs = 0;
        let newH = [];
        let newT = [];
        for (let i=0; i<length; i++){
          newH[i] = itemHeight.value[from+i];
          newT[i] = itemOffset.value[to]+sumLastHs;
          sumLastHs = newH[i] + sumLastHs;
        }

         /* SET */
        // item being moved
        itemHeight.value[to+length] = newHOther;
        itemOffset.value[to+length] = newTOther;
        // drag items
        for (let i=0; i<length; i++){           
          itemHeight.value[to+i] = newH[i];
          itemOffset.value[to+i] = newT[i];
        }

      }
      
    },
    [itemOffset, itemHeight],
  );

  

  const computeCurrentIndex = useCallback(() => {
    'worklet';

    if (currentItemDragCenterY.value === null) {
      return currentIndex.value;
    }

    const relativeDragCenterY =
      flatListScrollOffsetY.value +
      scrollViewDragScrollTranslationY.value +
      currentItemDragCenterY.value;

    const currentOffset = itemOffset.value[currentIndex.value];
    const currentHeight = itemHeight.value[currentIndex.value];
    const currentCenter = currentOffset + currentHeight * 0.5;

    const max = itemOffset.value.length;
    const possibleIndex =
      relativeDragCenterY < currentCenter
        ? Math.max(0, currentIndex.value - 1)
        : Math.min(max - 1 - (currentIndices.value.length - 1), currentIndex.value + 1);

    if (currentIndex.value !== possibleIndex) {
      let possibleOffset = itemOffset.value[possibleIndex];
      if (possibleIndex > currentIndex.value) {
        possibleOffset += itemHeight.value[possibleIndex] - currentHeight;
      }

      const possibleCenter = possibleOffset + currentHeight * 0.5;
      const distanceFromCurrent = Math.abs(relativeDragCenterY - currentCenter);
      const distanceFromPossible = Math.abs(
        relativeDragCenterY - possibleCenter,
      );

      return distanceFromCurrent <= distanceFromPossible
        ? currentIndex.value
        : possibleIndex;
    }

    return currentIndex.value;
  }, [
    currentIndex,
    currentItemDragCenterY,
    itemOffset,
    itemHeight,
    flatListScrollOffsetY,
    scrollViewDragScrollTranslationY,
  ]);

 

  const computeCurrentIndices = useCallback(() => {
    'worklet';
  
    if (currentItemDragCenterY.value === null) {
      return currentIndices.value[0];
    }
  
    const relativeDragCenterY =
      flatListScrollOffsetY.value +
      scrollViewDragScrollTranslationY.value +
      currentItemDragCenterY.value;
  
    // Calculate the entire group's dimensions
    const groupIndices = currentIndices.value;
    const firstIndex = groupIndices[0];
    const lastIndex = groupIndices[groupIndices.length - 1];
    
    // Get total height of the group
    const groupTopOffset = itemOffset.value[firstIndex];
    const groupBottomOffset = itemOffset.value[lastIndex] + itemHeight.value[lastIndex];
    const groupHeight = groupBottomOffset - groupTopOffset;
    const groupCenter = groupTopOffset + (groupHeight / 2);
  
    // Find possible new position
    const max = itemOffset.value.length;
    let possibleIndex;
    
    if (relativeDragCenterY < groupCenter) {
      // Moving up - check positions above the group
      for (let i = firstIndex - 1; i >= 0; i--) {
        const itemCenter = itemOffset.value[i] + (itemHeight.value[i] / 2);
        if (relativeDragCenterY > itemCenter) {
          possibleIndex = i;
          break;
        }
      }
      if (possibleIndex === undefined) possibleIndex = 0;
    } else {
      // Moving down - check positions below the group
      for (let i = lastIndex + 1; i < max; i++) {
        const itemCenter = itemOffset.value[i] + (itemHeight.value[i] / 2);
        if (relativeDragCenterY < itemCenter) {
          possibleIndex = i - groupIndices.length;
          break;
        }
      }
      if (possibleIndex === undefined) possibleIndex = max - groupIndices.length;
    }
  
    // Ensure we don't exceed list bounds
    possibleIndex = Math.max(0, Math.min(possibleIndex, max - groupIndices.length));
  
    if (firstIndex !== possibleIndex) {
      const distanceFromCurrent = Math.abs(relativeDragCenterY - groupCenter);
      const possibleGroupCenter = itemOffset.value[possibleIndex] + (groupHeight / 2);
      const distanceFromPossible = Math.abs(relativeDragCenterY - possibleGroupCenter);
  
      return distanceFromCurrent <= distanceFromPossible ? firstIndex : possibleIndex;
    }
  
    return firstIndex;
  }, [
    currentIndices,
    currentItemDragCenterY,
    itemOffset,
    itemHeight,
    flatListScrollOffsetY,
    scrollViewDragScrollTranslationY,
  ]);



  const setCurrentIndex = useCallback(() => {
    'worklet';

    const newIndex = computeCurrentIndex();

    if (currentIndex.value !== newIndex) {
      recomputeLayout(currentIndex.value, newIndex);
      currentIndex.value = newIndex;
      
      // Add haptic feedback when index changes
      runOnJS(triggerSelectionHaptic)();

      onIndexChange?.({index: newIndex});
    }
  }, [currentIndex, computeCurrentIndex, recomputeLayout, onIndexChange]);

  const _setCurrentIndices = useCallback(() => {
    'worklet';
 
    const newFirstIndex = computeCurrentIndices();
    
    if (currentIndices.value[0] !== newFirstIndex) {
      const offset = newFirstIndex - currentIndices.value[0];
      const newIndices = currentIndices.value.map(index => index + offset);
      
      for (let i = 0; i < currentIndices.value.length; i++) {
        recomputeLayout(currentIndices.value[i], newIndices[i]);
      }
      currentIndices.value = newIndices;
      
      // Add haptic feedback when indices change
      runOnJS(triggerSelectionHaptic)();
  
      onIndexChange?.({index: newFirstIndex});
    }
  }, [currentIndices, computeCurrentIndices, recomputeLayout, onIndexChange]);


  const runDefaultDragAnimations = useCallback(
    (type: 'start' | 'end') => {
      'worklet';

      if (!(cellAnimations && 'transform' in cellAnimations)) {
        const scaleConfig = SCALE_ANIMATION_CONFIG_DEFAULT[type];
        scaleDefault.value = withTiming(scaleConfig.toValue, scaleConfig);
      }

      if (!(cellAnimations && 'opacity' in cellAnimations)) {
        const opacityConfig = OPACITY_ANIMATION_CONFIG_DEFAULT[type];
        opacityDefault.value = withTiming(opacityConfig.toValue, opacityConfig);
      }
    },
    [cellAnimations, scaleDefault, opacityDefault],
  );



  useAnimatedReaction(
    () => gestureState.value,
    () => {
      if (
        gestureState.value !== State.ACTIVE &&
        gestureState.value !== State.BEGAN &&
        (state.value === ReorderableListState.DRAGGED ||
          state.value === ReorderableListState.AUTOSCROLL)
      ) {
        state.value = ReorderableListState.RELEASED;

        runOnJS(setScrollEnabled)(true);

        if (shouldUpdateActiveItem) {
          runOnJS(setActiveIndex)(-1);
          runOnJS(activeIndices)([])
        }

        // Get the indices of all items being moved
        const fromIndices = draggedIndices.value;
        const toIndex = currentIndex.value;
        const offset = toIndex - draggedIndex.value;
        const toIndices = fromIndices.map(index => index + offset);

       let e = {
          from: draggedIndex.value,
          fromIndices: fromIndices,
          to: currentIndex.value,
          toIndices: toIndices
        };
        
        onDragEnd?.(e);

        const handlers = dragEndHandlers.value[draggedIndex.value];
        if (Array.isArray(handlers)) {
          handlers.forEach(fn => fn(e.from, e.to));
        }
      
        // Calculate new position for the entire group
        // move down
        const currentItemOffset = itemOffset.value[draggedIndex.value];
        const currentItemHeight = itemHeight.value[draggedIndex.value];
        const draggedItemOffset = itemOffset.value[currentIndex.value];
        const draggedItemHeight = itemHeight.value[currentIndex.value];

        // move up
        let displacedHeight = 0;
        const to = currentIndex.value;
        const move = -currentIndex.value + draggedIndex.value;
        const length = currentIndices.value.length;
        for (let i=to+length; i<to+length+move; i++){
          displacedHeight += itemHeight.value[i]
        }
    
       
        const newTopPosition = currentIndex.value > draggedIndex.value
          // move down
            ? draggedItemOffset -
              currentItemOffset
          // move up
            : -displacedHeight
         

        runDefaultDragAnimations('end');

        if (dragY.value !== newTopPosition) {
          
          dragY.value = withTiming(
            newTopPosition,
            {
              duration: duration.value,
              easing: Easing.out(Easing.ease),
            },
            () => {
              // Reorder the entire group
              runOnJS(reorder)(draggedIndex.value, currentIndex.value, draggedIndices.value);
            },
          );
        } else {
          runOnJS(resetSharedValuesAfterAnimations)();
        }
      }
    },
  );

  const calculateHiddenArea = useCallback(() => {
    'worklet';
    if (!scrollViewScrollOffsetY || !scrollViewHeightY) {
      return {top: 0, bottom: 0};
    }

    const top = Math.max(
      0,
      scrollViewScrollOffsetY.value - nestedFlatListPositionY.value,
    );
    const bottom = Math.max(
      0,
      nestedFlatListPositionY.value +
        flatListHeightY.value -
        (scrollViewScrollOffsetY.value + scrollViewHeightY.value),
    );

    return {top, bottom};
  }, [
    scrollViewScrollOffsetY,
    scrollViewHeightY,
    nestedFlatListPositionY,
    flatListHeightY,
  ]);

  const calculateThresholdArea = useCallback(
    (hiddenArea: {top: number; bottom: number}) => {
      'worklet';
      const offsetTop = Math.max(0, autoscrollThresholdOffset?.top || 0);
      const offsetBottom = Math.max(0, autoscrollThresholdOffset?.bottom || 0);
      const threshold = Math.max(0, Math.min(autoscrollThreshold, 0.4));
      const visibleHeight =
        flatListHeightY.value -
        (hiddenArea.top + hiddenArea.bottom) -
        (offsetTop + offsetBottom);

       // Consider the group height when calculating threshold areas
      const groupHeight = draggedHeight.value;
      const area = visibleHeight * threshold;
      const top = area + offsetTop;
      const bottom = flatListHeightY.value - Math.max(area, groupHeight) - offsetBottom;

      return {top, bottom};
    },
    [autoscrollThreshold, autoscrollThresholdOffset, flatListHeightY],
  );

  const calculateThresholdAreaParent = useCallback(
    (hiddenArea: {top: number; bottom: number}) => {
      'worklet';
      const offsetTop = Math.max(0, autoscrollThresholdOffset?.top || 0);
      const offsetBottom = Math.max(0, autoscrollThresholdOffset?.bottom || 0);
      const threshold = Math.max(0, Math.min(autoscrollThreshold, 0.4));

      const area = flatListHeightY.value * threshold;
      const top = area + offsetTop;
      const bottom = flatListHeightY.value - area - offsetBottom;

      return {
        top: hiddenArea.top > 0.1 ? top + hiddenArea.top : 0,
        bottom: hiddenArea.bottom > 0.1 ? bottom - hiddenArea.bottom : 0,
      };
    },
    [autoscrollThreshold, autoscrollThresholdOffset, flatListHeightY],
  );

  const shouldScrollParent = useCallback(
    (y: number) => {
      'worklet';
      const hiddenArea = calculateHiddenArea();
      const thresholdAreaParent = calculateThresholdAreaParent(hiddenArea);

      return (
        (hiddenArea.top > 0.1 && y <= thresholdAreaParent.top) ||
        (hiddenArea.bottom > 0.1 && y >= thresholdAreaParent.bottom)
      );
    },
    [calculateHiddenArea, calculateThresholdAreaParent],
  );

  const scrollDirection = useCallback(
    (y: number) => {
      'worklet';
      const hiddenArea = calculateHiddenArea();

      if (shouldScrollParent(y)) {
        const thresholdAreaParent = calculateThresholdAreaParent(hiddenArea);
        if (y <= thresholdAreaParent.top) {
          return -1;
        }

        if (y >= thresholdAreaParent.bottom) {
          return 1;
        }

        return 0;
      } else if (nestedScrollable) {
        const thresholdArea = calculateThresholdArea(hiddenArea);
        if (y <= thresholdArea.top) {
          return -1;
        }

        if (y >= thresholdArea.bottom) {
          return 1;
        }
      }

      return 0;
    },
    [
      nestedScrollable,
      shouldScrollParent,
      calculateHiddenArea,
      calculateThresholdArea,
      calculateThresholdAreaParent,
    ],
  );

  useAnimatedReaction(
    () => currentY.value + scrollViewDragScrollTranslationY.value,
    y => {
      if (
        state.value === ReorderableListState.DRAGGED ||
        state.value === ReorderableListState.AUTOSCROLL
      ) {
        setCurrentIndex();
        // setCurrentIndices();

        if (dragDirection.value === scrollDirection(y)) {
          if (state.value !== ReorderableListState.AUTOSCROLL) {
            state.value = ReorderableListState.AUTOSCROLL;
            lastAutoscrollTrigger.value = autoscrollTrigger.value;
            autoscrollTrigger.value *= -1;
          }
        } else if (state.value === ReorderableListState.AUTOSCROLL) {
          state.value = ReorderableListState.DRAGGED;
        }
      }
    },
  );

  useAnimatedReaction(
    () => autoscrollTrigger.value,
    () => {
      if (
        autoscrollTrigger.value !== lastAutoscrollTrigger.value &&
        state.value === ReorderableListState.AUTOSCROLL
      ) {
        let y = currentY.value + scrollViewDragScrollTranslationY.value;
        const autoscrollIncrement =
          scrollDirection(y) *
          AUTOSCROLL_CONFIG.increment *
          autoscrollSpeedScale;

        if (autoscrollIncrement !== 0) {
          let scrollOffset = flatListScrollOffsetY.value;
          let listRef =
            flatListRef as unknown as AnimatedRef<Animated.ScrollView>;

          if (shouldScrollParent(y) && scrollViewScrollOffsetY) {
            scrollOffset = scrollViewScrollOffsetY.value;
            listRef =
              scrollViewContainerRef as unknown as AnimatedRef<Animated.ScrollView>;
          }

          scrollTo(listRef, 0, scrollOffset + autoscrollIncrement, true);
        }

        setCurrentIndex();
        // setCurrentIndices()
      }
    },
  );

  const handleScroll = useAnimatedScrollHandler(e => {
    flatListScrollOffsetY.value = e.contentOffset.y;

    if (!scrollEnabled.value) {
      dragScrollTranslationY.value =
        flatListScrollOffsetY.value - dragInitialScrollOffsetY.value;
    }

    if (state.value === ReorderableListState.AUTOSCROLL) {
      dragY.value =
        currentTranslationY.value +
        dragScrollTranslationY.value +
        scrollViewDragScrollTranslationY.value;

      lastAutoscrollTrigger.value = autoscrollTrigger.value;
      autoscrollTrigger.value = withDelay(
        autoscrollDelay,
        withTiming(autoscrollTrigger.value * -1, {duration: 0}),
      );
    }
  });

  useAnimatedReaction(
    () => scrollViewScrollOffsetY?.value,
    value => {
      if (value && scrollViewScrollEnabled) {
        if (!scrollViewScrollEnabled.value) {
          scrollViewDragScrollTranslationY.value =
            value - scrollViewDragInitialScrollOffsetY.value;
        }

        if (state.value === ReorderableListState.AUTOSCROLL) {
          dragY.value =
            currentTranslationY.value + scrollViewDragScrollTranslationY.value;

          lastAutoscrollTrigger.value = autoscrollTrigger.value;
          autoscrollTrigger.value = withDelay(
            autoscrollDelay,
            withTiming(autoscrollTrigger.value * -1, {duration: 0}),
          );
        }
      }
    },
  );

  // find active item's children Indices
  
  function getItemDepth (item, data){
    'worklet';
    if (!item.parentId) return 0;
    const parent = data.find(i => i.id === item.parentId);
    if (!parent) return 0;
   
    return getItemDepth(parent, data) + 1;
  };
  const findChildrenIndices = (index, data) => {
    'worklet';
    const item = data[index];
    const depth = getItemDepth(item, data);
    const childrenIndices = [];
    
    for (let i = index + 1; i < data.length; i++) {
      const currentDepth = getItemDepth(data[i], data);
      if (currentDepth <= depth) {
        break;
      }
      childrenIndices.push(i);
    }
    console.log(childrenIndices)
    return childrenIndices;
  };


  const startDrag = useCallback(
    (index: number) => {
      'worklet';
      if (state.value === ReorderableListState.IDLE) {
        resetSharedValues();

        // calculate active item + children 's height
        const childrenIndices = findChildrenIndices(index, data)
        const totalHeights = [index, ...childrenIndices]
                              .map(i=> itemHeight.value[i])
                              .reduce((height,sum) => sum + height, 0);
        
        if (shouldUpdateActiveItem) {
          runOnJS(setActiveIndex)(index);
          runOnJS(setActiveIndices)(childrenIndices)
        }

        // Add haptic feedback when item becomes active
        runOnJS(triggerHaptic)();

        dragInitialScrollOffsetY.value = flatListScrollOffsetY.value;
        scrollViewDragInitialScrollOffsetY.value =
          scrollViewScrollOffsetY?.value || 0;

        draggedHeight.value = totalHeights
        draggedIndex.value = index;
        draggedIndices.value = [index, ...childrenIndices]
        currentIndex.value = index;
        currentIndices.value = [index, ...childrenIndices]
        state.value = ReorderableListState.DRAGGED;

        runOnJS(setScrollEnabled)(false);

        runDefaultDragAnimations('start');
        onDragStart?.({index});
      }
    },
    [
      resetSharedValues,
      shouldUpdateActiveItem,
      dragInitialScrollOffsetY,
      scrollViewScrollOffsetY,
      scrollViewDragInitialScrollOffsetY,
      setScrollEnabled,
      currentIndex,
      currentIndices,
      draggedHeight,
      draggedIndex,
      draggedIndices,
      state,
      flatListScrollOffsetY,
      itemHeight,
      onDragStart,
      runDefaultDragAnimations,
      data
    ],
  );

  const handleFlatListLayout = useCallback(
    (e: LayoutChangeEvent) => {
      nestedFlatListPositionY.value = e.nativeEvent.layout.y;
      flatListHeightY.value = e.nativeEvent.layout.height;

      onLayout?.(e);
    },
    [nestedFlatListPositionY, flatListHeightY, onLayout],
  );

  const handleRef = (value: FlatList<T>) => {
    flatListRef(value);

    if (typeof ref === 'function') {
      ref(value);
    } else if (ref) {
      ref.current = value;
    }
  };

  return {
    gestureHandler,
    handleScroll,
    handleFlatListLayout,
    handleRef,
    startDrag,
    listContextValue,
    itemOffset,
    itemHeight,
    draggedIndex,
    draggedIndices,
    dragY,
    duration,
  };
};