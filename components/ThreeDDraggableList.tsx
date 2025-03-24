// components/ThreeDDraggableList.tsx
import React, { useState } from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import ReorderableList, {
  ReorderableListReorderEvent,
  useReorderableDrag,
} from './react-native-reorderable-list';

interface Item {
  id: string;
  title: string;
  depth: number;
}

const initialData: Item[] = [
  { id: '1', title: 'Item 1', depth: 0 },
  { id: '2', title: 'Subitem 1', depth: 1 },
  { id: '3', title: 'Subitem 2', depth: 1 },
  { id: '4', title: 'Item 2', depth: 0 },
  { id: '5', title: 'Subitem 3', depth: 1 },
  { id: '6', title: 'Deep item', depth: 2 },
];

const ListItem = React.memo(({ item }: { item: Item }) => {
  const drag = useReorderableDrag();

  return (
    <Pressable onLongPress={drag} style={styles.item}>
      <Text style={styles.text}>
        {item.depth === 0 ? '📁' : item.depth === 1 ? '📄' : '📎'} {item.title}
      </Text>
    </Pressable>
  );
});

export default function ThreeDDraggableList() {
  const [data, setData] = useState(initialData);

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    setData(current => {
      const newData = [...current];
      const [removed] = newData.splice(from, 1);
      newData.splice(to, 0, removed);
      return newData;
    });
  };

  return (
    <View style={styles.container}>
      <ReorderableList
        data={data}
        onReorder={handleReorder}
        renderItem={({ item }) => <ListItem item={item} />}
        keyExtractor={item => item.id}
        depthExtractor={item => item.depth}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  item: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  text: {
    fontSize: 16,
  }
});
