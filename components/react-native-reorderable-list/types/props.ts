import type {
  FlatListProps,
  MatrixTransform,
  PerspectiveTransform,
  RotateTransform,
  RotateXTransform,
  RotateYTransform,
  RotateZTransform,
  ScaleTransform,
  ScaleXTransform,
  ScaleYTransform,
  ScrollViewProps,
  SkewXTransform,
  SkewYTransform,
  TranslateXTransform,
  TranslateYTransform,
  ViewStyle,
} from 'react-native';

import {SharedValue, useAnimatedScrollHandler} from 'react-native-reanimated';

import {MaximumOneOf, SharedValueOrType} from './misc';

export interface ReorderableListReorderEvent {
  /**
   * Index of the dragged item.
   */
  from: number;
  /**
   * Index where the dragged item was released.
   */
  to: number;
}

export interface ReorderableListDragStartEvent {
  /**
   * Index of the dragged item.
   */
  index: number;
}

export interface ReorderableListIndexChangeEvent {
  /**
   * Index of the dragged item.
   */
  index: number;
}

export interface ReorderableListDragEndEvent {
  /**
   * Index of the dragged item.
   */
  from: number;
  /**
   * Index where the dragged item was released.
   */
  to: number;
}

type OmittedProps =
  | 'horizontal'
  | 'onScroll'
  | 'scrollEventThrottle'
  | 'removeClippedSubviews'
  | 'CellRendererComponent'
  | 'numColumns';

export interface ReorderableListProps<T>
  extends Omit<FlatListProps<T>, OmittedProps> {
  data: T[];
  /**
   * Function to extract the depth/level of an item in the list.
   * This is used to determine the hierarchical structure of the list.
   */
  depthExtractor?: (item: T) => number;
  /**
   * Threshold at the extremety of the list which triggers autoscroll when an item is dragged to it.
   * A value of 0.1 means that 10% of the area at the top and 10% at the bottom of the list will trigger autoscroll
   * when an item is dragged to it. Min value: `0`. Max value: `0.4`. Default: `0.1`.
   */
  autoscrollThreshold?: number;
  /**
   * Amount by which the threshold is offset at the extremety of the list.
   * For example, setting `{top: 50}` will make the autoscroll trigger 50 pixels earlier at the top.
   */
  autoscrollThresholdOffset?: {top?: number; bottom?: number};
  /**
   * Scales the autoscroll spreed at which the list scrolls when an item is dragged to the scroll areas. Default: `1`.
   */
  autoscrollSpeedScale?: number;
  /**
   * Delay in between autoscroll triggers. Can be used to tune the autoscroll smoothness.
   * Default Android: `0`.
   * Default iOS: `100`.
   */
  autoscrollDelay?: number;
  /**
   * Allows configuring the delta for autoscroll activation when dragging an item in the same direction as the autoscroll.
   * This is particularly useful when an item is dragged within the autoscroll area to account for minor unintentional movements.
   * Default: `5`.
   */
  autoscrollActivationDelta?: number;
  /**
   * Duration of the animations in milliseconds.
   * Be aware that users won't be able to drag a new item until the dragged item is released and
   * its animation to its new position ends.
   * Default: `200`.
   */
  animationDuration?: number;
  /**
   * Allows passing an object with values and/or shared values that can animate a cell, for example by using the `onDragStart` and `onDragEnd` events. Supports view style properties. Override opacity and/or transform to disable the default animation, e.g. `{opacity: 1, transform: []}`.
   */
  cellAnimations?: ReorderableListCellAnimations;
  /**
   * Whether the active item should be updated. Enables usage of `useIsActive` hook. Default: `false`.
   */
  shouldUpdateActiveItem?: boolean;
  /**
   * Wether the pan gestures necessary for dragging are enabled. Default: `true`.
   */
  panEnabled?: boolean;
  /**
   * Duration in milliseconds of the long press on the list before the pan gesture for dragging is allowed to activate.
   */
  panActivateAfterLongPress?: number;
  /**
   * Event fired after an item is released and the list is reordered.
   */
  onReorder: (event: ReorderableListReorderEvent) => void;
  /**
   * An animated scroll handler created with useAnimatedScrollHandler. See [Reanimated docs](https://docs.swmansion.com/react-native-reanimated) for further info.
   */
  onScroll?: ReturnType<typeof useAnimatedScrollHandler>;
  /**
   * Event fired when an item is dragged. Needs to be a `worklet`. See [Reanimated docs](https://docs.swmansion.com/react-native-reanimated) for further info.
   */
  onDragStart?: (event: ReorderableListDragStartEvent) => void;
  /**
   * Event fired when the dragged item is released. Needs to be a `worklet`. See [Reanimated docs](https://docs.swmansion.com/react-native-reanimated) for further info.
   */
  onDragEnd?: (event: ReorderableListDragEndEvent) => void;
  /**
   * Event fired when the index of the dragged item changes. Needs to be a `worklet`. See [Reanimated docs](https://docs.swmansion.com/react-native-reanimated) for further info.
   */
  onIndexChange?: (event: ReorderableListIndexChangeEvent) => void;
}

export type Transforms = PerspectiveTransform &
  RotateTransform &
  RotateXTransform &
  RotateYTransform &
  RotateZTransform &
  ScaleTransform &
  ScaleXTransform &
  ScaleYTransform &
  TranslateXTransform &
  TranslateYTransform &
  SkewXTransform &
  SkewYTransform &
  MatrixTransform;

export type ReorderableListCellAnimatedStyles = Omit<
  {
    [StyleKey in keyof ViewStyle]?:
      | SharedValue<ViewStyle[StyleKey]>
      | ViewStyle[StyleKey];
  },
  // omit custom type and type with JSDoc
  'transform' | 'opacity'
>;

export interface ReorderableListCellAnimations
  extends ReorderableListCellAnimatedStyles {
  /**
   * Transform animations for a dragged item.
   * Disable default animation by overriding transform, e.g. `[]` or `[{ scale: customSharedValue }]`.
   */
  transform?: Readonly<MaximumOneOf<SharedValueOrType<Transforms>>[]>;
  /**
   * Shared value to animate the opacity of a dragged item.
   * Disable default animation by overriding opacity, e.g `1`.
   */
  opacity?: SharedValue<number> | number;
}

export interface ScrollViewContainerProps
  extends Omit<ScrollViewProps, 'onScroll'> {
  /**
   * An animated scroll handler created with useAnimatedScrollHandler. See [Reanimated docs](https://docs.swmansion.com/react-native-reanimated) for further info.
   */
  onScroll?: ReturnType<typeof useAnimatedScrollHandler>;
}

export interface NestedReorderableListProps<T> extends ReorderableListProps<T> {
  /**
   * Whether the nested list is scrollable or not. If the nested list has a fixed height and it's scrollable it should be set to `true`, otherwise `false`. Default: `false`.
   */
  scrollable?: boolean;
}