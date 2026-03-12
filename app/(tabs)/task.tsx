import { View, Text, ScrollView } from "react-native";

const taskList = [
  { id: 1, title: "Design Login Screen" },
  { id: 2, title: "Build API Integration" },
  { id: 3, title: "Test Mobile UI" },
];

export default function Tasks() {
  return (
    <ScrollView className="flex-1 bg-white p-6">

      <Text className="text-3xl font-bold mb-6">
        Tasks
      </Text>

      {taskList.map((task) => (
        <View
          key={task.id}
          className="bg-gray-100 p-4 rounded-xl mb-3"
        >
          <Text className="font-semibold">{task.title}</Text>
        </View>
      ))}

    </ScrollView>
  );
}