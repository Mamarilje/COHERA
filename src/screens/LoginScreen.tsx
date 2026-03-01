import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  return (
    <View className="flex-1 bg-white justify-center px-6">

      {/* Title */}
      <Text className="text-3xl font-bold mb-8 text-center">
        Login
      </Text>

      {/* Email Input */}
      <TextInput
        placeholder="Email"
        className="border border-gray-300 rounded-xl p-4 mb-4"
      />

      {/* Password Input */}
      <TextInput
        placeholder="Password"
        secureTextEntry
        className="border border-gray-300 rounded-xl p-4 mb-6"
      />

      {/* Login Button */}
      <TouchableOpacity
        className="bg-[#8B4A00] p-4 rounded-xl"
        onPress={() => navigation.navigate("Home")}
      >
        <Text className="text-white text-center font-bold">
          Login
        </Text>
      </TouchableOpacity>

    </View>
  );
}