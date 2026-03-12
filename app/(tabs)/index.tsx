import { View, Text, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function Home() {

  const tasks = [
    {
      id: 1,
      title: "Complete Proposal",
      time: "Due: 3:00PM • School",
      priority: "High",
      color: "border-red-400",
      badge: "bg-red-100 text-red-500",
      done: false,
    },
    {
      id: 2,
      title: "Review Design",
      time: "Due: 5:00PM • Work",
      priority: "Medium",
      color: "border-orange-400",
      badge: "bg-orange-100 text-orange-500",
      done: false,
    },
    {
      id: 3,
      title: "Team Meeting",
      time: "Due: 10:00AM • Work",
      priority: "Completed",
      color: "border-green-400",
      badge: "bg-green-100 text-green-600",
      done: true,
    },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-100 px-5 pt-10">

      {/* HEADER */}
      <View className="flex-row justify-between items-center mb-6">
        <View className="flex-row items-center">
          <Text className="text-xl font-bold text-orange-500">
            COHERA
          </Text>
        </View>

        <Ionicons name="notifications-outline" size={22} color="#444" />
      </View>

      {/* GREETING */}
      <Text className="text-2xl font-bold text-gray-800">
        Hello, Mark!
      </Text>

      <Text className="text-gray-500 mb-6">
        You have 5 tasks today.
      </Text>

      {/* TASK OVERVIEW CARD */}
      <View className="bg-yellow-400 rounded-2xl p-5 mb-6">

        <View className="flex-row items-center mb-4">
          <Ionicons name="folder-outline" size={18} color="white" />
          <Text className="text-white ml-2 font-semibold">
            Task Overview
          </Text>
        </View>

        <View className="flex-row justify-between">

          <View className="bg-yellow-300 rounded-xl px-5 py-4 items-center">
            <Text className="text-xl font-bold text-white">8</Text>
            <Text className="text-white text-xs">To Do</Text>
          </View>

          <View className="bg-yellow-300 rounded-xl px-5 py-4 items-center">
            <Text className="text-xl font-bold text-white">3</Text>
            <Text className="text-white text-xs">In Progress</Text>
          </View>

          <View className="bg-yellow-300 rounded-xl px-5 py-4 items-center">
            <Text className="text-xl font-bold text-white">12</Text>
            <Text className="text-white text-xs">Completed</Text>
          </View>

        </View>
      </View>

      {/* GROUPS */}
      <View className="flex-row justify-between items-center mb-3">
        <Text className="font-semibold text-gray-800">
          My Groups
        </Text>

        <Text className="text-orange-500 text-sm">
          See All →
        </Text>
      </View>

      <View className="flex-row flex-wrap justify-between mb-6">

        {/* GROUP CARD */}
        <View className="bg-white rounded-xl border border-orange-400 w-[48%] p-4 items-center mb-4 shadow">

          <Image
            source={{ uri: "https://cdn-icons-png.flaticon.com/512/3135/3135755.png" }}
            className="w-10 h-10 mb-2"
          />

          <Text className="font-semibold">
            School
          </Text>

          <Text className="text-xs text-gray-500">
            5 tasks
          </Text>

        </View>

        <View className="bg-white rounded-xl border border-orange-400 w-[48%] p-4 items-center mb-4 shadow">

          <Image
            source={{ uri: "https://cdn-icons-png.flaticon.com/512/1995/1995574.png" }}
            className="w-10 h-10 mb-2"
          />

          <Text className="font-semibold">
            Work
          </Text>

          <Text className="text-xs text-gray-500">
            3 tasks
          </Text>

        </View>

        <View className="bg-white rounded-xl border border-orange-400 w-[48%] p-4 items-center mb-4 shadow">

          <Image
            source={{ uri: "https://cdn-icons-png.flaticon.com/512/201/201818.png" }}
            className="w-10 h-10 mb-2"
          />

          <Text className="font-semibold">
            Family
          </Text>

          <Text className="text-xs text-gray-500">
            2 tasks
          </Text>

        </View>

        {/* NEW GROUP */}
        <View className="border-2 border-dashed border-gray-300 rounded-xl w-[48%] p-4 items-center justify-center mb-4">

          <Ionicons name="add" size={30} color="#aaa" />

          <Text className="text-gray-400 text-sm mt-1">
            New Group
          </Text>

        </View>

      </View>

      {/* TODAY TASKS */}
      <Text className="font-semibold text-gray-800 mb-3">
        Today's Task
      </Text>

      {tasks.map((task) => (
        <View
          key={task.id}
          className={`bg-white rounded-xl p-4 mb-3 border-l-4 ${task.color} flex-row justify-between items-center shadow`}
        >

          <View className="flex-row items-center">

            <Ionicons
              name={task.done ? "checkbox" : "square-outline"}
              size={20}
              color={task.done ? "green" : "#444"}
            />

            <View className="ml-3">
              <Text className="font-semibold">
                {task.title}
              </Text>

              <Text className="text-xs text-gray-500">
                {task.time}
              </Text>
            </View>

          </View>

          <View className={`px-3 py-1 rounded-full ${task.badge}`}>
            <Text className="text-xs">
              {task.priority}
            </Text>
          </View>

        </View>
      ))}

    </ScrollView>
  );
}