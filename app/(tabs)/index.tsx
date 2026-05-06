import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
} from 'firebase/firestore';
import { db } from '../../src/Firebase/firebaseConfig';
import { checkAndNotifyDeadlines } from '../../src/utils/deadlineChecker';
import { useAppTheme } from '../../src/theme/AppThemeContext';

type Group = {
  id: string;
  name: string;
  icon: string;
  taskCount: number;
  category: string;
  code: string;
  members: string[];
};

type Task = {
  id: string;
  title: string;
  description: string;
  dueTime: string;
  dueDate: string;
  group: string;
  groupId: string;
  completed: boolean;
  priority: string;
  status?: 'todo' | 'in progress' | 'completed';
  createdAt: any;
  completedBy?: string[];
};

type TaskStatus = NonNullable<Task['status']>;

const FIRESTORE_IN_QUERY_LIMIT = 10;
const DEADLINE_CHECK_DELAY_MS = 1500;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

export default function Home() {
  const router = useRouter();
  const auth = getAuth();
  const { colors, isDark } = useAppTheme();
  const user = auth.currentUser;
  const hasLoadedOnceRef = useRef(false);
  const isLoadingRef = useRef(false);
  const loadRequestIdRef = useRef(0);

  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [createdTodayTasks, setCreatedTodayTasks] = useState<Task[]>([]);
  const [dueTodayTasks, setDueTodayTasks] = useState<Task[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [taskStats, setTaskStats] = useState({
    todo: 0,
    inProgress: 0,
    completed: 0
  });

  const getIconForCategory = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'school':
        return 'https://cdn-icons-png.flaticon.com/512/3135/3135755.png';
      case 'work':
        return 'https://cdn-icons-png.flaticon.com/512/1995/1995574.png';
      case 'family':
        return 'https://cdn-icons-png.flaticon.com/512/201/201818.png';
      default:
        return 'https://cdn-icons-png.flaticon.com/512/3135/3135755.png';
    }
  };

  const isOverdue = (deadline: string, completed: boolean) => {
    if (completed) return false;
    const taskDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return taskDate < today;
  };

  const fetchUserData = useCallback(async () => {
    if (!user) {
      return 'User';
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.name || userData.displayName || user.email?.split('@')[0] || 'User';
      }

      return user.email?.split('@')[0] || 'User';
    } catch (error) {
      console.error('Error fetching user data:', error);
      return 'User';
    }
  }, [user]);

  const fetchGroups = useCallback(async () => {
    if (!user) {
      return [];
    }

    try {
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('members', 'array-contains', user.uid));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((groupDoc) => {
        const data = groupDoc.data();

        return {
          id: groupDoc.id,
          name: data.name,
          icon: getIconForCategory(data.category),
          taskCount: 0,
          category: data.category,
          code: data.code,
          members: data.members || [],
        };
      });
    } catch (error) {
      console.error('Error fetching groups:', error);
      return [];
    }
  }, [user]);

  const fetchTasks = useCallback(async (userGroups: Group[]) => {
    if (!user || userGroups.length === 0) {
      return [];
    }

    try {
      const tasksRef = collection(db, 'tasks');
      const groupNames = userGroups.reduce<Record<string, string>>((acc, group) => {
        acc[group.id] = group.name;
        return acc;
      }, {});
      const groupIds = userGroups.map((group) => group.id);

      const taskSnapshots = await Promise.all(
        chunkArray(groupIds, FIRESTORE_IN_QUERY_LIMIT).map((groupIdChunk) =>
          getDocs(query(tasksRef, where('groupId', 'in', groupIdChunk)))
        )
      );

      const allTasks: Task[] = taskSnapshots.flatMap((snapshot) =>
        snapshot.docs.map((taskDoc) => {
          const data = taskDoc.data();

          return {
            id: taskDoc.id,
            title: data.title || '',
            description: data.description || '',
            dueTime: data.deadline
              ? new Date(data.deadline).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
              : 'No time set',
            dueDate: data.deadline || '',
            group: groupNames[data.groupId] || 'Unknown',
            groupId: data.groupId || '',
            completed: Boolean(data.completed),
            priority: data.priority || 'Medium',
            status: (data.status || 'todo') as TaskStatus,
            createdAt: data.createdAt,
            completedBy: data.completedBy || [],
          };
        })
      );

      const incompleteTaskIds = allTasks
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

      return allTasks.map((task) => {
        const isCompleted = task.completed || (task.completedBy && task.completedBy.length > 0);

        if (isCompleted) {
          return { ...task, status: 'completed' as TaskStatus };
        }

        if (progressTaskIds.has(task.id)) {
          return { ...task, status: 'in progress' as TaskStatus };
        }

        return task;
      });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  }, [user]);

  const fetchUnreadNotifications = useCallback(async () => {
    if (!user) {
      return 0;
    }

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('read', '==', false)
      );

      const snapshot = await getDocs(notificationsQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      return 0;
    }
  }, [user]);

  const loadAllData = useCallback(async ({ showSpinner = true } = {}) => {
    if (isLoadingRef.current) {
      return;
    }

    if (!user) {
      setUserName('');
      setGroups([]);
      setCreatedTodayTasks([]);
      setDueTodayTasks([]);
      setUnreadNotificationsCount(0);
      setTaskStats({ todo: 0, inProgress: 0, completed: 0 });
      setIsLoading(false);
      setRefreshing(false);
      hasLoadedOnceRef.current = false;
      return;
    }

    isLoadingRef.current = true;
    const requestId = ++loadRequestIdRef.current;

    if (showSpinner) {
      setIsLoading(true);
    }

    try {
      const [resolvedUserName, fetchedGroups, unreadCount] = await Promise.all([
        fetchUserData(),
        fetchGroups(),
        fetchUnreadNotifications(),
      ]);
      const fetchedTasks = await fetchTasks(fetchedGroups);

      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const createdToday = fetchedTasks.filter((task) => {
        if (!task.createdAt) return false;
        const createdAt = task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
        return createdAt >= today && createdAt <= todayEnd;
      });

      const dueToday = fetchedTasks.filter((task) => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate >= today && dueDate <= todayEnd && !task.completed;
      });

      const groupTaskCounts = fetchedTasks.reduce<Record<string, number>>((acc, task) => {
        acc[task.groupId] = (acc[task.groupId] || 0) + 1;
        return acc;
      }, {});

      const todo = fetchedTasks.filter((task) => !task.completed && !isOverdue(task.dueDate, task.completed)).length;
      const completed = fetchedTasks.filter((task) => task.completed || (task.completedBy && task.completedBy.length > 0)).length;
      const inProgress = fetchedTasks.filter((task) => task.status === 'in progress').length;

      setUserName(resolvedUserName);
      setGroups(
        fetchedGroups.map((group) => ({
          ...group,
          taskCount: groupTaskCounts[group.id] || 0,
        }))
      );
      setCreatedTodayTasks(createdToday);
      setDueTodayTasks(dueToday);
      setUnreadNotificationsCount(unreadCount);
      setTaskStats({ todo, inProgress, completed });
      hasLoadedOnceRef.current = true;
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoading(false);
        setRefreshing(false);
      }
      isLoadingRef.current = false;
    }
  }, [fetchGroups, fetchTasks, fetchUnreadNotifications, fetchUserData, user]);

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    loadAllData();
  }, [loadAllData, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      if (!user || !hasLoadedOnceRef.current) {
        return;
      }

      loadAllData({ showSpinner: false });

      const timeoutId = setTimeout(() => {
        checkAndNotifyDeadlines();
      }, DEADLINE_CHECK_DELAY_MS);

      return () => clearTimeout(timeoutId);
    }, [loadAllData, user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
  };

  const handleNewGroupPress = () => {
    router.push('/create-group' as any);
  };

  const handleSeeAllGroups = () => {
    router.push('/all-groups' as any);
  };

  // Get unique categories from groups
  const getCategories = (): string[] => {
    const categories = new Set(groups.map(g => g.category || 'Other'));
    return Array.from(categories).sort();
  };

  // Get groups by category
  const getGroupsByCategory = (category: string): Group[] => {
    return groups.filter(g => (g.category || 'Other') === category);
  };

  // Get count for a category
  const getCategoryTaskCount = (category: string): number => {
    return getGroupsByCategory(category).reduce((total, group) => total + group.taskCount, 0);
  };

  // Get icon for category
  const getCategoryIcon = (category: string): string => {
    switch (category?.toLowerCase()) {
      case 'home':
        return 'home';
      case 'school':
        return 'school';
      case 'work':
        return 'briefcase';
      default:
        return 'folder';
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <Text style={{ color: colors.textMuted }}>Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1"
      style={{ backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EAB308']} />
      }
    >
      <View className="px-5 pt-10 pb-20">
        {/* HEADER */}
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-2xl font-bold text-yellow-500">COHERA</Text>
          <TouchableOpacity 
            onPress={() => router.push('/notifications' as any)}
            className="relative"
          >
            <Ionicons name="notifications-outline" size={24} color={colors.icon} />
            {unreadNotificationsCount > 0 && (
              <View className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* GREETING */}
        <Text className="text-3xl font-bold" style={{ color: colors.text }}>Hello, {userName}!</Text>
        <Text className="text-base mb-6" style={{ color: colors.textMuted }}>
          You have {taskStats.todo} tasks to complete.
        </Text>

        {/* TASK OVERVIEW CARD */}
        <TouchableOpacity 
          onPress={() => router.push('/(tabs)/task' as any)}
          className="bg-yellow-500 rounded-2xl p-5 mb-6 shadow-sm"
          activeOpacity={0.9}
        >
          <View className="flex-row items-center mb-4">
            <Ionicons name="folder-outline" size={18} color="black" />
            <Text className="black-white ml-2 font-semibold text-black">Task Overview</Text>
          </View>
          <View className="flex-row justify-between">
            <View className="bg-yellow-50 rounded-xl py-4 items-center flex-1 mx-1">
              <Text className="text-2xl font-bold text-black">{taskStats.todo}</Text>
              <Text className="text-black text-xs font-medium">To Do</Text>
            </View>
            <View className="bg-yellow-50 rounded-xl py-4 items-center flex-1 mx-1">
              <Text className="text-2xl font-bold text-blue">{taskStats.inProgress}</Text>
              <Text className="text-black text-xs font-medium">In Progress</Text>
            </View>
            <View className="bg-yellow-50 rounded-xl py-4 items-center flex-1 mx-1">
              <Text className="text-2xl font-bold text-black">{taskStats.completed}</Text>
              <Text className="text-black text-xs font-medium">Completed</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* MY GROUPS BY CATEGORY SECTION */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="font-semibold text-lg" style={{ color: colors.text }}>My Groups</Text>
          <TouchableOpacity onPress={handleSeeAllGroups}>
            <Text className="text-yellow-500 text-sm font-medium">See All →</Text>
          </TouchableOpacity>
        </View>

        {/* Category Box Grid */}
        <View className="flex-row flex-wrap justify-between mb-6">
          {getCategories().length > 0 ? (
            getCategories().map((category) => (
              <TouchableOpacity
                key={category}
                onPress={() => {
                  router.push({
                    pathname: '/category-groups' as any,
                    params: { category }
                  });
                }}
                className="rounded-xl border w-[48%] p-4 items-center mb-4 shadow-sm"
                style={{ backgroundColor: colors.surface, borderColor: isDark ? colors.border : '#FDE68A' }}
                activeOpacity={0.8}
              >
                <View className="rounded-full p-3 mb-2" style={{ backgroundColor: isDark ? colors.accentSoft : '#FEF3C7' }}>
                  <Ionicons name={getCategoryIcon(category) as any} size={32} color="#EAB308" />
                </View>
                <Text className="font-semibold text-center capitalize" style={{ color: colors.text }}>{category}</Text>
                <Text className="text-xs mt-1" style={{ color: colors.textSoft }}>
                  {getGroupsByCategory(category).length} group{getGroupsByCategory(category).length !== 1 ? 's' : ''}
                </Text>
                <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>{getCategoryTaskCount(category)} tasks</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View className="w-full rounded-xl p-8 items-center mb-4" style={{ backgroundColor: colors.surface }}>
              <Ionicons name="people-outline" size={48} color={colors.textSoft} />
              <Text className="text-center mt-3" style={{ color: colors.textSoft }}>No groups yet</Text>
              <Text className="text-xs text-center mt-1" style={{ color: colors.textMuted }}>
                Create a group to get started
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleNewGroupPress}
            className="border-2 border-dashed rounded-xl w-[48%] p-4 items-center justify-center mb-4"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={32} color={colors.textSoft} />
            <Text className="text-sm mt-1" style={{ color: colors.textSoft }}>New Group</Text>
          </TouchableOpacity>
        </View>

        {/* TODAY'S TASKS */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="font-semibold text-lg" style={{ color: colors.text }}>{"Today's Tasks"}</Text>
        </View>

        {/* Created Today Section */}
        <View className="mb-4">
          <Text className="text-sm font-semibold mb-2" style={{ color: colors.textMuted }}>Created Today</Text>
          {createdTodayTasks.length > 0 ? (
            createdTodayTasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                className="rounded-xl p-4 mb-3 shadow-sm border"
                style={{ backgroundColor: colors.surface, borderColor: isDark ? '#FFFFFF' : colors.border }}
                activeOpacity={0.7}
                onPress={() => {
                  router.push({
                    pathname: '/task-details' as any,
                    params: { taskId: task.id }
                  });
                }}
              >
                <View className="flex-row items-start">
                  <View className="mr-3 mt-1">
                    {task.completed ? (
                      <Ionicons name="checkmark-circle" size={22} color="#f5e50b" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={22} color="#9CA3AF" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-base font-medium ${task.completed ? 'line-through' : ''}`}
                      style={{ color: task.completed ? colors.textSoft : colors.text }}
                    >
                      {task.title}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Text className="text-xs mr-3" style={{ color: colors.textSoft }}>
                        Due: {task.dueTime}
                      </Text>
                      <View className="flex-row items-center">
                        <View className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-1" />
                        <Text className="text-xs text-yellow-500 font-medium">
                          {task.group}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {task.completed && (
                    <Ionicons name="checkmark-done" size={18} color="#10B981" />
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View className="rounded-xl p-4 mb-3 items-center" style={{ backgroundColor: colors.surfaceMuted }}>
              <Text className="text-sm" style={{ color: colors.textSoft }}>No tasks created today</Text>
            </View>
          )}
        </View>

        {/* Due Today Section */}
        <View className="mb-6">
          <Text className="text-sm font-semibold mb-2" style={{ color: colors.textMuted }}>Due Today</Text>
          {dueTodayTasks.length > 0 ? (
            dueTodayTasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                className="rounded-xl p-4 mb-3 shadow-sm border"
                style={{ backgroundColor: colors.surface, borderColor: isDark ? '#FFFFFF' : '#FEE2E2' }}
                activeOpacity={0.7}
                onPress={() => {
                  router.push({
                    pathname: '/task-details' as any,
                    params: { taskId: task.id }
                  });
                }}
              >
                <View className="flex-row items-start">
                  <View className="mr-3 mt-1">
                    {task.completed ? (
                      <Ionicons name="checkmark-circle" size={22} color="#f5e50b" />
                    ) : (
                      <Ionicons name="ellipse-outline" size={22} color="#EF4444" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-base font-medium ${task.completed ? 'line-through' : ''}`}
                      style={{ color: task.completed ? colors.textSoft : colors.text }}
                    >
                      {task.title}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Text className="text-xs text-red-500 mr-3 font-medium">
                        Due: {task.dueTime}
                      </Text>
                      <View className="flex-row items-center">
                        <View className="w-1.5 h-1.5 bg-yellow-400 rounded-full mr-1" />
                        <Text className="text-xs text-yellow-500 font-medium">
                          {task.group}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {task.completed && (
                    <Ionicons name="checkmark-done" size={18} color="#10B981" />
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View className="rounded-xl p-4 mb-3 items-center" style={{ backgroundColor: colors.surfaceMuted }}>
              <Text className="text-sm" style={{ color: colors.textSoft }}>No tasks due today</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
