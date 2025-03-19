import { View, StyleSheet } from 'react-native';
import Example from '@/components/ThreeDDraggableList';

export default function Home() {
  return (
    <View style={styles.container}>
      <Example />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});