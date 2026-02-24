import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { mockTasks, mockGroups, mockUser } from '@/data/mockData';

type ViewMode = 'Month' | 'Week' | 'Day';

export default function CalendarScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('Month');

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const getTasksForDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return mockTasks.filter(task => {
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === date.toDateString();
    });
  };

  const days = getDaysInMonth(currentDate);
  const today = new Date();
  const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

  const totalTasks = mockTasks.length;
  const totalGroups = mockGroups.length;
  const completedTasks = mockTasks.filter(task => task.completed).length;
  const points = completedTasks * 10; // Mock points

  return (
    <ScrollView style={styles.container}>
      {/* Header with Month/Year and Navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateMonth('prev')}>
          <IconSymbol name="chevron.left" size={24} color="#000000" />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.monthYear}>
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </ThemedText>
        <TouchableOpacity onPress={() => navigateMonth('next')}>
          <IconSymbol name="chevron.right" size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        {(['Month', 'Week', 'Day'] as ViewMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[styles.viewButton, viewMode === mode && styles.activeViewButton]}
            onPress={() => setViewMode(mode)}
          >
            <ThemedText style={[styles.viewButtonText, viewMode === mode && styles.activeViewButtonText]}>
              {mode}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarContainer}>
        {/* Day Headers */}
        <View style={styles.dayHeaders}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <ThemedText key={day} style={styles.dayHeader}>{day}</ThemedText>
          ))}
        </View>

        {/* Days Grid */}
        <View style={styles.daysGrid}>
          {days.map((day, index) => {
            const tasksForDay = day ? getTasksForDay(day) : [];
            const isToday = isCurrentMonth && day === today.getDate();
            return (
              <TouchableOpacity
                key={index}
                style={[styles.dayCell, isToday && styles.todayCell]}
              >
                <ThemedText style={[styles.dayNumber, isToday && styles.todayText]}>
                  {day}
                </ThemedText>
                {tasksForDay.length > 0 && (
                  <View style={styles.taskIndicator}>
                    <ThemedText style={styles.taskCount}>{tasksForDay.length}</ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Activity Stats */}
      <View style={styles.statsContainer}>
        <ThemedText type="subtitle" style={styles.statsTitle}>Activity Stats</ThemedText>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>{totalTasks}</ThemedText>
            <ThemedText style={styles.statLabel}>Tasks</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>{totalGroups}</ThemedText>
            <ThemedText style={styles.statLabel}>Groups</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>{points}</ThemedText>
            <ThemedText style={styles.statLabel}>Points</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>1</ThemedText>
            <ThemedText style={styles.statLabel}>Team</ThemedText>
          </View>
        </View>
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
    backgroundColor: '#FFFFFF',
  },
  monthYear: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  viewToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  activeViewButton: {
    backgroundColor: '#F5C542',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  activeViewButtonText: {
    color: '#FFFFFF',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    width: 32,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100% / 7
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 1,
    borderRadius: 8,
  },
  todayCell: {
    backgroundColor: '#F5C542',
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  todayText: {
    color: '#FFFFFF',
  },
  taskIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  taskCount: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  statsContainer: {
    margin: 20,
    marginTop: 0,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 70,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F5C542',
  },
  statLabel: {
    fontSize: 14,
    color: '#000000',
    marginTop: 4,
  },
});
