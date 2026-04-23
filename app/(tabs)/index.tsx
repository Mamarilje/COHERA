import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
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
  orderBy,
  limit 
} from 'firebase/firestore';
import { db } from '../../src/Firebase/firebaseConfig';
import { checkAndNotifyDeadlines } from '../../src/utils/deadlineChecker';

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
};

export default function Home() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

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

  const fetchUserData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserName(userData.name || userData.displayName || user.email?.split('@')[0] || 'User');
      } else {
        setUserName(user.email?.split('@')[0] || 'User');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserName('User');
    }
  };

  const fetchGroups = async () => {
    if (!user) return;

    try {
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('members', 'array-contains', user.uid));
      const querySnapshot = await getDocs(q);
      
      const fetchedGroups: Group[] = [];
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        
        // Count tasks for this group
        const tasksRef = collection(db, 'tasks');
        const tasksQuery = query(tasksRef, where('groupId', '==', doc.id));
        const tasksSnapshot = await getDocs(tasksQuery);
        
        fetchedGroups.push({
          id: doc.id,
          name: data.name,
          icon: getIconForCategory(data.category),
          taskCount: tasksSnapshot.size,
          category: data.category,
          code: data.code,
          members: data.members || [],
        });
      }
      
      setGroups(fetchedGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchTasks = async () => {
    if (!user) return;

    try {
      // First, get all groups the user is a member of
      const groupsRef = collection(db, 'groups');
      const groupsQuery = query(groupsRef, where('members', 'array-contains', user.uid));
      const groupsSnapshot = await getDocs(groupsQuery);
      
      const userGroupIds: string[] = [];
      const groupNames: { [key: string]: string } = {};
      
      groupsSnapshot.forEach((doc) => {
        userGroupIds.push(doc.id);
        groupNames[doc.id] = doc.data().name;
      });
      
      if (userGroupIds.length === 0) {
        setCreatedTodayTasks([]);
        setDueTodayTasks([]);
        setTaskStats({ todo: 0, inProgress: 0, completed: 0 });
        return;
      }
      
      // Fetch all tasks from user's groups
      const tasksRef = collection(db, 'tasks');
      const allTasks: Task[] = [];
      
      for (const groupId of userGroupIds) {
        const tasksQuery = query(tasksRef, where('groupId', '==', groupId));
        const tasksSnapshot = await getDocs(tasksQuery);
        
        for (const doc of tasksSnapshot.docs) {
          const data = doc.data();
          let taskStatus = data.status || 'todo';
          
          // Check if task has any submissions with 'Progress' status
          try {
            const submissionsRef = collection(db, 'submissions');
            const submissionsQuery = query(submissionsRef, where('taskId', '==', doc.id));
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
          
          allTasks.push({
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            dueTime: data.deadline ? new Date(data.deadline).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'No time set',
            dueDate: data.deadline || '',
            group: groupNames[groupId] || 'Unknown',
            groupId: groupId,
            completed: data.completed || false,
            priority: data.priority || 'Medium',
            status: taskStatus,
            createdAt: data.createdAt,
          });
        }
      }
      
      // Get today's date range (start to end of day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.toISOString();
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      const todayEndStr = todayEnd.toISOString();
      
      // Filter tasks created today
      const createdToday = allTasks.filter(task => {
        if (!task.createdAt) return false;
        const createdAt = task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
        return createdAt >= today && createdAt <= todayEnd;
      });
      
      // Filter tasks due today
      const dueToday = allTasks.filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate >= today && dueDate <= todayEnd && !task.completed;
      });
      
      setCreatedTodayTasks(createdToday);
      setDueTodayTasks(dueToday);
      
      // Calculate task statistics - match task.tsx logic
      const todo = allTasks.filter(task => !task.completed && !isOverdue(task.dueDate, task.completed)).length;
      const completed = allTasks.filter(task => task.completed).length;
      const inProgress = allTasks.filter(task => task.status === 'in progress').length;
      
      setTaskStats({ todo, inProgress, completed });
      
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchUnreadNotifications = async () => {
    if (!user) return;

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('read', '==', false)
      );

      const snapshot = await getDocs(notificationsQuery);
      setUnreadNotificationsCount(snapshot.size);
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchUserData(),
      fetchGroups(),
      fetchTasks(),
      fetchUnreadNotifications(),
    ]);
    setIsLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAllData();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadAllData();
        // Check for deadline notifications whenever the home screen is focused
        checkAndNotifyDeadlines();
      }
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
  };

  const handleGroupPress = (groupId: string, groupName: string) => {
    router.push({
      pathname: '/group-details' as any,
      params: { groupId, groupName }
    });
  };

  const handleNewGroupPress = () => {
    router.push('/create-group' as any);
  };

  const handleSeeAllGroups = () => {
    router.push('/all-groups' as any);
  };

  const toggleTaskComplete = async (taskId: string, currentStatus: boolean) => {
    // This would update the task completion status in Firestore
    // For now, we'll just refresh the data
    await fetchTasks();
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
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Loading your dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-white" 
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
            <Ionicons name="notifications-outline" size={24} color="#666" />
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
        <Text className="text-3xl font-bold text-gray-800">Hello, {userName}!</Text>
        <Text className="text-gray-500 text-base mb-6">
          You have {taskStats.todo} tasks to complete.
        </Text>

        {/* TASK OVERVIEW CARD */}
        <TouchableOpacity 
          onPress={() => router.push('/(tabs)/task' as any)}
          className="bg-yellow-400 rounded-2xl p-5 mb-6 shadow-sm"
          activeOpacity={0.9}
        >
          <View className="flex-row items-center mb-4">
            <Ionicons name="folder-outline" size={18} color="white" />
            <Text className="text-white ml-2 font-semibold text-base">Task Overview</Text>
          </View>
          <View className="flex-row justify-between">
            <View className="bg-yellow-300 rounded-xl py-4 items-center flex-1 mx-1">
              <Text className="text-2xl font-bold text-white">{taskStats.todo}</Text>
              <Text className="text-white text-xs font-medium">To Do</Text>
            </View>
            <View className="bg-yellow-300 rounded-xl py-4 items-center flex-1 mx-1">
              <Text className="text-2xl font-bold text-white">{taskStats.inProgress}</Text>
              <Text className="text-white text-xs font-medium">In Progress</Text>
            </View>
            <View className="bg-yellow-300 rounded-xl py-4 items-center flex-1 mx-1">
              <Text className="text-2xl font-bold text-white">{taskStats.completed}</Text>
              <Text className="text-white text-xs font-medium">Completed</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* MY GROUPS BY CATEGORY SECTION */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="font-semibold text-gray-800 text-lg">My Groups</Text>
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
                className="bg-white rounded-xl border border-yellow-200 w-[48%] p-4 items-center mb-4 shadow-sm"
                activeOpacity={0.8}
              >
                <View className="bg-yellow-100 rounded-full p-3 mb-2">
                  <Ionicons name={getCategoryIcon(category) as any} size={32} color="#EAB308" />
                </View>
                <Text className="font-semibold text-gray-800 text-center capitalize">{category}</Text>
                <Text className="text-xs text-gray-400 mt-1">
                  {getGroupsByCategory(category).length} group{getGroupsByCategory(category).length !== 1 ? 's' : ''}
                </Text>
                <Text className="text-xs text-gray-300 mt-1">{getCategoryTaskCount(category)} tasks</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View className="w-full bg-white rounded-xl p-8 items-center mb-4">
              <Ionicons name="people-outline" size={48} color="#D1D5DB" />
              <Text className="text-gray-400 text-center mt-3">No groups yet</Text>
              <Text className="text-gray-300 text-xs text-center mt-1">
                Create a group to get started
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleNewGroupPress}
            className="bg-white border-2 border-dashed border-gray-300 rounded-xl w-[48%] p-4 items-center justify-center mb-4"
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={32} color="#9CA3AF" />
            <Text className="text-gray-400 text-sm mt-1">New Group</Text>
          </TouchableOpacity>
        </View>

        {/* TODAY'S TASKS */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="font-semibold text-gray-800 text-lg">Today's Tasks</Text>
        </View>

        {/* Created Today Section */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-2">Created Today</Text>
          {createdTodayTasks.length > 0 ? (
            createdTodayTasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
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
                      className={`text-base font-medium ${
                        task.completed ? 'text-gray-400 line-through' : 'text-gray-800'
                      }`}
                    >
                      {task.title}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Text className="text-xs text-gray-400 mr-3">
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
            <View className="bg-gray-50 rounded-xl p-4 mb-3 items-center">
              <Text className="text-gray-400 text-sm">No tasks created today</Text>
            </View>
          )}
        </View>

        {/* Due Today Section */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-2">Due Today</Text>
          {dueTodayTasks.length > 0 ? (
            dueTodayTasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-red-100"
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
                      className={`text-base font-medium ${
                        task.completed ? 'text-gray-400 line-through' : 'text-gray-800'
                      }`}
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
            <View className="bg-gray-50 rounded-xl p-4 mb-3 items-center">
              <Text className="text-gray-400 text-sm">No tasks due today</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}