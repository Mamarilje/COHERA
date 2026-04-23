import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { collection, query, getDocs, where, updateDoc, deleteDoc, doc, and, getDoc } from "firebase/firestore";
import { db } from "../../src/Firebase/firebaseConfig";
import { getAuth } from "firebase/auth";
import { useFocusEffect, useRouter } from "expo-router";

interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  completed: boolean;
  status?: 'todo' | 'in progress' | 'completed';
  groupId: string;
  groupName?: string;
  createdBy: string;
  createdAt: any;
  completedBy?: string[];
  archived?: boolean;
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
  const router = useRouter();
  const currentUser = auth.currentUser;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groups, setGroups] = useState<Map<string, string>>(new Map());
  const [groupsList, setGroupsList] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<'all' | 'todo' | 'inprogress' | 'completed' | 'overdue' | 'notcomplete' | 'archive'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchUnreadNotifications = async () => {
    if (!currentUser) return;

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid),
        where('read', '==', false)
      );

      const snapshot = await getDocs(notificationsQuery);
      setUnreadNotificationsCount(snapshot.size);
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
    }
  };

  const loadAllData = async () => {
    await Promise.all([
      fetchAllTasks(),
      fetchUnreadNotifications(),
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      if (currentUser) {
        loadAllData();
      }
    }, [currentUser])
  );

  const fetchUserGroups = async () => {
    if (!currentUser) return { groupsMap: new Map(), groupsList: [] };
    
    try {
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('members', 'array-contains', currentUser.uid));
      const groupsSnapshot = await getDocs(q);
      
      const groupsMap = new Map<string, string>();
      const groupsArray: Group[] = [];
      groupsSnapshot.forEach((doc) => {
        groupsMap.set(doc.id, doc.data().name);
        groupsArray.push({ id: doc.id, name: doc.data().name });
      });
      
      setGroups(groupsMap);
      setGroupsList(groupsArray);
      return { groupsMap, groupsList: groupsArray };
    } catch (error) {
      console.error('Error fetching groups:', error);
      return { groupsMap: new Map(), groupsList: [] };
    }
  };

  const fetchAllTasks = async () => {
    try {
      setLoading(true);
      
      // First get user's groups
      const { groupsMap, groupsList } = await fetchUserGroups();
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
        
        for (const taskDoc of tasksSnapshot.docs) {
          const data = taskDoc.data();
          let taskStatus = data.status || 'todo';
          
          // Check if task is completed (either globally or by members)
          if (data.completed || (data.completedBy && data.completedBy.length > 0)) {
            taskStatus = 'completed';
          } else {
            // Check if task has any submissions with 'Progress' status
            try {
              const submissionsRef = collection(db, 'submissions');
              const submissionsQuery = query(submissionsRef, where('taskId', '==', taskDoc.id));
              const submissionsSnapshot = await getDocs(submissionsQuery);
              
              // Check if any submission has 'Progress' status
              const hasProgressSubmission = submissionsSnapshot.docs.some(
                (subDoc) => subDoc.data().status === 'Progress'
              );
              
              if (hasProgressSubmission) {
                taskStatus = 'in progress';
              }
            } catch (subError: any) {
              // Skip submission check if there are permission issues
              if (subError.code !== 'permission-denied') {
                console.error('Error checking submissions:', subError);
              }
            }
          }
          
          fetchedTasks.push({
            id: taskDoc.id,
            title: data.title || '',
            description: data.description || '',
            deadline: data.deadline || '',
            priority: data.priority || 'Medium',
            completed: data.completed || false,
            status: taskStatus,
            groupId: groupId,
            groupName: groupsMap.get(groupId) || 'Unknown Group',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt,
            completedBy: data.completedBy || [],
            archived: data.archived || false,
          });
        }
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

  const archiveTask = async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        archived: true,
      });
      fetchAllTasks();
      Alert.alert('Success', 'Task archived');
    } catch (error) {
      console.error('Error archiving task:', error);
      Alert.alert('Error', 'Failed to archive task');
    }
  };

  const getDateCategory = (deadline: string) => {
    const taskDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDateNormalized = new Date(taskDate);
    taskDateNormalized.setHours(0, 0, 0, 0);
    
    // Check if overdue first
    if (taskDateNormalized < today) return 'Overdue Tasks';
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (taskDateNormalized.getTime() === today.getTime()) return 'Today';
    if (taskDateNormalized.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return 'Upcoming';
  };

  const isOverdue = (deadline: string, completed: boolean) => {
    if (completed) return false;
    const taskDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return taskDate < today;
  };

  // Filter tasks by group first
  const groupFilteredTasks = selectedGroupFilter !== 'all' 
    ? tasks.filter(task => task.groupId === selectedGroupFilter)
    : tasks;

  const statusCounts = {
    all: groupFilteredTasks.filter(task => !task.archived).length,
    todo: groupFilteredTasks.filter(task => !task.completed && !isOverdue(task.deadline, task.completed) && !task.archived).length,
    inprogress: groupFilteredTasks.filter(task => task.status === 'in progress' && !task.archived).length,
    completed: groupFilteredTasks.filter(task => (task.completed || (task.completedBy && task.completedBy.length > 0)) && !task.archived).length,
    overdue: groupFilteredTasks.filter(task => !task.completed && isOverdue(task.deadline, task.completed) && !task.archived).length,
    notcomplete: groupFilteredTasks.filter(task => !task.completed && !task.archived).length,
    archive: groupFilteredTasks.filter(task => task.archived).length,
  };

  const getFilteredTasks = () => {
    let filtered = tasks;
    
    // Apply group filter
    if (selectedGroupFilter !== 'all') {
      filtered = filtered.filter(task => task.groupId === selectedGroupFilter);
    }
    
    // Apply status filter
    if (activeStatus !== 'all') {
      switch (activeStatus) {
        case 'todo':
          filtered = filtered.filter(task => !task.completed && !isOverdue(task.deadline, task.completed) && !task.archived);
          break;
        case 'inprogress':
          filtered = filtered.filter(task => task.status === 'in progress' && !task.completed && !task.archived);
          break;
        case 'completed':
          filtered = filtered.filter(task => (task.completed || (task.completedBy && task.completedBy.length > 0)) && !task.archived);
          break;
        case 'overdue':
          filtered = filtered.filter(task => !task.completed && isOverdue(task.deadline, task.completed) && !task.archived);
          break;
        case 'notcomplete':
          filtered = filtered.filter(task => !task.completed && !task.archived);
          break;
        case 'archive':
          filtered = filtered.filter(task => task.archived);
          break;
      }
    } else {
      // Default filter: exclude archived tasks
      filtered = filtered.filter(task => !task.archived);
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
    if (activeStatus === 'archive') {
      category = 'Archived Tasks';
    } else if (activeStatus === 'overdue') {
      category = 'Overdue Tasks';
    } else if (activeStatus === 'notcomplete') {
      // For 'Not Complete', show all incomplete tasks by deadline
      category = getDateCategory(task.deadline);
    } else if (task.completed || (task.completedBy && task.completedBy.length > 0)) {
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
  const categoryOrder = ['Overdue Tasks', 'Today', 'Tomorrow', 'Upcoming', 'Completed', 'Archived Tasks'];

  const renderTaskSection = (title: string, sectionTasks: Task[]) => {
    if (sectionTasks.length === 0) return null;

    return (
      <View className="mb-6" key={title}>
        <Text className="text-sm font-medium text-gray-400 mb-3">
          {title} • {sectionTasks.length} {sectionTasks.length === 1 ? 'task' : 'tasks'}
        </Text>
        
        {sectionTasks.map((task) => {
          const priorityStyles = getPriorityStyles(task.priority);
          const isTaskCompleted = task.completed || (task.completedBy && task.completedBy.length > 0);
          const isTaskOverdue = !isTaskCompleted && isOverdue(task.deadline, task.completed);
          
          return (
            <TouchableOpacity
              key={task.id}
              onPress={() => router.push(`/task/${task.id}`)}
              className={`bg-white rounded-xl p-4 mb-3 border-l-4 ${priorityStyles.borderColor} shadow-sm ${
                isTaskOverdue ? 'bg-red-50' : ''
              }`}
            >
              <View className="flex-row items-start">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className={`font-semibold text-base ${isTaskCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                    </Text>
                    {isTaskCompleted && (
                      <View className="bg-green-100 px-2 py-0.5 rounded">
                        <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                      </View>
                    )}
                  </View>
                  
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
                    onPress={(e) => {
                      e.stopPropagation();
                      Alert.alert('Archive Task', 'Are you sure you want to archive this task?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Archive',
                          style: 'destructive',
                          onPress: () => archiveTask(task.id),
                        },
                      ]);
                    }}
                  >
                    <Ionicons name="archive-outline" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
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
          <TouchableOpacity 
            onPress={() => router.push('/notifications' as any)}
            className="relative"
          >
            <Ionicons name="notifications-outline" size={22} color="#666" />
            {unreadNotificationsCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
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

      {/* GROUP FILTER DROPDOWN */}
      <View className="mb-6">
        <TouchableOpacity 
          onPress={() => setShowGroupFilter(true)}
          className="flex-row items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100"
        >
          <View className="flex-row items-center flex-1">
            <Ionicons name="filter" size={18} color="#6B7280" />
            <Text className="ml-2 text-gray-700 font-medium">
              {selectedGroupFilter === 'all' ? 'All Groups' : groupsList.find(g => g.id === selectedGroupFilter)?.name || 'Select Group'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

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

          {/* NOT COMPLETE STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('notcomplete')}
            className={`px-5 py-3 rounded-xl ${
              activeStatus === 'notcomplete' ? 'bg-cyan-500' : 'bg-white'
            } shadow-sm`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'notcomplete' ? 'text-white' : 'text-gray-700'
            }`}>
              Not Complete ({statusCounts.notcomplete})
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

          {/* ARCHIVE STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('archive')}
            className={`px-5 py-3 rounded-xl ${
              activeStatus === 'archive' ? 'bg-gray-600' : 'bg-white'
            } shadow-sm`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'archive' ? 'text-white' : 'text-gray-700'
            }`}>
              Archive ({statusCounts.archive})
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
              : activeStatus === 'archive'
                ? 'No archived tasks'
                : activeStatus === 'overdue' 
                ? 'No overdue tasks! Great job!' 
                : activeStatus === 'completed' 
                  ? 'No completed tasks yet' 
                  : activeStatus === 'notcomplete'
                    ? 'No incomplete tasks! You\'re all caught up!'
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

      {/* GROUP FILTER MODAL */}
      <Modal
        visible={showGroupFilter}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGroupFilter(false)}
      >
        <TouchableOpacity 
          className="flex-1 bg-black/50"
          activeOpacity={1}
          onPress={() => setShowGroupFilter(false)}
        >
          <View className="flex-1 justify-end">
            <TouchableOpacity 
              activeOpacity={1}
              className="bg-white rounded-t-3xl p-6"
            >
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold text-gray-800">Select Group</Text>
                <TouchableOpacity onPress={() => setShowGroupFilter(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={[{ id: 'all', name: 'All Groups' }, ...groupsList]}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedGroupFilter(item.id);
                      setShowGroupFilter(false);
                    }}
                    className={`p-4 border-b border-gray-100 flex-row items-center ${
                      selectedGroupFilter === item.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <Text className={`text-base flex-1 ${
                      selectedGroupFilter === item.id ? 'text-blue-600 font-semibold' : 'text-gray-700'
                    }`}>
                      {item.name}
                    </Text>
                    {selectedGroupFilter === item.id && (
                      <Ionicons name="checkmark" size={20} color="#3B82F6" />
                    )}
                  </TouchableOpacity>
                )}
                scrollEnabled={true}
                className="max-h-96"
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}