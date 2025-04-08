import React, { memo, useCallback, useMemo, useRef } from 'react';
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
import { NodeType, getNodeType} from '../types';

interface ReorderableListCellProps<T>
  extends Omit<CellRendererProps<T>, 'cellKey'> {
  collapse: (index: number) => void;
  startDrag: (index: number) => void;
  itemOffset: SharedValue<number[]>;
  itemHeight: SharedValue<number[]>;
  itemMeasuredHeight: SharedValue<number[]>;
  itemCollapse: SharedValue<boolean[]>;
  dragY: SharedValue<number>;
  draggedIndex: SharedValue<number>;
  draggedIndices: SharedValue<number[]>;
  animationDuration: SharedValue<number>;
  item: T;
  data: T[];
  nodeType?: NodeType;
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
    itemMeasuredHeight,
    itemCollapse,
    itemCollapseChildren,
    dragY,
    draggedIndex,
    draggedIndices,
    animationDuration,
    item,
    data
  } = props;

  const { currentIndex, currentIndices, currentCollapsed, currentCollapsedChildren, draggedHeight, activeIndex, activeIndices, cellAnimations, depthExtractor, data: contextData } =
    useContext(ReorderableListContext);
    
  const dragHandler = useCallback(
    () => runOnUI(startDrag)(index),
    [startDrag, index],
  );

  const collapseHandler = useCallback(
    () => {
      runOnUI(collapse)(index);
    },
    [collapse, index],
  );

  const isActive = activeIndex === index;
  const isActiveChildren = activeIndices.includes(index) && !isActive;
  const isCollapsedCell = useDerivedValue(() => currentCollapsed.value.includes(index))
  const isCollapsedChildrenCell = useDerivedValue(() => currentCollapsedChildren.value.includes(index))
   const nodeType = useMemo(() => getNodeType(item, data), [item, data]);

  const contextValue = useMemo(
    () => ({
      index,
      collapseHandler,
      isCollapsed : isCollapsedCell,
      isCollapsedChildren : isCollapsedChildrenCell,
      dragHandler,
      draggedIndex,
      draggedIndices,
      isActive,
      isActiveChildren,
      nodeType
    }),
    [index, collapseHandler, isCollapsedCell.value, isCollapsedChildrenCell.value, dragHandler, draggedIndex, draggedIndices, isActive, isActiveChildren, nodeType],
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
  const isCollapse = useDerivedValue(() => itemCollapse.value[index])
  const isCollapseChildren = useDerivedValue(() => itemCollapseChildren.value[index])
  

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
    () => isCollapsedChildrenCell.value,
    (isCollapsed) => {
      console.log('here')
      // Update height based on collapse state
      height.value = withTiming(
        isCollapsed 
          ? 0 
          : itemMeasuredHeight.value[index] || itemHeight.value[index] || 0, 
        {
          duration: animationDuration.value,
          easing: Easing.out(Easing.ease),
        });
        
        
    },
    [isCollapsedChildrenCell]
  );
 

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
     
      itemCollapse.value[index] = itemCollapse.value[index] ?? false 
      itemCollapseChildren.value[index] = itemCollapseChildren.value[index] ?? false 
     
    })(e.nativeEvent.layout.y, e.nativeEvent.layout.height);

    // Update the local height value on first render
    height.value = e.nativeEvent.layout.height
    onLayout?.(e);
  };

  const handleMeausreLayout = (e: LayoutChangeEvent) => {
    runOnUI((height: number) => {
            itemMeasuredHeight.value[index] = height;
          })(e.nativeEvent.layout.height);
   
  };

  //  DEBUG
  const dCurrentIndex = useDerivedValue(() => `currIndex: ${currentIndex.value.toString()}`);
  const dIndex = useDerivedValue(() => `index: ${index}`);
  const dHeight = useDerivedValue(() => `h: ${itemHeight.value[index]?.toFixed(2).toString()}`);
  const dTop = useDerivedValue(() => `top: ${itemOffset.value[index]?.toFixed(2).toString()}`);
  const dItemCollapse= useDerivedValue(() => `c: ${isCollapse.value?.toString()}`);
  const dItemCC = useDerivedValue(() => `CC: ${isCollapseChildren.value?.toString()}`);
  const dCollapsed = useDerivedValue(() => `currC: ${isCollapsedCell.value?.toString()}`);
  const dCollapsedChildren = useDerivedValue(() => `currCC: ${isCollapsedChildrenCell.value?.toString()}`);


 Animated.addWhitelistedNativeProps({ text: true });
  const debugTextStyle = {fontSize:12, color:'blue', fontWeight:'600', minWidth:100}
  const debugTextStyle2 = {fontSize:12, color:'red', fontWeight:'600', minWidth:100}

 
  return (
   
    <ReorderableCellContext.Provider value={contextValue}>
      {/* Hidden view for measuring full height */}
      <View 
        style={{
          position: 'absolute',
          opacity: 0,
          zIndex: -1,
          width: '100%',
          pointerEvents: 'none'
        }}
        onLayout={handleMeausreLayout}
      >
        {children}
      </View>
      
      <Animated.View style={animatedStyle} onLayout={handleLayout}>
        <View style={{
          position:'absolute',
          right:8,
          zIndex:1000,
          alignItems:'flex-end',
          // width:180,
      backgroundColor: '#fff'
        }}>
          <ReText text={dCurrentIndex} style={debugTextStyle}/>
          <ReText text={dIndex} style={debugTextStyle}/>
          <ReText text={dHeight} style={debugTextStyle}/>
          <ReText text={dTop} style={debugTextStyle}/>
          {/* <ReText text={dCollapsedRef} style={debugTextStyle2}/>
          <ReText text={dCollapsedChildrenRef} style={debugTextStyle2}/> */}
          <ReText text={dItemCollapse} style={debugTextStyle2}/>
          <ReText text={dItemCC} style={debugTextStyle2}/>
          <ReText text={dCollapsed} style={debugTextStyle2}/>
          <ReText text={dCollapsedChildren} style={debugTextStyle2}/>
        </View>
        {children}
      </Animated.View>
    </ReorderableCellContext.Provider>
  );
});

