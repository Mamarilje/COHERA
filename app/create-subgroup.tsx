import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../src/theme/AppThemeContext";

export default function CreateSubgroup() {
  const router = useRouter();
  const { groupName } = useLocalSearchParams<{ groupName: string }>();
  const { colors } = useAppTheme();
  const [subgroupName, setSubgroupName] = useState("");

  const handleCreateSubgroup = () => {
    if (!subgroupName.trim()) {
      Alert.alert("Error", "Please enter a subgroup name");
      return;
    }
    
    Alert.alert("Success", `Subgroup "${subgroupName}" created!`, [
      { text: "OK", onPress: () => router.back() }
    ]);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-5 pt-12 pb-4 flex-row items-center border-b" style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text className="text-sm" style={{ color: colors.textMuted }}>{groupName}</Text>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>Create Subgroup</Text>
        </View>
      </View>

      <View className="flex-1 px-5 pt-8">
        <TextInput
          className="rounded-xl p-4 border mb-6"
          style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }}
          placeholder="Subgroup Name"
          placeholderTextColor={colors.textSoft}
          value={subgroupName}
          onChangeText={setSubgroupName}
        />

        <TouchableOpacity
          onPress={handleCreateSubgroup}
          className="bg-orange-500 rounded-xl p-4 items-center"
        >
          <Text className="text-white font-semibold">Create Subgroup</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
