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
  dueTime: string;
  group: string;
  completed: boolean;
  dueDate?: string;
};

export default function Home() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

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
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedGroups.push({
          id: doc.id,
          name: data.name,
          icon: getIconForCategory(data.category),
          taskCount: data.tasks?.length || 0,
          category: data.category,
          code: data.code,
          members: data.members || [],
        });
      });
      
      setGroups(fetchedGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchTodayTasks = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef, 
        where('userId', '==', user.uid),
        where('dueDate', '==', today),
        orderBy('dueTime', 'asc'),
        limit(5)
      );
      
      const querySnapshot = await getDocs(q);
      const fetchedTasks: Task[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedTasks.push({
          id: doc.id,
          title: data.title,
          dueTime: data.dueTime || 'No time set',
          group: data.groupName || 'General',
          completed: data.completed || false,
        });
      });
      
      if (fetchedTasks.length > 0) {
        setTasks(fetchedTasks);
      } else {
        // Sample tasks for demo
        setTasks([
          {
            id: '1',
            title: 'Complete Proposal',
            dueTime: '2:30PM',
            group: 'School',
            completed: false,
          },
          {
            id: '2',
            title: 'Review Design',
            dueTime: '5:00PM',
            group: 'Work',
            completed: false,
          },
          {
            id: '3',
            title: 'Team Meeting',
            dueTime: '10:00AM',
            group: 'Work',
            completed: true,
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Set sample tasks for demo if no tasks exist
      setTasks([
        {
          id: '1',
          title: 'Complete Proposal',
          dueTime: '2:30PM',
          group: 'School',
          completed: false,
        },
        {
          id: '2',
          title: 'Review Design',
          dueTime: '5:00PM',
          group: 'Work',
          completed: false,
        },
        {
          id: '3',
          title: 'Team Meeting',
          dueTime: '10:00AM',
          group: 'Work',
          completed: true,
        },
      ]);
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchUserData(),
      fetchGroups(),
      fetchTodayTasks(),
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

  const toDoCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;
  const inProgressCount = 0;

  // Fixed: This should show loading when isLoading is true, not false
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
          </TouchableOpacity>
        </View>

        {/* GREETING */}
        <Text className="text-3xl font-bold text-gray-800">Hello, {userName}!</Text>
        <Text className="text-gray-500 text-base mb-6">
          You have {toDoCount + inProgressCount} tasks today.
        </Text>

        {/* TASK OVERVIEW CARD */}
        <View className="bg-yellow-400 rounded-2xl p-5 mb-6 shadow-sm">
          <View className="flex-row items-center mb-4">
            <Ionicons name="folder-outline" size={18} color="white" />
            <Text className="text-white ml-2 font-semibold text-base">Task Overview</Text>
          </View>
          <View className="flex-row justify-between">
            <View className="bg-yellow-300 rounded-xl py-4 items-center flex-1 mx-1">
              <Text className="text-2xl font-bold text-white">{toDoCount}</Text>
              <Text className="text-white text-xs font-medium">To Do</Text>
            </View>
            <View className="bg-yellow-300 rounded-xl py-4 items-center flex-1 mx-1">
              <Text className="text-2xl font-bold text-white">{inProgressCount}</Text>
              <Text className="text-white text-xs font-medium">In Progress</Text>
            </View>
            <View className="bg-yellow-300 rounded-xl py-4 items-center flex-1 mx-1">
              <Text className="text-2xl font-bold text-white">{completedCount}</Text>
              <Text className="text-white text-xs font-medium">Completed</Text>
            </View>
          </View>
        </View>

        {/* MY GROUPS SECTION */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="font-semibold text-gray-800 text-lg">My Groups</Text>
          <TouchableOpacity onPress={handleSeeAllGroups}>
            <Text className="text-yellow-500 text-sm font-medium">See All →</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row flex-wrap justify-between mb-6">
          {groups.length > 0 ? (
            groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                onPress={() => handleGroupPress(group.id, group.name)}
                className="bg-white rounded-xl border border-yellow-200 w-[48%] p-4 items-center mb-4 shadow-sm"
                activeOpacity={0.8}
              >
                <Image source={{ uri: group.icon }} className="w-12 h-12 mb-2" />
                <Text className="font-semibold text-gray-800 text-center">{group.name}</Text>
                <Text className="text-xs text-gray-400 mt-1">{group.taskCount} tasks</Text>
                {group.code && (
                  <Text className="text-xs text-gray-300 mt-1">Code: {group.code}</Text>
                )}
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
          {tasks.length > 0 && (
            <Text className="text-gray-400 text-xs">{tasks.length} tasks</Text>
          )}
        </View>

        {tasks.length > 0 ? (
          <View className="mb-6">
            {tasks.map((task) => (
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
            ))}
          </View>
        ) : (
          <View className="bg-white rounded-xl p-8 mb-6 items-center justify-center border border-gray-100">
            <Ionicons name="checkmark-done-circle-outline" size={56} color="#E5E7EB" />
            <Text className="text-gray-400 text-center mt-3 font-medium">No tasks for today</Text>
            <Text className="text-gray-300 text-xs text-center mt-1">Create a task to get started</Text>
          </View>
        )}

        {/* Quick Actions */}
        <View className="flex-row justify-between mt-2">
          <TouchableOpacity 
            onPress={() => router.push('/(tabs)/task')}
            className="flex-1 bg-white rounded-xl p-4 mr-2 items-center shadow-sm"
          >
            <Ionicons name="add-circle-outline" size={24} color="#EAB308" />
            <Text className="text-gray-600 text-sm mt-1">New Task</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/create-group' as any)}
            className="flex-1 bg-white rounded-xl p-4 ml-2 items-center shadow-sm"
          >
            <Ionicons name="people-outline" size={24} color="#EAB308" />
            <Text className="text-gray-600 text-sm mt-1">New Group</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}