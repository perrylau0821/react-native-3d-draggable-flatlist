import { View, StyleSheet } from 'react-native';
import { DraggableList } from '@/components/DraggableList';

export default function Home() {
  return (
    <View style={styles.container}>
      <DraggableList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});