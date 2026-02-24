import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Group } from '@/data/mockData';

interface GroupCardProps {
  group: Group;
  onPress?: (groupId: string) => void;
}

export function GroupCard({ group, onPress }: GroupCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(group.id)}>
      <View style={[styles.iconContainer, { backgroundColor: group.color }]}>
        <ThemedText style={styles.icon}>{group.icon}</ThemedText>
      </View>
      <ThemedText style={styles.name}>{group.name}</ThemedText>
      <ThemedText style={styles.count}>{group.taskCount} tasks</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 80,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  count: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
  },
});
