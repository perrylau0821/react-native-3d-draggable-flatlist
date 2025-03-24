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

const loremIpsum = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;

const getRandomDescription = () => {
  const words = loremIpsum.split(' ');
  const length = Math.floor(Math.random() * 10) + 5; // Random length between 5 and 15 words
  return words.slice(0, length).join(' ');
};

const initialData: Item[] = [
  { id: '1', title: 'Project Documentation', depth: 0, description: getRandomDescription() },
  { id: '2', title: 'Getting Started Guide', depth: 1, description: getRandomDescription() },
  { id: '3', title: 'Installation Steps', depth: 2, description: getRandomDescription() },
  { id: '4', title: 'Configuration', depth: 2, description: getRandomDescription() },
  { id: '5', title: 'API Reference', depth: 1, description: getRandomDescription() },
  { id: '6', title: 'Endpoints', depth: 2, description: getRandomDescription() },
  { id: '7', title: 'Authentication', depth: 2, description: getRandomDescription() },
  { id: '8', title: 'Development Tools', depth: 0, description: getRandomDescription() },
  { id: '9', title: 'Code Editor Setup', depth: 1, description: getRandomDescription() },
  { id: '10', title: 'Extensions', depth: 2, description: getRandomDescription() },
  { id: '11', title: 'Debug Tools', depth: 1, description: getRandomDescription() },
  { id: '12', title: 'Project Structure', depth: 0, description: getRandomDescription() },
  { id: '13', title: 'Core Components', depth: 1, description: getRandomDescription() },
  { id: '14', title: 'UI Elements', depth: 2, description: getRandomDescription() },
  { id: '15', title: 'State Management', depth: 1, description: getRandomDescription() },
  { id: '16', title: 'Redux Setup', depth: 2, description: getRandomDescription() },
  { id: '17', title: 'Testing', depth: 0, description: getRandomDescription() },
  { id: '18', title: 'Unit Tests', depth: 1, description: getRandomDescription() },
  { id: '19', title: 'Integration Tests', depth: 1, description: getRandomDescription() },
  { id: '20', title: 'E2E Testing', depth: 1, description: getRandomDescription() },
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