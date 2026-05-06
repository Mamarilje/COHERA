import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useRef } from "react";
import { collection, query, getDocs, where, updateDoc, doc } from "firebase/firestore";
import { db } from "../../src/Firebase/firebaseConfig";
import { getAuth } from "firebase/auth";
import { useFocusEffect, useRouter } from "expo-router";
import { useAppTheme } from "../../src/theme/AppThemeContext";

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

type TaskStatus = NonNullable<Task['status']>;

const FIRESTORE_IN_QUERY_LIMIT = 10;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const isTaskCompleted = (task: Task) =>
  task.completed || Boolean(task.completedBy && task.completedBy.length > 0);

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
  const { colors, isDark } = useAppTheme();
  const currentUser = auth.currentUser;
  const hasLoadedOnceRef = useRef(false);
  const isLoadingRef = useRef(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groupsList, setGroupsList] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<'all' | 'todo' | 'inprogress' | 'completed' | 'overdue' | 'notcomplete' | 'archive'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchUnreadNotifications = useCallback(async () => {
    if (!currentUser) return 0;

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid),
        where('read', '==', false)
      );

      const snapshot = await getDocs(notificationsQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      return 0;
    }
  }, [currentUser]);

  const fetchUserGroups = useCallback(async () => {
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
      
      setGroupsList(groupsArray);
      return { groupsMap, groupsList: groupsArray };
    } catch (error) {
      console.error('Error fetching groups:', error);
      return { groupsMap: new Map(), groupsList: [] };
    }
  }, [currentUser]);

  const fetchAllTasks = useCallback(async ({ showSpinner = true } = {}) => {
    if (!currentUser) {
      setTasks([]);
      setGroupsList([]);
      setLoading(false);
      hasLoadedOnceRef.current = false;
      return;
    }

    if (isLoadingRef.current) {
      return;
    }

    try {
      isLoadingRef.current = true;
      if (showSpinner) {
        setLoading(true);
      }
      
      const { groupsMap } = await fetchUserGroups();
      const userGroupIds = Array.from(groupsMap.keys());
      
      if (userGroupIds.length === 0) {
        setTasks([]);
        hasLoadedOnceRef.current = true;
        return;
      }
      
      const tasksRef = collection(db, 'tasks');
      const taskSnapshots = await Promise.all(
        chunkArray(userGroupIds, FIRESTORE_IN_QUERY_LIMIT).map((groupIdChunk) =>
          getDocs(query(tasksRef, where('groupId', 'in', groupIdChunk)))
        )
      );

      const fetchedTasks: Task[] = taskSnapshots.flatMap((tasksSnapshot) =>
        tasksSnapshot.docs.map((taskDoc) => {
          const data = taskDoc.data();

          return {
            id: taskDoc.id,
            title: data.title || '',
            description: data.description || '',
            deadline: data.deadline || '',
            priority: data.priority || 'Medium',
            completed: Boolean(data.completed),
            status: (data.status || 'todo') as TaskStatus,
            groupId: data.groupId || '',
            groupName: groupsMap.get(data.groupId || '') || 'Unknown Group',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt,
            completedBy: data.completedBy || [],
            archived: data.archived || false,
          };
        })
      );

      const incompleteTaskIds = fetchedTasks
        .filter((task) => !task.completed && !(task.completedBy && task.completedBy.length > 0))
        .map((task) => task.id);

      const progressTaskIds = new Set<string>();

      if (incompleteTaskIds.length > 0) {
        try {
          const submissionsRef = collection(db, 'submissions');
          const submissionSnapshots = await Promise.all(
            chunkArray(incompleteTaskIds, FIRESTORE_IN_QUERY_LIMIT).map((taskIdChunk) =>
              getDocs(query(submissionsRef, where('taskId', 'in', taskIdChunk)))
            )
          );

          submissionSnapshots.forEach((snapshot) => {
            snapshot.docs.forEach((submissionDoc) => {
              const submission = submissionDoc.data();

              if (submission.status === 'Progress' && submission.taskId) {
                progressTaskIds.add(submission.taskId);
              }
            });
          });
        } catch (subError: any) {
          if (subError.code !== 'permission-denied') {
            console.error('Error checking submissions:', subError);
          }
        }
      }

      const normalizedTasks = fetchedTasks.map((task) => {
        if (task.completed || (task.completedBy && task.completedBy.length > 0)) {
          return { ...task, status: 'completed' as TaskStatus };
        }

        if (progressTaskIds.has(task.id)) {
          return { ...task, status: 'in progress' as TaskStatus };
        }

        return task;
      });
      
      normalizedTasks.sort((a, b) => {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
      
      setTasks(normalizedTasks);
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.error('Error fetching tasks:', error);
      Alert.alert('Error', 'Failed to load tasks');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [currentUser, fetchUserGroups]);

  const loadAllData = useCallback(async ({ showSpinner = true } = {}) => {
    if (!currentUser) {
      return;
    }

    const unreadCount = await fetchUnreadNotifications();
    setUnreadNotificationsCount(unreadCount);
    await fetchAllTasks({ showSpinner });
  }, [currentUser, fetchAllTasks, fetchUnreadNotifications]);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) {
        return;
      }

      loadAllData({ showSpinner: !hasLoadedOnceRef.current });
    }, [currentUser, loadAllData])
  );

  const archiveTask = async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        archived: true,
      });
      loadAllData({ showSpinner: false });
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

  const isTaskOverdue = (task: Task) => isOverdue(task.deadline, isTaskCompleted(task));

  // Filter tasks by group first
  const groupFilteredTasks = selectedGroupFilter !== 'all' 
    ? tasks.filter(task => task.groupId === selectedGroupFilter)
    : tasks;

  const statusCounts = {
    all: groupFilteredTasks.filter(task => !task.archived).length,
    todo: groupFilteredTasks.filter(task => !isTaskCompleted(task) && task.status !== 'in progress' && !isTaskOverdue(task) && !task.archived).length,
    inprogress: groupFilteredTasks.filter(task => task.status === 'in progress' && !isTaskCompleted(task) && !task.archived).length,
    completed: groupFilteredTasks.filter(task => isTaskCompleted(task) && !task.archived).length,
    overdue: groupFilteredTasks.filter(task => !isTaskCompleted(task) && isTaskOverdue(task) && !task.archived).length,
    notcomplete: groupFilteredTasks.filter(task => !isTaskCompleted(task) && !task.archived).length,
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
          filtered = filtered.filter(task => !isTaskCompleted(task) && task.status !== 'in progress' && !isTaskOverdue(task) && !task.archived);
          break;
        case 'inprogress':
          filtered = filtered.filter(task => task.status === 'in progress' && !isTaskCompleted(task) && !task.archived);
          break;
        case 'completed':
          filtered = filtered.filter(task => isTaskCompleted(task) && !task.archived);
          break;
        case 'overdue':
          filtered = filtered.filter(task => !isTaskCompleted(task) && isTaskOverdue(task) && !task.archived);
          break;
        case 'notcomplete':
          filtered = filtered.filter(task => !isTaskCompleted(task) && !task.archived);
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
    } else if (isTaskCompleted(task)) {
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
        <Text className="text-sm font-medium mb-3" style={{ color: colors.textSoft }}>
          {title} • {sectionTasks.length} {sectionTasks.length === 1 ? 'task' : 'tasks'}
        </Text>
        
        {sectionTasks.map((task) => {
          const priorityStyles = getPriorityStyles(task.priority);
          const taskIsCompleted = isTaskCompleted(task);
          const taskIsOverdue = !taskIsCompleted && isTaskOverdue(task);
          
          return (
            <TouchableOpacity
              key={task.id}
              onPress={() => router.push(`/task/${task.id}`)}
              className={`rounded-xl p-4 mb-3 border-l-4 ${priorityStyles.borderColor} shadow-sm`}
              style={{ backgroundColor: taskIsOverdue && !isDark ? '#FEF2F2' : colors.surface }}
            >
              <View className="flex-row items-start">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text
                      className={`font-semibold text-base ${taskIsCompleted ? 'line-through' : ''}`}
                      style={{ color: taskIsCompleted ? colors.textSoft : colors.text }}
                    >
                      {task.title}
                    </Text>
                    {taskIsCompleted && (
                      <View className="bg-green-100 px-2 py-0.5 rounded">
                        <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                      </View>
                    )}
                  </View>
                  
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="calendar-outline" size={12} color={colors.textSoft} />
                    <Text className="text-xs ml-1" style={{ color: colors.textMuted }}>
                      Due: {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="folder-outline" size={12} color={colors.textSoft} />
                    <Text className="text-xs ml-1" style={{ color: colors.textMuted }}>
                      Group: {task.groupName || 'Unknown'}
                    </Text>
                  </View>
                  
                  {task.description ? (
                    <Text className="text-xs mt-1" style={{ color: colors.textSoft }} numberOfLines={1}>
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
                    <Ionicons name="archive-outline" size={20} color={colors.textSoft} />
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
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#EAB308" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 px-5 pt-12" style={{ backgroundColor: colors.background }} showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <View className="flex-row justify-between items-center mb-6">
        <View className="flex-row items-center">
          <Text className="text-xl font-bold text-amber-500">COHERA</Text>
        </View>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name="search-outline" size={22} color={colors.icon} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/notifications' as any)}
            className="relative"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.icon} />
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
      <Text className="text-3xl font-bold mb-6" style={{ color: colors.text }}>
        My Tasks
      </Text>

      {/* SEARCH BAR */}
      {showSearch && (
        <View className="mb-4">
          <View className="flex-row items-center rounded-xl px-4 py-2 shadow-sm border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <Ionicons name="search-outline" size={20} color={colors.textSoft} />
            <TextInput
              className="flex-1 ml-2 text-base py-2"
              style={{ color: colors.text }}
              placeholder="Search by title, description, or group..."
              placeholderTextColor={colors.textSoft}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textSoft} />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.length > 0 && (
            <Text className="text-xs mt-2 ml-2" style={{ color: colors.textSoft }}>
              Found {filteredTasks.length} result{filteredTasks.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}

      {/* GROUP FILTER DROPDOWN */}
      <View className="mb-6">
        <TouchableOpacity 
          onPress={() => setShowGroupFilter(true)}
          className="flex-row items-center justify-between rounded-xl px-4 py-3 shadow-sm border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <View className="flex-row items-center flex-1">
            <Ionicons name="filter" size={18} color={colors.icon} />
            <Text className="ml-2 font-medium" style={{ color: colors.text }}>
              {selectedGroupFilter === 'all' ? 'All Groups' : groupsList.find(g => g.id === selectedGroupFilter)?.name || 'Select Group'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={colors.textSoft} />
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
