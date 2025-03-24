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
  description: string;
}

const loremIpsum = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;

const getRandomDescription = () => {
  const words = loremIpsum.split(' ');
  const length = Math.floor(Math.random() * 50) + 10; // Random length between 10 and 60 words
  return words.slice(0, length).join(' ');
};

const initialData: Item[] = [
  { id: '1', title: 'Item 1', depth: 0, description: getRandomDescription() },
  { id: '2', title: 'Subitem 1', depth: 1, description: getRandomDescription() },
  { id: '3', title: 'Subitem 2', depth: 1, description: getRandomDescription() },
  { id: '4', title: 'Item 2', depth: 0, description: getRandomDescription() },
  { id: '5', title: 'Subitem 3', depth: 1, description: getRandomDescription() },
  { id: '6', title: 'Deep item', depth: 2, description: getRandomDescription() },
];

const ListItem = React.memo(({ item }: { item: Item }) => {
  const drag = useReorderableDrag();

  return (
    <Pressable onLongPress={drag} style={styles.item}>
      <Text style={styles.title}>
        {item.depth === 0 ? '📁' : item.depth === 1 ? '📄' : '📎'} {item.title}
      </Text>
      <Text style={styles.description}>{item.description}</Text>
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
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  }
});