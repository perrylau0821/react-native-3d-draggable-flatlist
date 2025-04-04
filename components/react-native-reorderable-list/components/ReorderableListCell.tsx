import React, { memo, useCallback, useMemo } from 'react';
import { CellRendererProps, LayoutChangeEvent,View, Text, TextInput } from 'react-native';
import { ReText}  from 'react-native-redash';

import Animated, {
  Easing,
  SharedValue,
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  withSpring,
  useAnimatedProps
} from 'react-native-reanimated';

import { ReorderableCellContext, ReorderableListContext } from '../contexts';
import { useContext } from '../hooks';
import { applyAnimatedStyles } from './helpers';

interface ReorderableListCellProps<T>
  extends Omit<CellRendererProps<T>, 'cellKey'> {
  collapse: (index: number) => void;
  startDrag: (index: number) => void;
  itemOffset: SharedValue<number[]>;
  itemHeight: SharedValue<number[]>;
  itemCollapse: SharedValue<boolean[]>;
  dragY: SharedValue<number>;
  draggedIndex: SharedValue<number>;
  draggedIndices: SharedValue<number[]>;
  animationDuration: SharedValue<number>;
  item: T;
  data: T[];
}

export const ReorderableListCell = memo(function ReorderableListCell<T>(
  props: ReorderableListCellProps<T>
) {
  const {
    index,
    collapse,
    startDrag,
    children,
    onLayout,
    itemOffset,
    itemHeight,
    itemCollapse,
    dragY,
    draggedIndex,
    draggedIndices,
    animationDuration,
    item,
    data
  } = props;

  const { currentIndex, currentIndices, collapsedNodes, collapsedChildren, draggedHeight, activeIndex, activeIndices, cellAnimations, depthExtractor, data: contextData } =
    useContext(ReorderableListContext);
    
  const dragHandler = useCallback(
    () => runOnUI(startDrag)(index),
    [startDrag, index],
  );

  const collapseHandler = useCallback(
    () => runOnUI(collapse)(index),
    [collapse, index],
  );

  const isActive = activeIndex === index;
  const isActiveChildren = activeIndices.includes(index) && !isActive;
  const isCollapsed = itemCollapse.value[index]
  const isCollapsedChildren = itemCollapse.value.includes(index) && !isCollapsed;

  const contextValue = useMemo(
    () => ({
      index,
      collapseHandler,
      isCollapsed,
      isCollapsedChildren,
      dragHandler,
      draggedIndex,
      draggedIndices,
      isActive,
      isActiveChildren
    }),
    [index, collapseHandler, isCollapsed, isCollapsedChildren, dragHandler, draggedIndex, draggedIndices, isActive, isActiveChildren],
  );

  // Calculate indentation based on depth
  const depth = depthExtractor ? depthExtractor(item) : 0;
  const indentation = depth * 24;
 

  // Keep separate animated reactions that update itemTranslateY
  // otherwise animations might stutter if multiple are triggered
  // (even in other cells, e.g. released item and reordering cells)
  const itemTranslateY = useSharedValue(0);
  const isActiveCell = useDerivedValue(() => draggedIndex.value === index);
  const isActiveCells = useDerivedValue(() => draggedIndices.value.includes(index))
  
  const height = useDerivedValue(() => itemHeight.value[index])
  const isCollapsedCell = useDerivedValue(() => collapsedNodes.value.includes(index))
  const isCollapsedChildrenCells = useDerivedValue(() => collapsedChildren.value.includes(index))

  useAnimatedReaction(
    () => dragY.value,
    () => {
      if (
        // index === draggedIndex.value &&
        draggedIndices.value.includes(index) &&
        currentIndex.value >= 0 &&
        draggedIndex.value >= 0
      ) {
        itemTranslateY.value = dragY.value 
      }
    },
  );

  useAnimatedReaction(
    () => currentIndex.value,
    () => {
      if (
        !draggedIndices.value.includes(index) &&
        currentIndex.value >= 0 &&
        draggedIndex.value >= 0
      ) {
        const childrenLength = draggedIndices.value.length-1
        
        const moveUp = currentIndex.value > draggedIndex.value;
        const startMove = Math.min(draggedIndex.value, currentIndex.value);
        const endMove = Math.max(draggedIndex.value + childrenLength, currentIndex.value + childrenLength);

        let newValue = 0;
       
        if (index >= startMove && index <= endMove) {
          newValue = moveUp ? -draggedHeight.value : draggedHeight.value;
        }

        if (newValue !== itemTranslateY.value) {
          itemTranslateY.value = withTiming(newValue, {
            duration: animationDuration.value,
            easing: Easing.out(Easing.ease),
          });
        }
      }
    },
  );

  useAnimatedReaction(
    () => collapsedChildren.value,
    (current) => {
      // Update the local itemCollapse and height value
      isCollapsedChildrenCells.value = current.includes(index);

      // height.value = withTiming(isCollapsedChildrenCells.value ? 0 : itemHeight.value[index], {
      //       duration: animationDuration.value,
      //       easing: Easing.out(Easing.ease),
      //     });
    },
  )

  const animatedStyle = useAnimatedStyle(() => {
    
    if (isActiveCell.value || isActiveCells.value) {
      const transform = [{translateY: itemTranslateY.value}];
      if (Array.isArray(cellAnimations.transform)) {
        const customTransform = cellAnimations.transform.map(x =>
          applyAnimatedStyles({}, x),
        ) as [];
        transform.push(...customTransform);
      }

      return applyAnimatedStyles(
        {
          transform,
          zIndex: 999,
          paddingLeft: indentation,
          height: height.value,
          overflow: 'hidden'
        },
        cellAnimations,
        ['transform'],
      );
    }
   
    return {
      transform: [{translateY: itemTranslateY.value}],
      zIndex: 0,
      paddingLeft: indentation,
      height: height.value,
      overflow: 'hidden'
    };
  });

  const handleLayout = (e: LayoutChangeEvent) => {
    runOnUI((y: number, height: number) => {
      itemOffset.value[index] = y;
      itemHeight.value[index] = height;
      itemCollapse.value[index] = false

    })(e.nativeEvent.layout.y, e.nativeEvent.layout.height);

    // Update the local height value on first render
    height.value = e.nativeEvent.layout.height
    onLayout?.(e);
  };

  //  DEBUG
  const dCurrentIndex = useDerivedValue(() => `currIndex: ${currentIndex.value.toString()}`);
  const dIndex = useDerivedValue(() => `index: ${index}`);
  const dHeight = useDerivedValue(() => `h: ${itemHeight.value[index]?.toString()}`);
  const dTop = useDerivedValue(() => `top: ${itemOffset.value[index]?.toString()}`);
  const dCollapsed = useDerivedValue(() => `collapse: ${isCollapsedCell.value?.toString()}`);

 Animated.addWhitelistedNativeProps({ text: true });
  const debugTextStyle = {fontSize:12, color:'blue', fontWeight:'600'}

 
  return (
   
    <ReorderableCellContext.Provider value={contextValue}>
      <Animated.View style={animatedStyle} onLayout={handleLayout}>
        <View style={{
          position:'absolute',
          right:8,
          zIndex:1000,
          alignItems:'flex-end',
          width:100,
        }}>
          <ReText text={dCurrentIndex} style={debugTextStyle}/>
          <ReText text={dIndex} style={debugTextStyle}/>
          <ReText text={dHeight} style={debugTextStyle}/>
          <ReText text={dTop} style={debugTextStyle}/>
          <ReText text={dCollapsed} style={debugTextStyle}/>
        </View>
        {children}
      </Animated.View>
    </ReorderableCellContext.Provider>
  );
});

