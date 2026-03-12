import { View, Text, TextInput, Pressable } from "react-native";
import { router } from "expo-router";

export default function Register() {
  return (
    <View className="flex-1 justify-center px-6 bg-white">

      <Text className="text-3xl font-bold text-center mb-10">
        Register
      </Text>

      <TextInput
        placeholder="Name"
        className="border p-4 rounded-xl mb-4"
      />

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
        className="bg-yellow-500 p-4 rounded-xl mb-4"
      >
        <Text className="text-white text-center font-bold">
          Create Account
        </Text>
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text className="text-center text-gray-500">
          Already have an account? Login
        </Text>
      </Pressable>

    </View>
  );
}