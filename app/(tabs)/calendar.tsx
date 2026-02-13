import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

const schedule = [
  { time: '9:00', title: 'Math class', priority: 'high' },
  { time: '11:00', title: 'Team meeting', priority: 'medium' },
  { time: '2:00', title: 'Project work', priority: 'low' },
];

const activityStats = [
  { label: 'Tasks', value: 24, icon: 'list' },
  { label: 'Groups', value: 3, icon: 'people' },
  { label: 'Points', value: 150, icon: 'trophy' },
  { label: 'Team', value: 8, icon: 'person' },
];

export default function CalendarScreen() {
  return (
    <ScrollView style={styles.container}>
      {/* Month Navigator */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>October 2024</Text>
        <TouchableOpacity>
          <Ionicons name="chevron-forward" size={24} color={Colors.light.text} />
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity style={styles.toggleButton}>
          <Text style={styles.toggleText}>Day</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleButton, styles.activeToggle]}>
          <Text style={[styles.toggleText, styles.activeToggleText]}>Week</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toggleButton}>
          <Text style={styles.toggleText}>Month</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarGrid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Text key={day} style={styles.dayLabel}>{day}</Text>
        ))}
        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
          <TouchableOpacity key={day} style={[styles.dayCell, day === 15 && styles.today]}>
            <Text style={[styles.dayNumber, day === 15 && styles.todayText]}>{day}</Text>
            {day === 10 && <View style={styles.taskDot} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Priority Filter */}
      <View style={styles.priorityFilter}>
        {['High', 'Medium', 'Low'].map(priority => (
          <TouchableOpacity key={priority} style={styles.priorityChip}>
            <Text style={styles.priorityChipText}>{priority}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Today's Schedule */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Schedule</Text>
        {schedule.map((item, index) => (
          <View key={index} style={[styles.scheduleItem, { borderLeftColor: getPriorityColor(item.priority) }]}>
            <Text style={styles.scheduleTime}>{item.time}</Text>
            <Text style={styles.scheduleTitle}>{item.title}</Text>
          </View>
        ))}
      </View>

      {/* Activity Stats */}
      <View style={styles.statsContainer}>
        {activityStats.map((stat, index) => (
          <View key={index} style={styles.statBox}>
            <View style={styles.statIcon}>
              <Ionicons name={stat.icon as any} size={20} color={Colors.light.primary} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
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
    default: return Colors.light.primary;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.light.secondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeToggle: {
    backgroundColor: Colors.light.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.mutedForeground,
  },
  activeToggleText: {
    color: Colors.light.primaryForeground,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  dayLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.mutedForeground,
    marginBottom: 8,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  today: {
    backgroundColor: Colors.light.primary,
    borderRadius: 20,
  },
  dayNumber: {
    fontSize: 16,
    color: Colors.light.text,
  },
  todayText: {
    color: Colors.light.primaryForeground,
    fontWeight: 'bold',
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.primary,
    position: 'absolute',
    bottom: 2,
  },
  priorityFilter: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.light.secondary,
    marginRight: 8,
  },
  priorityChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.mutedForeground,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginBottom: 16,
  },
  scheduleItem: {
    backgroundColor: Colors.light.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  scheduleTime: {
    fontSize: 14,
    color: Colors.light.mutedForeground,
    marginBottom: 4,
  },
  scheduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.goldLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.mutedForeground,
  },
});
