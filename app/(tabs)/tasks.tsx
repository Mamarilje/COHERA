import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TaskCard } from '@/components/task-card';
import { mockTasks } from '@/data/mockData';

type FilterType = 'All' | 'To Do' | 'In Progress' | 'Completed' | 'Overdue';

export default function TasksScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = useMemo(() => {
    let tasks = mockTasks;

    // Filter by status
    if (activeFilter !== 'All') {
      switch (activeFilter) {
        case 'To Do':
          tasks = tasks.filter(task => !task.completed);
          break;
        case 'In Progress':
          tasks = tasks.filter(task => !task.completed); // Assuming in progress are not completed
          break;
        case 'Completed':
          tasks = tasks.filter(task => task.completed);
          break;
        case 'Overdue':
          const now = new Date();
          tasks = tasks.filter(task => task.dueDate < now && !task.completed);
          break;
      }
    }

    // Filter by search query
    if (searchQuery) {
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return tasks;
  }, [activeFilter, searchQuery]);

  const groupedTasks = useMemo(() => {
    const groups: { [key: string]: typeof mockTasks } = {
      Today: [],
      Tomorrow: [],
      'Next Week': [],
      Later: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    filteredTasks.forEach(task => {
      const taskDate = new Date(task.dueDate.getFullYear(), task.dueDate.getMonth(), task.dueDate.getDate());
      if (taskDate.getTime() === today.getTime()) {
        groups.Today.push(task);
      } else if (taskDate.getTime() === tomorrow.getTime()) {
        groups.Tomorrow.push(task);
      } else if (taskDate <= nextWeek) {
        groups['Next Week'].push(task);
      } else {
        groups.Later.push(task);
      }
    });

    return groups;
  }, [filteredTasks]);

  const filters: FilterType[] = ['All', 'To Do', 'In Progress', 'Completed', 'Overdue'];

  return (
    <ScrollView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search tasks..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {filters.map(filter => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterTab, activeFilter === filter && styles.activeFilterTab]}
            onPress={() => setActiveFilter(filter)}
          >
            <ThemedText style={[styles.filterText, activeFilter === filter && styles.activeFilterText]}>
              {filter}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tasks Sections */}
      {Object.entries(groupedTasks).map(([section, tasks]) => {
        if (tasks.length === 0) return null;
        return (
          <View key={section} style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>{section}</ThemedText>
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  filterTab: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeFilterTab: {
    backgroundColor: '#F5C542',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  section: {
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000000',
  },
});
