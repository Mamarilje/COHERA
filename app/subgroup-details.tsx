import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function SubgroupDetails() {
  const router = useRouter();
  const { groupName, subGroupName } = useLocalSearchParams<{ groupName: string; subGroupName: string }>();

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white px-5 pt-12 pb-4 flex-row items-center border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View>
          <Text className="text-sm text-gray-500">{groupName}</Text>
          <Text className="text-xl font-bold text-gray-800">{subGroupName}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-6">
        <View className="bg-white rounded-xl p-8 items-center justify-center">
          <Ionicons name="clipboard-outline" size={50} color="#ccc" />
          <Text className="text-gray-400 text-center mt-3">No tasks in this group yet</Text>
          <TouchableOpacity className="mt-4 bg-orange-500 rounded-xl px-6 py-3">
            <Text className="text-white font-semibold">Create First Task</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}