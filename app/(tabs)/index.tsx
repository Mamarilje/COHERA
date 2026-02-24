import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GroupCard } from '@/components/group-card';
import { TaskCard } from '@/components/task-card';
import { mockUser, mockGroups, mockTasks, getTasksCount } from '@/data/mockData';

export default function HomeScreen() {
  const { toDo, inProgress, completed } = getTasksCount();
  const todayTasks = mockTasks.filter(task => {
    const today = new Date();
    return task.dueDate.toDateString() === today.toDateString();
  });

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.greeting}>
          <ThemedText type="title">Hello, {mockUser.name}!</ThemedText>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconButton}>
            <IconSymbol name="paperplane.fill" size={24} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <ThemedText style={styles.avatar}>{mockUser.avatar}</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Task Overview */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Task Overview</ThemedText>
        <View style={styles.overviewCard}>
          <View style={styles.overviewItem}>
            <ThemedText style={styles.overviewNumber}>{toDo}</ThemedText>
            <ThemedText style={styles.overviewLabel}>To Do</ThemedText>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <ThemedText style={styles.overviewNumber}>{inProgress}</ThemedText>
            <ThemedText style={styles.overviewLabel}>In Progress</ThemedText>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <ThemedText style={styles.overviewNumber}>{completed}</ThemedText>
            <ThemedText style={styles.overviewLabel}>Completed</ThemedText>
          </View>
        </View>
      </View>

      {/* My Groups */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>My Groups</ThemedText>
          <TouchableOpacity>
            <ThemedText style={styles.addButton}>+ New Group</ThemedText>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupsScroll}>
          {mockGroups.map(group => (
            <GroupCard key={group.id} group={group} />
          ))}
        </ScrollView>
      </View>

      {/* Today's Tasks */}
      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Today's Tasks</ThemedText>
        {todayTasks.length > 0 ? (
          todayTasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))
        ) : (
          <ThemedText style={styles.noTasks}>No tasks for today!</ThemedText>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    flex: 1,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 16,
    padding: 8,
  },
  avatar: {
    fontSize: 24,
  },
  section: {
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    color: '#F5C542',
    fontSize: 16,
    fontWeight: '600',
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overviewItem: {
    alignItems: 'center',
  },
  overviewNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F5C542',
  },
  overviewLabel: {
    fontSize: 14,
    color: '#000000',
    marginTop: 4,
  },
  overviewDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
  },
  groupsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  noTasks: {
    textAlign: 'center',
    color: '#000000',
    fontStyle: 'italic',
    padding: 20,
  },
});
