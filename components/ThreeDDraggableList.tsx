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

const getRandomHeight = () => Math.round(Math.random() * 100) + 40

const initialData: Item[] = [
  { id: '1', title: 'Project Documentation', parentId: null, description: getRandomDescription() , height: getRandomHeight() },
  { id: '2', title: 'Getting Started Guide', parentId: '1', description: getRandomDescription() , height: getRandomHeight() },
  { id: '3', title: 'Installation Steps', parentId: '2', description: getRandomDescription() , height: getRandomHeight() },
  { id: '4', title: 'Configuration', parentId: '2', description: getRandomDescription() , height: getRandomHeight() },
  { id: '5', title: 'API Reference', parentId: '1', description: getRandomDescription() , height: getRandomHeight() },
  { id: '6', title: 'Endpoints', parentId: '5', description: getRandomDescription() , height: getRandomHeight() },
  { id: '7', title: 'Authentication', parentId: '5', description: getRandomDescription() , height: getRandomHeight() },
  { id: '8', title: 'Development Tools', parentId: null, description: getRandomDescription() , height: getRandomHeight() },
  { id: '9', title: 'Code Editor Setup', parentId: '8', description: getRandomDescription() , height: getRandomHeight() },
  { id: '10', title: 'Extensions', parentId: '9', description: getRandomDescription() , height: getRandomHeight() },
  { id: '11', title: 'Debug Tools', parentId: '8', description: getRandomDescription() , height: getRandomHeight() },
  { id: '12', title: 'Project Structure', parentId: null, description: getRandomDescription() , height: getRandomHeight() },
  { id: '13', title: 'Core Components', parentId: '12', description: getRandomDescription() , height: getRandomHeight() },
  { id: '14', title: 'UI Elements', parentId: '13', description: getRandomDescription() , height: getRandomHeight() },
  { id: '15', title: 'State Management', parentId: '12', description: getRandomDescription() , height: getRandomHeight() },
  { id: '16', title: 'Redux Setup', parentId: '15', description: getRandomDescription() , height: getRandomHeight() },
  { id: '17', title: 'Testing', parentId: null, description: getRandomDescription() , height: getRandomHeight() },
  { id: '18', title: 'Unit Tests', parentId: '17', description: getRandomDescription() , height: getRandomHeight() },
  { id: '19', title: 'Integration Tests', parentId: '17', description: getRandomDescription() , height: getRandomHeight() },
  { id: '20', title: 'E2E Testing', parentId: '17', description: getRandomDescription() , height: getRandomHeight() },
];

const ListItem = React.memo(({ item, data }: { item: Item; data: Item[] }) => {
  const drag = useReorderableDrag();
  const depth = getItemDepth(item, data);

  return (
    <Pressable onLongPress={drag} style={[styles.item, {height:item.height}]}>
      <Text style={styles.title}>
        {depth === 0 ? '📁' : depth === 1 ? '📄' : '📎'} {item.title} h:{item.height}
      </Text>
      <Text style={styles.description}>{item.description}</Text>
    </Pressable>
  );
});

export default function ThreeDDraggableList() {
  const [data, setData] = useState(initialData);

  // const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
  //   setData(current => {
  //     const newData = [...current];
  //     const [removed] = newData.splice(from, 1);
  //     newData.splice(to, 0, removed);
  //     return newData;
  //   });
  // };

  const handleReorder = ({ from, to, fromIndices, toIndices }: ReorderableListReorderEvent) => {
    setData(current => {
      const newData = [...current];
      
      // First remove all items from highest to lowest index to maintain index integrity
      const sortedFromIndices = [...fromIndices].sort((a, b) => b - a);
      const removedItems = sortedFromIndices.map(index => newData.splice(index, 1)[0]);
      
      // Then insert all items from lowest to highest target index
      removedItems.reverse().forEach((item, i) => {
        newData.splice(toIndices[i], 0, item);
      });
  
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