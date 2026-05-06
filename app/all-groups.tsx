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
import { useAppTheme } from '../src/theme/AppThemeContext';

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
  const { colors, isDark } = useAppTheme();
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
      className="flex-1"
      style={{ backgroundColor: colors.background }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F59E0B']} />
      }
    >
      <View className="px-5 pt-10 pb-20">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold" style={{ color: colors.text }}>All Groups</Text>
        </View>

        {groups.length === 0 ? (
          <View className="rounded-xl p-12 items-center" style={{ backgroundColor: colors.surface }}>
            <Ionicons name="people-outline" size={64} color={colors.textSoft} />
            <Text className="text-center mt-4" style={{ color: colors.textSoft }}>No groups yet</Text>
            <Text className="text-center text-sm mt-2" style={{ color: colors.textMuted }}>
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
              className="rounded-xl p-4 mb-3 shadow-sm border"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              activeOpacity={0.8}
            >
              <View className="flex-row items-center">
                <Image source={{ uri: group.icon }} className="w-12 h-12 rounded-full" />
                <View className="flex-1 ml-3">
                  <Text className="font-semibold text-lg" style={{ color: colors.text }}>{group.name}</Text>
                  <View className="flex-row items-center mt-1">
                    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? colors.accentSoft : '#FFEDD5' }}>
                      <Text className="text-xs text-orange-600">{group.category}</Text>
                    </View>
                    <Text className="text-xs ml-2" style={{ color: colors.textSoft }}>{group.members.length} members</Text>
                  </View>
                  <Text className="text-xs mt-1" style={{ color: colors.textSoft }}>Code: {group.code}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSoft} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
