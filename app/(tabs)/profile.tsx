import { View, Text, Image, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router"; // or useNavigation if using React Navigation

export default function Profile() {
  const router = useRouter();
  const [userName, setUserName] = useState("Mark Oprecio");
  const [userTitle, setUserTitle] = useState("Project Manager");
  const [profileImage, setProfileImage] = useState("https://i.pravatar.cc/150?img=7");

  return (
    <View className="flex-1 bg-[#F5F7FA]">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Profile Header Section with Settings Button */}
        <View className="bg-white px-5 pt-12 pb-6 rounded-b-3xl shadow-sm relative">
          {/* Settings Button in Top Right */}
          <TouchableOpacity 
            onPress={() => router.push("/settings")}
            className="absolute top-12 right-5 z-10"
          >
            <Ionicons name="settings-outline" size={24} color="#4B7BEC" />
          </TouchableOpacity>
          
          <View className="items-center">
            <Image
              source={{ uri: profileImage }}
              className="w-24 h-24 rounded-full mb-3 border-4 border-white shadow-sm"
            />
            <Text className="text-2xl font-bold text-gray-800">
              {userName}
            </Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              {userTitle}
            </Text>
          </View>
        </View>

        {/* Activity Stats - Below Header */}
        <View className="px-5 mt-5">
          <View className="bg-white rounded-2xl p-5 shadow-lg border border-gray-50">
            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">
              Activity Stats
            </Text>
            
            <View className="flex-row justify-between">
              <View className="items-center">
                <Text className="text-xl font-extrabold text-gray-800">23</Text>
                <Text className="text-gray-400 text-xs mt-0.5">Tasks</Text>
              </View>
              
              <View className="items-center">
                <Text className="text-xl font-extrabold text-gray-800">15</Text>
                <Text className="text-gray-400 text-xs mt-0.5">Groups</Text>
              </View>
              
              <View className="items-center">
                <Text className="text-xl font-extrabold text-gray-800">156</Text>
                <Text className="text-gray-400 text-xs mt-0.5">Points</Text>
              </View>
              
              <View className="items-center">
                <Text className="text-xl font-extrabold text-gray-800">89%</Text>
                <Text className="text-gray-400 text-xs mt-0.5">Complete</Text>
              </View>
            </View>
          </View>
        </View>

        {/* My Groups Section */}
        <View className="px-5 mt-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-gray-800">My Groups</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-gray-400">View all</Text>
              <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
            </View>
          </View>
          
          <View className="gap-3">
            <View className="bg-white rounded-xl p-3 flex-row items-center shadow-sm border border-gray-100">
              <View className="w-12 h-12 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                <Ionicons name="color-palette" size={22} color="#6366F1" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-800">Design Team</Text>
                <Text className="text-gray-400 text-xs mt-0.5">12 members · 4 active tasks</Text>
              </View>
              <Ionicons name="ellipsis-horizontal" size={16} color="#D1D5DB" />
            </View>

            <View className="bg-white rounded-xl p-3 flex-row items-center shadow-sm border border-gray-100">
              <View className="w-12 h-12 rounded-xl bg-emerald-50 items-center justify-center mr-3">
                <Ionicons name="code-slash" size={22} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-800">Dev Guild</Text>
                <Text className="text-gray-400 text-xs mt-0.5">8 members · 6 tasks completed</Text>
              </View>
              <Ionicons name="ellipsis-horizontal" size={16} color="#D1D5DB" />
            </View>

            <View className="bg-white rounded-xl p-3 flex-row items-center shadow-sm border border-gray-100">
              <View className="w-12 h-12 rounded-xl bg-amber-50 items-center justify-center mr-3">
                <Ionicons name="trending-up" size={22} color="#F59E0B" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-800">Product Circle</Text>
                <Text className="text-gray-400 text-xs mt-0.5">5 members · 89% progress</Text>
              </View>
              <Ionicons name="ellipsis-horizontal" size={16} color="#D1D5DB" />
            </View>
          </View>
        </View>

        {/* My Statistics Section */}
        <View className="px-5 mt-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-gray-800">My Statistics</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-gray-400">Details</Text>
              <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
            </View>
          </View>
          
          <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-xs font-medium text-gray-400">
                Weekly activity (tasks completed)
              </Text>
              <View className="bg-green-50 px-2 py-0.5 rounded-full">
                <Text className="text-green-600 text-xs font-medium">+12%</Text>
              </View>
            </View>
            
            <View className="h-32 flex-row items-end justify-around">
              <View className="items-center w-7">
                <View className="w-5 bg-indigo-500 rounded-t-md" style={{ height: 32 }} />
                <Text className="text-gray-400 text-[10px] mt-1">M</Text>
              </View>
              <View className="items-center w-7">
                <View className="w-5 bg-indigo-500 rounded-t-md" style={{ height: 52 }} />
                <Text className="text-gray-400 text-[10px] mt-1">T</Text>
              </View>
              <View className="items-center w-7">
                <View className="w-5 bg-indigo-500 rounded-t-md" style={{ height: 64 }} />
                <Text className="text-gray-400 text-[10px] mt-1">W</Text>
              </View>
              <View className="items-center w-7">
                <View className="w-5 bg-indigo-500 rounded-t-md" style={{ height: 36 }} />
                <Text className="text-gray-400 text-[10px] mt-1">T</Text>
              </View>
              <View className="items-center w-7">
                <View className="w-5 bg-indigo-500 rounded-t-md" style={{ height: 56 }} />
                <Text className="text-gray-400 text-[10px] mt-1">F</Text>
              </View>
              <View className="items-center w-7">
                <View className="w-5 bg-indigo-500 rounded-t-md" style={{ height: 44 }} />
                <Text className="text-gray-400 text-[10px] mt-1">S</Text>
              </View>
              <View className="items-center w-7">
                <View className="w-5 bg-indigo-500 rounded-t-md" style={{ height: 68 }} />
                <Text className="text-gray-400 text-[10px] mt-1">S</Text>
              </View>
            </View>
            
            <View className="flex-row justify-between items-center mt-4 pt-2 border-t border-gray-100">
              <View className="flex-row items-center gap-1">
                <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                <Text className="text-xs text-gray-500">Last 7 days</Text>
              </View>
              <View className="bg-indigo-50 px-2 py-1 rounded-full">
                <Text className="text-indigo-600 text-xs font-medium">+23 pts</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Achievements Section */}
        <View className="px-5 mt-6 mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-gray-800">Achievements</Text>
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-gray-400">View all</Text>
              <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
            </View>
          </View>
          
          <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
            <View className="flex-row flex-wrap gap-3 justify-between">
              <View className="flex-row items-center gap-2">
                <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
                  <Ionicons name="medal" size={20} color="#F59E0B" />
                </View>
                <View>
                  <Text className="text-sm font-medium text-gray-700">Task Master</Text>
                  <Text className="text-[10px] text-gray-400">Completed 50 tasks</Text>
                </View>
              </View>
              
              <View className="flex-row items-center gap-2">
                <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center">
                  <Ionicons name="people" size={20} color="#10B981" />
                </View>
                <View>
                  <Text className="text-sm font-medium text-gray-700">Group Leader</Text>
                  <Text className="text-[10px] text-gray-400">Joined 15 groups</Text>
                </View>
              </View>
              
              <View className="flex-row items-center gap-2">
                <View className="w-10 h-10 rounded-full bg-indigo-100 items-center justify-center">
                  <Ionicons name="rocket" size={20} color="#6366F1" />
                </View>
                <View>
                  <Text className="text-sm font-medium text-gray-700">Early Adopter</Text>
                  <Text className="text-[10px] text-gray-400">156 points earned</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View className="bg-white/95 border-t border-gray-200 pt-2 pb-6 px-6 flex-row justify-between items-center">
        <View className="items-center gap-1">
          <Ionicons name="home" size={24} color="#9CA3AF" />
          <Text className="text-[11px] font-medium text-gray-400">Home</Text>
        </View>
        
        <View className="items-center gap-1">
          <Ionicons name="checkbox-outline" size={24} color="#9CA3AF" />
          <Text className="text-[11px] font-medium text-gray-400">Tasks</Text>
        </View>
        
        <View className="items-center gap-1">
          <Ionicons name="calendar-outline" size={24} color="#9CA3AF" />
          <Text className="text-[11px] font-medium text-gray-400">Calendar</Text>
        </View>
        
        <View className="items-center gap-1">
          <Ionicons name="person-circle" size={24} color="#4B7BEC" />
          <Text className="text-[11px] font-medium text-[#4B7BEC]">Profile</Text>
        </View>
      </View>
    </View>
  );
}