import React, { useState } from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import ReorderableList, {
  ReorderableListReorderEvent,
  useReorderableDrag,
} from './react-native-reorderable-list';

interface Item {
  id: string;
  title: string;
  parentId: string | null;
  description: string;
}

const loremIpsum = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;

const getRandomDescription = () => {
  const words = loremIpsum.split(' ');
  const length = Math.floor(Math.random() * 20); // Random length between 0 and 28 words
  return words.slice(0, length).join(' ');
};

// Helper function to get item depth based on parentId
const getItemDepth = (item: Item, data: Item[]): number => {
  if (!item.parentId) return 0;
  
  const parent = data.find(i => i.id === item.parentId);
  if (!parent) return 0;
  
  return getItemDepth(parent, data) + 1;
};

const initialData: Item[] = [
  { id: '1', title: 'Project Documentation', parentId: null, description: getRandomDescription() },
  { id: '2', title: 'Getting Started Guide', parentId: '1', description: getRandomDescription() },
  { id: '3', title: 'Installation Steps', parentId: '2', description: getRandomDescription() },
  { id: '4', title: 'Configuration', parentId: '2', description: getRandomDescription() },
  { id: '5', title: 'API Reference', parentId: '1', description: getRandomDescription() },
  { id: '6', title: 'Endpoints', parentId: '5', description: getRandomDescription() },
  { id: '7', title: 'Authentication', parentId: '5', description: getRandomDescription() },
  { id: '8', title: 'Development Tools', parentId: null, description: getRandomDescription() },
  { id: '9', title: 'Code Editor Setup', parentId: '8', description: getRandomDescription() },
  { id: '10', title: 'Extensions', parentId: '9', description: getRandomDescription() },
  { id: '11', title: 'Debug Tools', parentId: '8', description: getRandomDescription() },
  { id: '12', title: 'Project Structure', parentId: null, description: getRandomDescription() },
  { id: '13', title: 'Core Components', parentId: '12', description: getRandomDescription() },
  { id: '14', title: 'UI Elements', parentId: '13', description: getRandomDescription() },
  { id: '15', title: 'State Management', parentId: '12', description: getRandomDescription() },
  { id: '16', title: 'Redux Setup', parentId: '15', description: getRandomDescription() },
  { id: '17', title: 'Testing', parentId: null, description: getRandomDescription() },
  { id: '18', title: 'Unit Tests', parentId: '17', description: getRandomDescription() },
  { id: '19', title: 'Integration Tests', parentId: '17', description: getRandomDescription() },
  { id: '20', title: 'E2E Testing', parentId: '17', description: getRandomDescription() },
];

const ListItem = React.memo(({ item, data }: { item: Item; data: Item[] }) => {
  const drag = useReorderableDrag();
  const depth = getItemDepth(item, data);

  return (
    <Pressable onLongPress={drag} style={styles.item}>
      <Text style={styles.title}>
        {depth === 0 ? '📁' : depth === 1 ? '📄' : '📎'} {item.title}
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
        renderItem={({ item }) => <ListItem item={item} data={data} />}
        keyExtractor={item => item.id}
        depthExtractor={item => getItemDepth(item, data)}
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
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  }
});