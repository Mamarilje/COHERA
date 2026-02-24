import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PriorityBadge } from '@/components/priority-badge';
import { Task, getGroupById } from '@/data/mockData';

interface TaskCardProps {
  task: Task;
  onToggle?: (taskId: string) => void;
}

function CustomCheckbox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.checkbox} onPress={onPress}>
      <View style={[styles.checkboxInner, checked && styles.checked]} />
    </TouchableOpacity>
  );
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const group = getGroupById(task.groupId);
  const dueTime = task.dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity style={styles.card} onPress={() => onToggle?.(task.id)}>
      <View style={styles.leftSection}>
        <CustomCheckbox
          checked={task.completed}
          onPress={() => onToggle?.(task.id)}
        />
        <View style={styles.taskInfo}>
          <ThemedText
            style={[styles.title, task.completed && styles.completed]}
            numberOfLines={1}
          >
            {task.title}
          </ThemedText>
          <View style={styles.meta}>
            <ThemedText style={styles.group}>{group?.icon} {group?.name}</ThemedText>
            <ThemedText style={styles.time}>{dueTime}</ThemedText>
          </View>
        </View>
      </View>
      <PriorityBadge priority={task.priority} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#F5C542',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  checked: {
    backgroundColor: '#F5C542',
  },
  taskInfo: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  completed: {
    textDecorationLine: 'line-through',
    color: '#000000',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  group: {
    fontSize: 14,
    color: '#000000',
  },
  time: {
    fontSize: 14,
    color: '#000000',
  },
});
