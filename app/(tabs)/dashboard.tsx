import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

const stats = { todo: 6, inProgress: 1, completed: 1 };
const groups = [
  { name: 'School', icon: 'book', color: '#2196F3' },
  { name: 'Work', icon: 'briefcase', color: '#F57C00' },
  { name: 'Family', icon: 'home', color: '#E91E63' },
];
const tasks = [
  { title: 'Math homework', group: 'School', due: '2h', priority: 'high' },
  { title: 'Project meeting', group: 'Work', due: '4h', priority: 'medium' },
  { title: 'Grocery shopping', group: 'Family', due: '6h', priority: 'low' },
];

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hello, Mark! 👋</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications" size={24} color={Colors.light.text} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>M</Text>
          </View>
        </View>
      </View>

      {/* Task Overview */}
      <View style={styles.overviewCard}>
        <Text style={styles.sectionTitle}>Task Overview</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.todo}</Text>
            <Text style={styles.statLabel}>To Do</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.inProgress}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>
      </View>

      {/* My Groups */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Groups</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupsScroll}>
          {groups.map((group, index) => (
            <View key={index} style={[styles.groupCard, { backgroundColor: group.color + '20' }]}>
              <Ionicons name={group.icon as any} size={24} color={group.color} />
              <Text style={[styles.groupName, { color: group.color }]}>{group.name}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.addGroup}>
            <Ionicons name="add" size={24} color={Colors.light.mutedForeground} />
            <Text style={styles.addGroupText}>New</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Today's Tasks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Tasks</Text>
        {tasks.map((task, index) => (
          <View key={index} style={styles.taskCard}>
            <TouchableOpacity style={styles.checkbox}>
              <Ionicons name="square-outline" size={20} color={Colors.light.mutedForeground} />
            </TouchableOpacity>
            <View style={styles.taskContent}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <View style={styles.taskMeta}>
                <Text style={styles.taskGroup}>{task.group}</Text>
                <Text style={styles.taskDue}>{task.due}</Text>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginRight: 16,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.priorityHigh,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.primaryForeground,
  },
  overviewCard: {
    backgroundColor: Colors.light.primary,
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.primaryForeground,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    backgroundColor: Colors.light.background + '40',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  groupsScroll: {
    marginTop: 12,
  },
  groupCard: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupName: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  addGroup: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addGroupText: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
    marginTop: 4,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  taskDue: {
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
