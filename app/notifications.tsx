import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Notifications() {
  const router = useRouter();

  const notifications: { id: number; title: string; message: string; time: string; read: boolean }[] = [];

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white px-5 pt-12 pb-4 flex-row items-center border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-800">Notifications</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-6">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <View key={notification.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-200">
              <View className="flex-row items-start">
                <View className={`w-2 h-2 rounded-full ${notification.read ? 'bg-gray-300' : 'bg-orange-500'} mt-2 mr-3`} />
                <View className="flex-1">
                  <Text className="font-semibold text-gray-800">{notification.title}</Text>
                  <Text className="text-gray-500 text-sm mt-1">{notification.message}</Text>
                  <Text className="text-gray-400 text-xs mt-2">{notification.time}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View className="items-center justify-center py-10">
            <Ionicons name="notifications-off-outline" size={50} color="#ccc" />
            <Text className="text-gray-400 mt-3">No notifications yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}