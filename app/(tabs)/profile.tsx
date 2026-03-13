import { View, Text, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function Profile() {
  return (
    <View className="flex-1 bg-[#F5F7FA]">
      {/* Profile Header Section */}
      <View className="bg-white px-4 pt-12 pb-8 rounded-b-3xl shadow-sm">
        <View className="items-center">
          <Image
            source={{ uri: "https://i.pravatar.cc/150?img=7" }}
            className="w-24 h-24 rounded-full mb-3 border-4 border-white shadow-sm"
          />
          
          <Text className="text-2xl font-bold text-gray-800">
            Mark Oprecio
          </Text>
        </View>
      </View>

      {/* Activity Stats - Floating Box */}
      <View className="px-4 -mt-6">
        <View className="bg-white rounded-2xl p-5 shadow-lg">
          <Text className="text-gray-400 text-xs mb-3 font-medium">Activity Stats</Text>
          
          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-xl font-bold text-gray-800">23</Text>
              <Text className="text-gray-400 text-xs">Tasks</Text>
            </View>
            
            <View className="items-center">
              <Text className="text-xl font-bold text-gray-800">15</Text>
              <Text className="text-gray-400 text-xs">Groups</Text>
            </View>
            
            <View className="items-center">
              <Text className="text-xl font-bold text-gray-800">156</Text>
              <Text className="text-gray-400 text-xs">Points</Text>
            </View>
            
            <View className="items-center">
              <Text className="text-xl font-bold text-gray-800">89%</Text>
              <Text className="text-gray-400 text-xs">Complete</Text>
            </View>
          </View>
        </View>
      </View>

      {/* My Groups Section */}
      <View className="px-4 mt-6">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-lg font-semibold text-gray-800">My Groups</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>
        
        {/* Groups List - Each as a separate card */}
        <View className="space-y-3">
          {[1, 2, 3].map((item) => (
            <View key={item} className="bg-white rounded-xl p-4 flex-row items-center shadow-sm">
              <View className="w-12 h-12 rounded-xl bg-[#F5F7FA] items-center justify-center mr-3">
                <View className="w-6 h-6 rounded-md bg-[#E8EDF5]" />
              </View>
              <View className="flex-1">
                <View className="h-3 w-32 bg-[#F0F3F8] rounded-full mb-2" />
                <View className="h-2 w-24 bg-[#F0F3F8] rounded-full" />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* My Statistics Section */}
      <View className="px-4 mt-6">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-lg font-semibold text-gray-800">My Statistics</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>
        
        {/* Statistics Card */}
        <View className="bg-white rounded-xl p-4 shadow-sm">
          {/* Statistics Graph Placeholder with bars */}
          <View className="h-32 flex-row items-end justify-around">
            {[40, 65, 80, 45, 70, 55, 85].map((height, index) => (
              <View key={index} className="items-center">
                <View 
                  className="w-6 bg-[#4B7BEC] rounded-t-lg" 
                  style={{ height: height }}
                />
                <Text className="text-xs text-gray-400 mt-2">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Bottom Navigation - Already have this, just for visual reference */}
      <View className="flex-1" />
    </View>
  );
}