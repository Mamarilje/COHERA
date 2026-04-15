import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { collection, query, getDocs, where, updateDoc, deleteDoc, doc, and, getDoc } from "firebase/firestore";
import { db } from "../../src/Firebase/firebaseConfig";
import { getAuth } from "firebase/auth";
import { useFocusEffect } from "expo-router";

interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  completed: boolean;
  groupId: string;
  groupName?: string;
  createdBy: string;
  createdAt: any;
}

interface Group {
  id: string;
  name: string;
}

const getPriorityStyles = (priority: string) => {
  switch (priority) {
    case 'High':
      return {
        borderColor: 'border-red-400',
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-500'
      };
    case 'Medium':
      return {
        borderColor: 'border-yellow-400',
        badgeBg: 'bg-yellow-100',
        badgeText: 'text-yellow-500'
      };
    case 'Low':
      return {
        borderColor: 'border-blue-400',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-500'
      };
    default:
      return {
        borderColor: 'border-gray-400',
        badgeBg: 'bg-gray-100',
        badgeText: 'text-gray-500'
      };
  }
};

export default function Tasks() {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<'all' | 'todo' | 'inprogress' | 'completed' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAllData();
    }, [currentUser])
  );

  const fetchUserGroups = async () => {
    if (!currentUser) return new Map();
    
    try {
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('members', 'array-contains', currentUser.uid));
      const groupsSnapshot = await getDocs(q);
      
      const groupsMap = new Map<string, string>();
      groupsSnapshot.forEach((doc) => {
        groupsMap.set(doc.id, doc.data().name);
      });
      
      setGroups(groupsMap);
      return groupsMap;
    } catch (error) {
      console.error('Error fetching groups:', error);
      return new Map();
    }
  };

  const fetchAllTasks = async () => {
    try {
      setLoading(true);
      
      // First get user's groups
      const groupsMap = await fetchUserGroups();
      const userGroupIds = Array.from(groupsMap.keys());
      
      if (userGroupIds.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }
      
      // Fetch tasks from user's groups only
      const tasksRef = collection(db, 'tasks');
      const fetchedTasks: Task[] = [];
      
      for (const groupId of userGroupIds) {
        const tasksQuery = query(tasksRef, where('groupId', '==', groupId));
        const tasksSnapshot = await getDocs(tasksQuery);
        
        tasksSnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedTasks.push({
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            deadline: data.deadline || '',
            priority: data.priority || 'Medium',
            completed: data.completed || false,
            groupId: groupId,
            groupName: groupsMap.get(groupId) || 'Unknown Group',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt,
          });
        });
      }
      
      // Sort tasks by deadline (earliest first)
      fetchedTasks.sort((a, b) => {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
      
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      Alert.alert('Error', 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    await fetchAllTasks();
  };

  const toggleTaskComplete = async (taskId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        completed: !currentStatus,
      });
      fetchAllTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      fetchAllTasks();
      Alert.alert('Success', 'Task deleted');
    } catch (error) {
      console.error('Error deleting task:', error);
      Alert.alert('Error', 'Failed to delete task');
    }
  };

  const getDateCategory = (deadline: string) => {
    const taskDate = new Date(deadline);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    if (taskDate.toDateString() === today.toDateString()) return 'Today';
    if (taskDate.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    if (taskDate <= nextWeek) return 'Next Week';
    return 'Later';
  };

  const isOverdue = (deadline: string, completed: boolean) => {
    if (completed) return false;
    const taskDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return taskDate < today;
  };

  const statusCounts = {
    all: tasks.length,
    todo: tasks.filter(task => !task.completed && !isOverdue(task.deadline, task.completed)).length,
    inprogress: tasks.filter(task => !task.completed && !isOverdue(task.deadline, task.completed)).length,
    completed: tasks.filter(task => task.completed).length,
    overdue: tasks.filter(task => !task.completed && isOverdue(task.deadline, task.completed)).length,
  };

  const getFilteredTasks = () => {
    let filtered = tasks;
    
    // Apply status filter
    switch (activeStatus) {
      case 'todo':
        filtered = tasks.filter(task => !task.completed && !isOverdue(task.deadline, task.completed));
        break;
      case 'inprogress':
        filtered = tasks.filter(task => !task.completed && !isOverdue(task.deadline, task.completed));
        break;
      case 'completed':
        filtered = tasks.filter(task => task.completed);
        break;
      case 'overdue':
        filtered = tasks.filter(task => !task.completed && isOverdue(task.deadline, task.completed));
        break;
      default:
        filtered = tasks;
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(queryLower) ||
        (task.description && task.description.toLowerCase().includes(queryLower)) ||
        (task.groupName && task.groupName.toLowerCase().includes(queryLower))
      );
    }
    
    return filtered;
  };

  const filteredTasks = getFilteredTasks();
  const groupedTasks: { [key: string]: Task[] } = {};
  
  filteredTasks.forEach(task => {
    let category: string;
    if (activeStatus === 'overdue') {
      category = 'Overdue Tasks';
    } else if (task.completed) {
      category = 'Completed';
    } else {
      category = getDateCategory(task.deadline);
    }
    
    if (!groupedTasks[category]) {
      groupedTasks[category] = [];
    }
    groupedTasks[category].push(task);
  });

  // Custom order for categories
  const categoryOrder = ['Overdue Tasks', 'Today', 'Tomorrow', 'Next Week', 'Later', 'Completed'];

  const renderTaskSection = (title: string, sectionTasks: Task[]) => {
    if (sectionTasks.length === 0) return null;

    return (
      <View className="mb-6" key={title}>
        <Text className="text-sm font-medium text-gray-400 mb-3">
          {title} • {sectionTasks.length} {sectionTasks.length === 1 ? 'task' : 'tasks'}
        </Text>
        
        {sectionTasks.map((task) => {
          const priorityStyles = getPriorityStyles(task.priority);
          const isTaskOverdue = !task.completed && isOverdue(task.deadline, task.completed);
          
          return (
            <View
              key={task.id}
              className={`bg-white rounded-xl p-4 mb-3 border-l-4 ${priorityStyles.borderColor} shadow-sm ${
                isTaskOverdue ? 'bg-red-50' : ''
              }`}
            >
              <View className="flex-row items-start">
                <TouchableOpacity 
                  onPress={() => toggleTaskComplete(task.id, task.completed)}
                  className="mt-1"
                >
                  <Ionicons
                    name={task.completed ? "checkbox" : "square-outline"}
                    size={22}
                    color={task.completed ? "#22C55E" : "#9CA3AF"}
                  />
                </TouchableOpacity>
                
                <View className="ml-3 flex-1">
                  <Text className={`font-semibold text-base ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.title}
                  </Text>
                  
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                    <Text className="text-xs text-gray-500 ml-1">
                      Due: {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="folder-outline" size={12} color="#9CA3AF" />
                    <Text className="text-xs text-gray-500 ml-1">
                      Group: {task.groupName || 'Unknown'}
                    </Text>
                  </View>
                  
                  {task.description ? (
                    <Text className="text-xs text-gray-400 mt-1" numberOfLines={1}>
                      {task.description}
                    </Text>
                  ) : null}
                </View>

                <View className="flex-row items-center gap-2">
                  <View className={`${priorityStyles.badgeBg} px-3 py-1 rounded-full`}>
                    <Text className={`text-xs font-medium ${priorityStyles.badgeText}`}>
                      {task.priority}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => deleteTask(task.id),
                        },
                      ]);
                    }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#EAB308" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-5 pt-12" showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <View className="flex-row justify-between items-center mb-6">
        <View className="flex-row items-center">
          <Text className="text-xl font-bold text-amber-500">COHERA</Text>
        </View>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name="search-outline" size={22} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="notifications-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* PAGE TITLE */}
      <Text className="text-3xl font-bold text-gray-900 mb-6">
        My Tasks
      </Text>

      {/* SEARCH BAR */}
      {showSearch && (
        <View className="mb-4">
          <View className="flex-row items-center bg-white rounded-xl px-4 py-2 shadow-sm border border-gray-100">
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              className="flex-1 ml-2 text-base text-gray-800 py-2"
              placeholder="Search by title, description, or group..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.length > 0 && (
            <Text className="text-xs text-gray-400 mt-2 ml-2">
              Found {filteredTasks.length} result{filteredTasks.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}

      {/* HORIZONTAL STATUS FILTER */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="mb-6"
      >
        <View className="flex-row gap-3">
          {/* ALL STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('all')}
            className={`px-5 py-3 rounded-xl ${
              activeStatus === 'all' ? 'bg-amber-500' : 'bg-white'
            } shadow-sm`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'all' ? 'text-white' : 'text-gray-700'
            }`}>
              All ({statusCounts.all})
            </Text>
          </TouchableOpacity>

          {/* TODO STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('todo')}
            className={`px-5 py-3 rounded-xl ${
              activeStatus === 'todo' ? 'bg-blue-500' : 'bg-white'
            } shadow-sm`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'todo' ? 'text-white' : 'text-gray-700'
            }`}>
              To Do ({statusCounts.todo})
            </Text>
          </TouchableOpacity>

          {/* IN PROGRESS STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('inprogress')}
            className={`px-5 py-3 rounded-xl ${
              activeStatus === 'inprogress' ? 'bg-purple-500' : 'bg-white'
            } shadow-sm`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'inprogress' ? 'text-white' : 'text-gray-700'
            }`}>
              In Progress ({statusCounts.inprogress})
            </Text>
          </TouchableOpacity>

          {/* COMPLETED STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('completed')}
            className={`px-5 py-3 rounded-xl ${
              activeStatus === 'completed' ? 'bg-green-500' : 'bg-white'
            } shadow-sm`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'completed' ? 'text-white' : 'text-gray-700'
            }`}>
              Done ({statusCounts.completed})
            </Text>
          </TouchableOpacity>

          {/* OVERDUE STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('overdue')}
            className={`px-5 py-3 rounded-xl ${
              activeStatus === 'overdue' ? 'bg-red-500' : 'bg-white'
            } shadow-sm`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'overdue' ? 'text-white' : 'text-gray-700'
            }`}>
              Overdue ({statusCounts.overdue})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* TASKS */}
      {filteredTasks.length === 0 ? (
        <View className="bg-white rounded-2xl p-10 items-center mt-10 shadow-sm">
          <Ionicons name="checkmark-done-circle-outline" size={64} color="#D1D5DB" />
          <Text className="text-gray-400 text-center mt-4 font-medium">
            {searchQuery 
              ? `No tasks found matching "${searchQuery}"`
              : activeStatus === 'overdue' 
                ? 'No overdue tasks! Great job!' 
                : activeStatus === 'completed' 
                  ? 'No completed tasks yet' 
                  : 'No tasks found'}
          </Text>
          <Text className="text-gray-300 text-xs text-center mt-2">
            {searchQuery 
              ? 'Try a different search term'
              : activeStatus === 'overdue' 
                ? 'All your tasks are on track' 
                : 'Create a task to get started'}
          </Text>
        </View>
      ) : (
        <>
          {categoryOrder.map((category) =>
            renderTaskSection(category, groupedTasks[category] || [])
          )}
        </>
      )}
    </ScrollView>
  );
}