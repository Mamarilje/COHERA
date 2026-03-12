import { View, Text, TextInput, Pressable } from "react-native";
import { router } from "expo-router";

export default function Login() {
  return (
    <View className="flex-1 justify-center px-6 bg-white">

      <Text className="text-3xl font-bold text-center mb-10">
        Login
      </Text>

      <TextInput
        placeholder="Email"
        className="border p-4 rounded-xl mb-4"
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        className="border p-4 rounded-xl mb-6"
      />

      <Pressable
        onPress={() => router.replace("/(tabs)")}
        className="bg-yellow-500 p-4 rounded-xl mb-4"
      >
        <Text className="text-white text-center font-bold">
          Login
        </Text>
      </Pressable>

      <Pressable onPress={() => router.push("./register")}>
        <Text className="text-center text-gray-500">
          Don't have an account? Register
        </Text>
      </Pressable>

    </View>
  );
}