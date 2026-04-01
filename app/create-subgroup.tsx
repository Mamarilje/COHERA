import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

export default function CreateSubgroup() {
  const router = useRouter();
  const { groupName } = useLocalSearchParams<{ groupName: string }>();
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
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white px-5 pt-12 pb-4 flex-row items-center border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View>
          <Text className="text-sm text-gray-500">{groupName}</Text>
          <Text className="text-xl font-bold text-gray-800">Create Subgroup</Text>
        </View>
      </View>

      <View className="flex-1 px-5 pt-8">
        <TextInput
          className="bg-white rounded-xl p-4 border border-gray-200 mb-6"
          placeholder="Subgroup Name"
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