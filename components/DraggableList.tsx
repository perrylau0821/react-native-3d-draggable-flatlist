import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

const WINDOW_HEIGHT = Dimensions.get('window').height;
const ITEM_HEIGHT = 80;

interface Item {
  id: string;
  title: string;
  color: string;
}

interface DraggableItemProps {
  item: Item;
  index: number;
  moveItem: (from: number, to: number) => void;
  scrollY: Animated.SharedValue<number>;
}

function DraggableItem({ item, index, moveItem, scrollY }: DraggableItemProps) {
  const translateY = useSharedValue(0);
  const isActive = useSharedValue(false);

  const gestureHandler = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      zIndex: isActive.value ? 1 : 0,
      shadowOpacity: withSpring(isActive.value ? 0.2 : 0),
      elevation: isActive.value ? 5 : 0,
    };
  });

  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    'worklet';

    if (event.state === 1) { // BEGAN
      isActive.value = true;
    }

    if (event.state === 2) { // ACTIVE
      translateY.value = event.translationY;
      const newPosition = event.translationY + (index * ITEM_HEIGHT);
      scrollY.value = newPosition;
    }

    if (event.state === 4 || event.state === 5) { // END or CANCELLED
      isActive.value = false;
      translateY.value = withSpring(0);

      const newIndex = Math.round(scrollY.value / ITEM_HEIGHT);
      if (newIndex !== index && newIndex >= 0) {
        runOnJS(moveItem)(index, Math.max(0, Math.min(newIndex, 4)));
      }
    }
  };

  return (
    <PanGestureHandler 
      onGestureEvent={onGestureEvent}
      activeOffsetY={[-5, 5]}>
      <Animated.View style={[styles.item, { backgroundColor: item.color }, gestureHandler]}>
        <Text style={styles.itemText}>{item.title}</Text>
        <Text style={styles.dragHint}>Long press and drag to reorder</Text>
      </Animated.View>
    </PanGestureHandler>
  );
}

export function DraggableList() {
  const [items, setItems] = React.useState<Item[]>([
    { id: '1', title: 'Item 1', color: '#FFB6C1' },
    { id: '2', title: 'Item 2', color: '#98FB98' },
    { id: '3', title: 'Item 3', color: '#87CEEB' },
    { id: '4', title: 'Item 4', color: '#DDA0DD' },
    { id: '5', title: 'Item 5', color: '#F0E68C' },
  ]);

  const scrollY = useSharedValue(0);

  const moveItem = (from: number, to: number) => {
    const newItems = [...items];
    const item = newItems.splice(from, 1)[0];
    newItems.splice(to, 0, item);
    setItems(newItems);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <Text style={styles.header}>Draggable List</Text>
      {items.map((item, index) => (
        <DraggableItem
          key={item.id}
          item={item}
          index={index}
          moveItem={moveItem}
          scrollY={scrollY}
        />
      ))}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  item: {
    height: ITEM_HEIGHT,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowRadius: 8,
    elevation: 3,
  },
  itemText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  dragHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});