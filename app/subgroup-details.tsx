import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../src/theme/AppThemeContext";

export default function SubgroupDetails() {
  const router = useRouter();
  const { groupName, subGroupName } = useLocalSearchParams<{ groupName: string; subGroupName: string }>();
  const { colors } = useAppTheme();

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-5 pt-12 pb-4 flex-row items-center border-b" style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text className="text-sm" style={{ color: colors.textMuted }}>{groupName}</Text>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>{subGroupName}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-6">
        <View className="rounded-xl p-8 items-center justify-center" style={{ backgroundColor: colors.surface }}>
          <Ionicons name="clipboard-outline" size={50} color={colors.textSoft} />
          <Text className="text-center mt-3" style={{ color: colors.textSoft }}>No tasks in this group yet</Text>
          <TouchableOpacity className="mt-4 bg-orange-500 rounded-xl px-6 py-3">
            <Text className="text-white font-semibold">Create First Task</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
