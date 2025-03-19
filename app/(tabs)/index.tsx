import { StyleSheet, View } from 'react-native';
import ThreeDDraggableList from '@/components/ThreeDDraggableList';

export default function Home() {
  return (
    <View style={styles.container}>
      <ThreeDDraggableList />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});