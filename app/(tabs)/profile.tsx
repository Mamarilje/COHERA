import { View, Text, Image } from "react-native";

export default function Profile() {
  return (
    <View className="flex-1 items-center justify-center bg-white">

      <Image
        source={{ uri: "https://i.pravatar.cc/150" }}
        className="w-24 h-24 rounded-full mb-4"
      />

      <Text className="text-2xl font-bold">
        Juan Dela Cruz
      </Text>

      <Text className="text-gray-500">
        Project Manager
      </Text>

    </View>
  );
}