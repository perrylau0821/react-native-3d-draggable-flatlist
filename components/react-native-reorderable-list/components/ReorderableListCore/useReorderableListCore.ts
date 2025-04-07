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
  onCollapse: (event) => void;
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
  onCollapse,
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
  const dataRef = useSharedValue(data);
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
  const itemCollapse = useSharedValue<boolean[]>([]);
  const itemCollapseChildren = useSharedValue<boolean[]>([]);
  const autoscrollTrigger = useSharedValue(-1);
  const lastAutoscrollTrigger = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const dragYOffsets = useSharedValue<number[]>([]); 
  const currentIndex = useSharedValue(-1);
  const currentIndices = useSharedValue<number[]>([]); 
  const currentCollapsed = useSharedValue<number[]>([])
  const currentCollapsedChildren = useSharedValue<number[]>([])
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

  useEffect(() => {
    dataRef.value = data;
    console.log({data:data.map(d=>parseInt(d.id))})
  }, [data]);

  // useEffect(()=>{console.log('DATA CHANGE'); console.log(JSON.stringify({data}, null, 2))},[data])

  const listContextValue = useMemo(
    () => ({
      draggedHeight,
      currentIndex,
      currentIndices,
      currentCollapsed,
      currentCollapsedChildren,
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
      currentCollapsed,
      currentCollapsedChildren,
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

  // find active item's children Indices
  function getItemDepth (item){
    'worklet';
    if (!item.parentId) return 0;
    const parent = dataRef.value.find(i => i.id === item.parentId);
    if (!parent) return 0;
   
    return getItemDepth(parent) + 1;
  };
  
  const findChildrenIndices = (index) => {
    'worklet';
    const item = dataRef.value[index];
    const depth = getItemDepth(item);
    const childrenIndices = [];
    
    for (let i = index + 1; i < dataRef.value.length; i++) {
      const currentDepth = getItemDepth(dataRef.value[i]);
      if (currentDepth <= depth) {
        break;
      }
      childrenIndices.push(i);
    }
  
    return childrenIndices;
  };

  const getTotalCollapsedHeight = (index: number, data: any[]) => {
    'worklet';
    
    // First check if this index is a collapse child
    if (itemCollapseChildren.value[index]) {
      // Find the parent collapse node by scanning backwards
      let parentIndex = index;
      while (parentIndex >= 0) {
        if (itemCollapse.value[parentIndex]) {
          // Found the parent collapse node
          // Now get all its children
          const children = findChildrenIndices(parentIndex);
          if (children.includes(index)) {
            // Calculate total height starting from parent
            let totalHeight = itemHeight.value[parentIndex];
            for (const childIndex of children) {
              totalHeight += itemHeight.value[childIndex];
            }
            return totalHeight;
          }
        }
        parentIndex--;
      }
      return itemHeight.value[index]; // Fallback if no parent found
    }
  
    // If this is a collapse node, calculate its total height plus children
    if (itemCollapse.value[index]) {
      let totalHeight = itemHeight.value[index];
      const children = findChildrenIndices(index);
      for (const childIndex of children) {
        totalHeight += itemHeight.value[childIndex];
      }
      return totalHeight;
    }
  
    // If neither collapse node nor child, return own height
    return itemHeight.value[index];
  };

  const getCollapseGroupInfo = (index: number) => {
    'worklet';
  
    // First check if this index is a collapse child
    if (itemCollapseChildren.value[index]) {
      // Find the parent collapse node by scanning backwards
      let parentIndex = index;

      while (parentIndex >= 0) {
        // Topmost Parent : is collapse and not collapse children
        if (itemCollapse.value[parentIndex] && !itemCollapseChildren.value[parentIndex]) {
          // Found the parent collapse node
          // Now get all its collapsed children
          const collapsedChildren = currentCollapsedChildren.value.filter(i => {
            const children = findChildrenIndices(parentIndex);
            return children.includes(i)
          });
          
          // Return the collapse group info starting from parent
          let totalHeight = itemHeight.value[parentIndex];
          for (const childIndex of collapsedChildren) {
            totalHeight += itemHeight.value[childIndex];
          }
          return {
            offset: itemOffset.value[parentIndex],
            height: totalHeight,
            parentIndex: parentIndex,
            children: collapsedChildren
          };
         
        }
        parentIndex--;
      }
      // Fallback if no parent found
      return {
        offset: itemOffset.value[index],
        height: itemHeight.value[index],
        parentIndex: -1,
        children: []
      };
    }

    // First check if this index is a collapse child
    // if (itemCollapseChildren.value[index]) {
    //   // Find the topmost parent collapse node by scanning backwards
    //   let parentIndex = index;
    //   let topmostParentIndex = -1;
  
    //   while (parentIndex >= 0) {
    //     if (itemCollapse.value[parentIndex]) {
    //       // Found a parent collapse node, keep track of it
    //       topmostParentIndex = parentIndex;
    //     }
    //     parentIndex--;
    //   }
  
    //   // If we found a parent collapse node
    //   if (topmostParentIndex >= 0) {
    //     // Get all children of the topmost parent
    //     const children = findChildrenIndices(topmostParentIndex);
    //     const collapsedChildren = currentCollapsedChildren.value.filter(i => 
    //       children.includes(i)
    //     );
        
    //     // Calculate total height starting from topmost parent
    //     let totalHeight = itemHeight.value[topmostParentIndex];
    //     for (const childIndex of collapsedChildren) {
    //       totalHeight += itemHeight.value[childIndex];
    //     }
  
    //     return {
    //       offset: itemOffset.value[topmostParentIndex],
    //       height: totalHeight,
    //       parentIndex: topmostParentIndex,
    //       children: collapsedChildren
    //     };
    //   }
  
    //   // Fallback if no parent found
    //   return {
    //     offset: itemOffset.value[index],
    //     height: itemHeight.value[index], 
    //     parentIndex: -1,
    //     children: []
    //   };
    // }
  
    // If this is a collapse node, calculate its total height plus children
    if (itemCollapse.value[index]) {
      let totalHeight = itemHeight.value[index];
      const children = findChildrenIndices(index);
      console.log(index, children)
      const collapsedChildren = currentCollapsedChildren.value.filter(i => children.includes(i));
      for (const childIndex of collapsedChildren) {
        totalHeight += itemHeight.value[childIndex];
      }
      return {
        offset: itemOffset.value[index],
        height: totalHeight,
        parentIndex: index,
        children: collapsedChildren
      };
    }
  
    // If neither collapse node nor child, return own info
    return {
      offset: itemOffset.value[index],
      height: itemHeight.value[index],
      parentIndex: -1,
      children: []
    };
  };


  const toggleCurrentCollapsed = (index, shdHave) => {
    'worklet';
   
    const collapsedSet = new Set(currentCollapsed.value);
    if (shdHave == undefined){
      if (collapsedSet.has(index)) 
        collapsedSet.delete(index);
      else collapsedSet.add(index);
    } else {
      if (collapsedSet.has(index))
        shdHave ? null : collapsedSet.delete(index);
      else 
        shdHave ? collapsedSet.add(index) : null;
    }
    
    currentCollapsed.value = [...collapsedSet];
  }
  
  const toggleCurrentCollapsedChildren = (index, shdHave) => {
    'worklet';
   
    const collapsedSet = new Set(currentCollapsedChildren.value);
    if (shdHave == undefined){
      if (collapsedSet.has(index)) 
        collapsedSet.delete(index);
      else collapsedSet.add(index);
    } else {
      if (collapsedSet.has(index))
        shdHave ? null : collapsedSet.delete(index);
      else 
        shdHave ? collapsedSet.add(index) : null;
    }
    
    currentCollapsedChildren.value = [...collapsedSet];
  }

  const setCurrentCollapsed = () => {
    'worklet';
    currentCollapsed.value = itemCollapse.value.map((v,i) => v === true ? i : undefined).filter(v => v!==undefined)
  }
  
  const setCurrentCollapsedChildren = () => {
    'worklet';
    currentCollapsedChildren.value = itemCollapseChildren.value.map((v,i) => v === true ? i : undefined).filter(v => v!==undefined)
  };


  const collapse = useCallback((index: number) => {
    'worklet';
  
    // Get children indices and check if item has children
    const childrenIndices = findChildrenIndices(index);
    const hasChildren = childrenIndices.length > 0;
  
    if (!hasChildren) return;
  
    // Step 1: Toggle collapse state for parent
    const newItemCollapse = [...itemCollapse.value];
    newItemCollapse[index] = !newItemCollapse[index];
    itemCollapse.value = newItemCollapse;
  
    // Step 2: Recompute all collapsed children
    const allCollapsedChildren = new Set<number>();
    
    // For each collapsed parent, add all its children to the set
    itemCollapse.value.forEach((isCollapsed, parentIdx) => {
      if (isCollapsed) {
        const children = findChildrenIndices(parentIdx);
        children.forEach(childIdx => {
          allCollapsedChildren.add(childIdx);
        });
      }
    });
  
    // Step 3: Update collapse children state
    const newItemCollapseChildren = [...itemCollapseChildren.value];
    itemCollapseChildren.value.forEach((_, idx) => {
      newItemCollapseChildren[idx] = allCollapsedChildren.has(idx);
    });
    itemCollapseChildren.value = newItemCollapseChildren;
  
    // Step 4: Update tracking arrays for current state
    // Track collapsed parents
    currentCollapsed.value = itemCollapse.value
      .map((v, i) => v ? i : undefined)
      .filter((v): v is number => v !== undefined);
    
    // Track collapsed children
    currentCollapsedChildren.value = [...allCollapsedChildren];
  
    // Step 5: Notify parent component
    if (onCollapse) {
      runOnJS(onCollapse)({ 
        index, 
        childrenIndices, 
        allCollapsedChildren: currentCollapsedChildren.value 
      });
    }
  }, []);


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

  const recomputeLayout = useCallback(
    (from: number, to: number) => {
      'worklet';
      const UPDATE_C = false
      
      // everytime is one step ****
      const length = currentIndices.value.length;
      const itemDirection = to > from;
      const distance = Math.abs(to - from);

      if (itemDirection) {
        console.log({to, from})
        // go down

        /* GET */
        // item being moved
        let sumLastTOthers = itemOffset.value[from];
        let newHOthers = [];
        let newTOthers = [];
        let newCOthers = [];
        let newCCOthers = [];
        for (let i=0; i<distance; i++){
          newHOthers[i] = itemHeight.value[from+length+i];
          newTOthers[i] = sumLastTOthers;
          newCOthers[i] = itemCollapse.value[from+length+i];
          newCCOthers[i] = itemCollapseChildren.value[from+length+i];
          sumLastTOthers += newHOthers[i];
        }
        
        // drag items
        let sumLastHs = 0;
        let newH = [];
        let newT = [];
        let newC = [];
        let newCC = [];
        for (let i=0; i<length; i++){
          newH[i] = itemHeight.value[from+i];
          newT[i] = sumLastTOthers+sumLastHs;
          newC[i] = itemCollapse.value[from+i];
          newCC[i] = itemCollapseChildren.value[from+i];
          sumLastHs = newH[i] + sumLastHs;
        }
// console.log({newC})
        /* SET */
        // item being moved
        for (let i=0; i<distance; i++){
          itemHeight.value[from+i] = newHOthers[i];
          itemOffset.value[from+i] = newTOthers[i];
          if (!UPDATE_C) continue
          itemCollapse.value[from+i] = newCOthers[i];
          itemCollapseChildren.value[from+i] = newCCOthers[i];
        }
   
        // drag items
        for (let i=0; i<length; i++){           
          itemHeight.value[to+i] = newH[i];
          itemOffset.value[to+i] = newT[i];
          if (!UPDATE_C) continue
          itemCollapse.value[to+i] = newC[i];
          itemCollapseChildren.value[to+i] = newCC[i];
        }
        
      } else {
        // go up

         /* GET */
        // item being moved
        let sumLastTOthers = itemOffset.value[to]+draggedHeight.value;
        let newHOthers = [];
        let newTOthers = [];
        let newCOthers = [];
        let newCCOthers = [];
        for (let i=0; i<distance; i++){
          newHOthers[i] = itemHeight.value[to+i];
          newTOthers[i] = sumLastTOthers;
          newCOthers[i] = itemCollapse.value[to+i];
          newCCOthers[i] = itemCollapseChildren.value[to+i];
          sumLastTOthers += newHOthers[i]; 
        }

        // drag items
        let sumLastHs = 0;
        let newH = [];
        let newT = [];
        let newC = [];
        let newCC = [];
        for (let i=0; i<length; i++){
          newH[i] = itemHeight.value[from+i];
          newT[i] = itemOffset.value[to]+sumLastHs;
          newC[i] = itemCollapse.value[from+i];
          newCC[i] = itemCollapseChildren.value[from+i];
          sumLastHs = newH[i] + sumLastHs;
        }

         /* SET */
        // drag items
        for (let i=0; i<length; i++){           
          itemHeight.value[to+i] = newH[i];
          itemOffset.value[to+i] = newT[i];
          if (!UPDATE_C) continue
          itemCollapse.value[to+i] = newC[i];
          itemCollapseChildren.value[to+i] = newCC[i];
        }
        
        // item being moved
        for (let i=0; i<distance; i++){
          itemHeight.value[to+length+i] = newHOthers[i];
          itemOffset.value[to+length+i] = newTOthers[i];
          if (!UPDATE_C) continue
          itemCollapse.value[to+length+i] = newCOthers[i];
          itemCollapseChildren.value[to+length+i] = newCCOthers[i];
        }
        
      }
      if (!UPDATE_C) return
    itemCollapse.value = [...itemCollapse.value]
    itemCollapseChildren.value = [...itemCollapseChildren.value]
    setCurrentCollapsed()
    setCurrentCollapsedChildren()
    // recomputeCollapse(from,to)
    },
    [itemOffset, itemHeight, itemCollapse],
  );

  const recomputeCollapse = useCallback(
    (from: number, to: number) => {
      'worklet';

      const length = currentIndices.value.length;
      const itemDirection = to > from;
      const distance = Math.abs(to - from);
      
        console.log({to, from})

      if (itemDirection) {
        // go down

        /* GET */
        // item being moved
        let newCOthers = [];
        let newCCOthers = [];
        for (let i=0; i<distance; i++){
          newCOthers[i] = itemCollapse.value[from+length+i];
          newCCOthers[i] = itemCollapseChildren.value[from+length+i];
        }
        
        // drag items
        let newC = [];
        let newCC = [];
        for (let i=0; i<length; i++){
          newC[i] = itemCollapse.value[from+i];
          newCC[i] = itemCollapseChildren.value[from+i];
        }

        /* SET */
        // item being moved
        for (let i=0; i<distance; i++){
          itemCollapse.value[from+i] = newCOthers[i];
          itemCollapseChildren.value[from+i] = newCCOthers[i];
        }
   
        // drag items
        for (let i=0; i<length; i++){           
          itemCollapse.value[to+i] = newC[i];
          itemCollapseChildren.value[to+i] = newCC[i];
        }
        
      } else {
        // go up

         /* GET */
        // item being moved
        let newCOthers = [];
        let newCCOthers = [];
        for (let i=0; i<distance; i++){
          newCOthers[i] = itemCollapse.value[to+i];
          newCCOthers[i] = itemCollapseChildren.value[to+i];
        }

        // drag items
        let newC = [];
        let newCC = [];
        for (let i=0; i<length; i++){
          newC[i] = itemCollapse.value[from+i];
          newCC[i] = itemCollapseChildren.value[from+i];
        }

         /* SET */
        // drag items
        for (let i=0; i<length; i++){           
          itemCollapse.value[to+i] = newC[i];
          itemCollapseChildren.value[to+i] = newCC[i];
        }
        
        // item being moved
        for (let i=0; i<distance; i++){
          itemCollapse.value[to+length+i] = newCOthers[i];
          itemCollapseChildren.value[to+length+i] = newCCOthers[i];
        }
        
      }
    setCurrentCollapsed()
    setCurrentCollapsedChildren()
    // const map = itemCollapse.value.map((v,i)=>[v,itemCollapseChildren.value[i]])
    // console.log(map)
    },
    [itemCollapse],
  );

  /**
 * Calculates the next possible index for a dragged item based on its current position and movement direction
 * 
 * @param direction - Movement direction ('same', 'up', or 'down')
 * @param displacement - Whether item is being moved 'above' or 'below' current position
 * @param currentIndex - Current index of the dragged item
 * @param currentChildrenSize - Number of children the dragged item has
 * @returns The calculated target indices for item movement
 */
const calculateTargetIndices = (
  direction: 'same' | 'up' | 'down',
  displacement: 'above' | 'below',
  currentIndex: number,
  currentChildrenSize: number
) => {
  'worklet';
  
  // Calculate base indices based on movement direction
  const indices = {
    above: -1,
    below: -1
  };

  switch(direction) {
    case 'same':
      indices.above = currentIndex - 1;
      indices.below = currentIndex + 1 + currentChildrenSize;
      break;
    case 'up':
      indices.above = currentIndex - 1;
      indices.below = currentIndex;
      break;
    case 'down':
      indices.above = currentIndex + currentChildrenSize;
      indices.below = currentIndex + 1 + currentChildrenSize;
      break;
  }

  return indices[displacement];
};

/**
 * Calculates step size for movement when dealing with collapsed groups
 * 
 * @param direction - Movement direction ('same', 'up', or 'down')
 * @param displacement - Whether moving 'above' or 'below'
 * @param params - Object containing indices and group info
 * @returns Calculated step size
 */
const calculateStepSize = (
  direction: 'same' | 'up' | 'down',
  displacement: 'above' | 'below',
  params: {
    currentIndex: number,
    currentChildrenSize: number,
    parentIndex: number,
    lastChildren: number
  }
) => {
  'worklet';
  
  const { currentIndex, currentChildrenSize, parentIndex, lastChildren } = params;

  if (parentIndex === -1) return 1;

  switch(direction) {
    case 'same':
      return displacement === 'above'
        ? Math.abs(parentIndex - currentIndex)
        : Math.abs(lastChildren - currentIndex - currentChildrenSize);
      
    case 'up':
      return displacement === 'above'
        ? Math.abs(parentIndex - currentIndex)
        : Math.abs(lastChildren + 1 - currentIndex);
      
    case 'down':
      return displacement === 'above'
        ? Math.abs(parentIndex - (currentIndex + 1) - currentChildrenSize)
        : Math.abs(lastChildren - currentIndex - currentChildrenSize);
      
    default:
      return 1;
  }
};

  /**
   * Computes the next index position for a dragged item, handling complex scenarios including:
   * - Variable item heights
   * - Nested collapsible groups
   * - Multi-item drag groups (parent + children)
   * 
   * Key Concepts:
   * 1. Drag Position
   *    - Uses relative position accounting for scroll offset
   *    - Compares against item center points for threshold detection
   *    - Handles both upward and downward movements
   * 
   * 2. Movement Types
   *    - 'same': Item hasn't crossed other items yet
   *    - 'up': Moving towards top of list
   *    - 'down': Moving towards bottom of list
   * 
   * 3. Displacement Types
   *    - 'above': Drag point is above item center
   *    - 'below': Drag point is below item center
   * 
   * 4. Step Size Calculation
   *    - Basic: 1 step (single position)
   *    - Collapse Groups: Variable steps based on group structure
   *      - Parent movement: Considers all children
   *      - Child movement: Considers parent boundaries
   * 
   * 5. Index Translation
   *    - Real-time currentIndex updates as items move
   *    - Other items maintain original indices + translation offset
   *    - Special handling for collapse group boundaries
   * 
   * Example Scenarios:
   * 1. Moving Down (direction: 'down')
   *    - Above threshold: targetIndex = currentIndex
   *    - Below threshold: targetIndex = currentIndex + 1 + childrenSize
   * 
   * 2. Moving Up (direction: 'up')
   *    - Above threshold: targetIndex = currentIndex - 1
   *    - Below threshold: targetIndex = currentIndex
   * 
   * 3. Collapse Group Movement
   *    - Parent: Moves as single unit with children
   *    - Children: Constrained within parent boundaries
   *    - Step size adjusts based on group structure
   * 
   * @returns The computed target index for the dragged item
   * @worklet
   */
  const computeCurrentIndex = useCallback(() => {
    'worklet';

    if (currentItemDragCenterY.value === null) {
      return currentIndex.value;
    }

    // Calculate relative drag position
    const relativeDragCenterY =
      flatListScrollOffsetY.value +
      scrollViewDragScrollTranslationY.value +
      currentItemDragCenterY.value;

    // Get current item metrics
    const currentOffset = itemOffset.value[currentIndex.value];
    const currentHeight = itemHeight.value[currentIndex.value];
    const currentCenter = currentOffset + currentHeight * 0.5;
    const currentChildrenSize = findChildrenIndices(draggedIndex.value).length

    // Determine movement direction and displacement
    const direction = draggedIndex.value === currentIndex.value ? 'same' : draggedIndex.value > currentIndex.value ? 'up' : 'down'
    const displacement = relativeDragCenterY < currentCenter ? 'above' : 'below'

    // Calculate target index
    const targetIndex = calculateTargetIndices(
      direction, 
      displacement, 
      currentIndex.value, 
      currentChildrenSize
    );

    // Get collapse group info and calculate step size
    const { parentIndex, children } = getCollapseGroupInfo(targetIndex);
    const lastChildren = parentIndex !== -1 
      ? Math.max(...children)
      : undefined;
  // console.log({parentIndex, children})
    let stepSize = calculateStepSize(direction, displacement, {
      currentIndex: currentIndex.value,
      currentChildrenSize,
      parentIndex,
      lastChildren
    });
  // stepSize = 1
    // Calculate possible index within bounds
    const possibleIndex = displacement === 'above'
      ? Math.max(
          0, 
          currentIndex.value - stepSize
      )
      : Math.min(
          itemOffset.value.length - 1 - currentIndices.value.length + 1,
          currentIndex.value + stepSize
        );
 
    // Determine final index based on distances
    if (currentIndex.value !== possibleIndex) {
      let possibleOffset = itemOffset.value[possibleIndex];
      if (possibleIndex > currentIndex.value) { //down
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

/**
 * Updates the current index of the dragged item and handles layout recomputation
 * 
 * Flow:
 * 1. Computes new potential index based on drag position
 * 2. If index changed:
 *    - Recomputes layout for affected items
 *    - Updates current index
 *    - Triggers haptic feedback
 *    - Notifies parent via callback
 * 
 * @worklet
 */
  const setCurrentIndex = useCallback(() => {
    'worklet';

    const newIndex = computeCurrentIndex();

    if (currentIndex.value !== newIndex) {
      recomputeLayout(currentIndex.value, newIndex);
      currentIndex.value = newIndex;

      runOnJS(triggerSelectionHaptic)();

      onIndexChange?.({index: newIndex});
    }
  }, [currentIndex, computeCurrentIndex, recomputeLayout, onIndexChange]);


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


/**
 * Animated reaction that handles the release of dragged items
 * 
 * This reaction triggers when:
 * 1. The gesture is no longer active (user releases finger)
 * 2. The list is in either DRAGGED or AUTOSCROLL state
 * 
 * Key responsibilities:
 * 1. State Management:
 *    - Updates list state to RELEASED
 *    - Re-enables scrolling
 *    - Resets active indices
 * 
 * 2. Position Calculation:
 *    - Calculates final positions for all moved items
 *    - Handles both upward and downward movements
 *    - Accounts for nested items (parent + children)
 * 
 * 3. Animation:
 *    - Animates items to their final positions
 *    - Uses spring animation for smooth movement
 *    - Handles different cases for moving up vs down
 * 
 * 4. Event Handling:
 *    - Triggers onDragEnd callback with movement details
 *    - Executes any registered drag end handlers
 *    - Manages reordering of data
 * 
 * The animation sequence:
 * 1. Calculate new positions
 * 2. Animate items to final positions
 * 3. Once animation completes, reorder the actual data
 * 4. Reset all animated values
 */
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

       // Callback
       let e = {
          from: draggedIndex.value,
          fromIndices: fromIndices,
          to: currentIndex.value,
          toIndices: toIndices
        };
        
        onDragEnd?.(e);

        // Execute handlers
        const handlers = dragEndHandlers.value[draggedIndex.value];
        if (Array.isArray(handlers)) {
          handlers.forEach(fn => fn(e.from, e.to));
        }
      
        // Calculate new position for the entire group
        // for move down
        const currentItemOffset = itemOffset.value[draggedIndex.value];
        const currentItemHeight = itemHeight.value[draggedIndex.value];
        const draggedItemOffset = itemOffset.value[currentIndex.value];
        const draggedItemHeight = itemHeight.value[currentIndex.value];

        // for move up
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

        // Update the collapse and collapse children
        recomputeCollapse(draggedIndex.value, currentIndex.value)
      
        // Animate to final position
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

/**
 * Handles autoscroll behavior during drag operations
 * 
 * Monitors vertical position and triggers autoscroll when:
 * 1. Item is being dragged (DRAGGED state)
 * 2. Item reaches scroll threshold areas (top/bottom)
 * 
 * Key functions:
 * - Updates current index as item moves
 * - Toggles between DRAGGED and AUTOSCROLL states
 * - Controls autoscroll trigger/direction
 */
  useAnimatedReaction(
    // Track vertical position including scroll offset
    () => currentY.value + scrollViewDragScrollTranslationY.value,
    y => {
      if (
        state.value === ReorderableListState.DRAGGED ||
        state.value === ReorderableListState.AUTOSCROLL
      ) {
        // Update item position index
        setCurrentIndex();
       
        // setCurrentIndices();

        // Check if we should trigger autoscroll
        if (dragDirection.value === scrollDirection(y)) {
          if (state.value !== ReorderableListState.AUTOSCROLL) {
            // Start autoscroll
            state.value = ReorderableListState.AUTOSCROLL;
            lastAutoscrollTrigger.value = autoscrollTrigger.value;
            autoscrollTrigger.value *= -1;
          }
        } else if (state.value === ReorderableListState.AUTOSCROLL) {
          // Stop autoscroll
          state.value = ReorderableListState.DRAGGED;
        }
      }
    },
  );

/**
 * Controls autoscroll during drag
 * 
 * - Triggers when item reaches edges
 * - Updates positions during scroll
 * - Toggles between drag/scroll states
 * - Manages scroll direction
 */
  useAnimatedReaction(
    () => autoscrollTrigger.value,
    () => {
      // Only proceed if trigger value changed and we're in autoscroll state
      if (
        autoscrollTrigger.value !== lastAutoscrollTrigger.value &&
        state.value === ReorderableListState.AUTOSCROLL
      ) {
        // Calculate current position including scroll offset
        let y = currentY.value + scrollViewDragScrollTranslationY.value;

        // Calculate how much to scroll based on direction and speed settings
        const autoscrollIncrement =
          scrollDirection(y) *
          AUTOSCROLL_CONFIG.increment *
          autoscrollSpeedScale;

        if (autoscrollIncrement !== 0) {
          // Get current scroll position
          let scrollOffset = flatListScrollOffsetY.value;
          let listRef =
            flatListRef as unknown as AnimatedRef<Animated.ScrollView>;
          
          // If we should scroll parent container instead
          if (shouldScrollParent(y) && scrollViewScrollOffsetY) {
            scrollOffset = scrollViewScrollOffsetY.value;
            listRef =
              scrollViewContainerRef as unknown as AnimatedRef<Animated.ScrollView>;
          }
          // Perform the scroll
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

  const startDrag = useCallback(
    (index: number) => {
      'worklet';
      if (state.value === ReorderableListState.IDLE) {
        resetSharedValues();

        // calculate active item + children 's height
        const childrenIndices = findChildrenIndices(index)
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
    collapse,
    startDrag,
    listContextValue,
    itemOffset,
    itemHeight,
    itemCollapse,
    itemCollapseChildren,
    draggedIndex,
    draggedIndices,
    dragY,
    duration,
  };
};