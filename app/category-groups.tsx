import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../src/Firebase/firebaseConfig';

type Group = {
  id: string;
  name: string;
  icon: string;
  taskCount: number;
  category: string;
  code: string;
  members: string[];
};

export default function CategoryGroups() {
  const router = useRouter();
  const { category } = useLocalSearchParams();
  const auth = getAuth();
  const user = auth.currentUser;

  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getIconForCategory = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'school':
        return 'https://cdn-icons-png.flaticon.com/512/3135/3135755.png';
      case 'work':
        return 'https://cdn-icons-png.flaticon.com/512/1995/1995574.png';
      case 'home':
        return 'https://cdn-icons-png.flaticon.com/512/201/201818.png';
      default:
        return 'https://cdn-icons-png.flaticon.com/512/3135/3135755.png';
    }
  };

  const fetchGroupsByCategory = async () => {
    if (!user || !category) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const groupsRef = collection(db, 'groups');
      const q = query(
        groupsRef,
        where('members', 'array-contains', user.uid),
        where('category', '==', category)
      );
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
      console.error('Error fetching groups by category:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroupsByCategory();
  }, [user, category]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGroupsByCategory();
  };

  const handleGroupPress = (groupId: string, groupName: string) => {
    router.push({
      pathname: '/group-details' as any,
      params: { groupId, groupName },
    });
  };

  const getCategoryIcon = (cat: string): string => {
    switch (cat?.toLowerCase()) {
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
        <ActivityIndicator size="large" color="#EAB308" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#EAB308']}
        />
      }
    >
      <View className="px-5 pt-4 pb-20">
        {/* HEADER */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-3xl font-bold text-gray-800 capitalize">
              {category} Groups
            </Text>
            <Text className="text-gray-500 text-sm mt-1">
              {groups.length} group{groups.length !== 1 ? 's' : ''} • {groups.reduce((total, g) => total + g.taskCount, 0)} total tasks
            </Text>
          </View>
          <View className="bg-yellow-100 rounded-full p-2">
            <Ionicons name={getCategoryIcon(category as string) as any} size={28} color="#EAB308" />
          </View>
        </View>

        {/* GROUPS GRID */}
        {groups.length > 0 ? (
          <View className="flex-row flex-wrap justify-between">
            {groups.map((group) => (
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
            ))}
          </View>
        ) : (
          <View className="bg-white rounded-xl p-8 items-center">
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text className="text-gray-400 text-center mt-3 capitalize">
              No {category} groups yet
            </Text>
            <Text className="text-gray-300 text-xs text-center mt-1">
              Create a new group to get started
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
