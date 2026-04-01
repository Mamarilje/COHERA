import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

export default function AllGroups() {
  const router = useRouter();
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
      case 'family':
        return 'https://cdn-icons-png.flaticon.com/512/201/201818.png';
      default:
        return 'https://cdn-icons-png.flaticon.com/512/3135/3135755.png';
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
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  const handleGroupPress = (groupId: string, groupName: string) => {
    router.push({
      pathname: '/group-details' as any,
      params: { groupId, groupName }
    });
  };

  return (
    <ScrollView 
      className="flex-1 bg-gray-100"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F59E0B']} />
      }
    >
      <View className="px-5 pt-10 pb-20">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-800">All Groups</Text>
        </View>

        {groups.length === 0 ? (
          <View className="bg-white rounded-xl p-12 items-center">
            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-400 text-center mt-4">No groups yet</Text>
            <Text className="text-gray-300 text-center text-sm mt-2">
              Create a group to get started
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/create-group' as any)}
              className="mt-6 bg-orange-500 px-6 py-3 rounded-xl"
            >
              <Text className="text-white font-semibold">Create Group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              onPress={() => handleGroupPress(group.id, group.name)}
              className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
              activeOpacity={0.8}
            >
              <View className="flex-row items-center">
                <Image source={{ uri: group.icon }} className="w-12 h-12 rounded-full" />
                <View className="flex-1 ml-3">
                  <Text className="font-semibold text-gray-800 text-lg">{group.name}</Text>
                  <View className="flex-row items-center mt-1">
                    <View className="bg-orange-100 px-2 py-0.5 rounded-full">
                      <Text className="text-xs text-orange-600">{group.category}</Text>
                    </View>
                    <Text className="text-xs text-gray-400 ml-2">{group.members.length} members</Text>
                  </View>
                  <Text className="text-xs text-gray-400 mt-1">Code: {group.code}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}