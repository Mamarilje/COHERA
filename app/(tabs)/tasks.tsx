import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

const tasks = [
  { title: 'Math homework', group: 'School', due: 'Today', priority: 'high' },
  { title: 'Project meeting', group: 'Work', due: 'Today', priority: 'medium' },
  { title: 'Grocery shopping', group: 'Family', due: 'Tomorrow', priority: 'low' },
];

export default function TasksScreen() {
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.light.mutedForeground} style={styles.searchIcon} />
        <TextInput
          placeholder="Search tasks..."
          placeholderTextColor={Colors.light.mutedForeground}
          style={styles.searchInput}
        />
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabs}>
        {['All', 'To Do', 'In Progress', 'Completed', 'Overdue'].map((filter, index) => (
          <TouchableOpacity key={index} style={[styles.filterTab, index === 0 && styles.activeFilter]}>
            <Text style={[styles.filterText, index === 0 && styles.activeFilterText]}>{filter}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Date Sections */}
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Today</Text>
          {tasks.filter(t => t.due === 'Today').map((task, index) => (
            <View key={index} style={styles.taskCard}>
              <TouchableOpacity style={styles.checkbox}>
                <Ionicons name="square-outline" size={20} color={Colors.light.mutedForeground} />
              </TouchableOpacity>
              <View style={styles.taskContent}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <View style={styles.taskMeta}>
                  <Text style={styles.taskGroup}>{task.group}</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) + '20' }]}>
                    <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
                      {task.priority.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tomorrow</Text>
          {tasks.filter(t => t.due === 'Tomorrow').map((task, index) => (
            <View key={index} style={styles.taskCard}>
              <TouchableOpacity style={styles.checkbox}>
                <Ionicons name="square-outline" size={20} color={Colors.light.mutedForeground} />
              </TouchableOpacity>
              <View style={styles.taskContent}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <View style={styles.taskMeta}>
                  <Text style={styles.taskGroup}>{task.group}</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) + '20' }]}>
                    <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
                      {task.priority.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return Colors.light.priorityHigh;
    case 'medium': return Colors.light.priorityMedium;
    case 'low': return Colors.light.priorityLow;
    default: return Colors.light.mutedForeground;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.secondary + '80',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: Colors.light.text,
    fontSize: 16,
  },
  filterTabs: {
    marginBottom: 20,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: Colors.light.secondary,
  },
  activeFilter: {
    backgroundColor: Colors.light.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.mutedForeground,
  },
  activeFilterText: {
    color: Colors.light.primaryForeground,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.mutedForeground,
    marginBottom: 12,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  checkbox: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskGroup: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
    marginRight: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});
