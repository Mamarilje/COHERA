import { View, Text } from "react-native";

export default function Calendar() {
  return (
    <View className="flex-1 items-center justify-center bg-white">

      <Text className="text-3xl font-bold mb-4">
        Calendar
      </Text>

      <Text className="text-gray-500">
        Upcoming events will appear here
      </Text>

    </View>
  );
}