import { Pressable, View, Text, Image } from "react-native";
import { router } from "expo-router";

export default function Splash() {
  return (
    <Pressable
      onPress={() => router.replace("/login")}
      className="flex-1 items-center justify-center bg-yellow-300"
    >
      <View className="items-center">
        <Image
          source={require("@/assets/images/logo.png")}
          className="w-40 h-40 mb-8"
          resizeMode="contain"
        />

        <Text className="text-4xl font-bold text-amber-900">
          COHERA
        </Text>

        <Text className="text-lg text-amber-700 mt-2">
          Collaborate Better
        </Text>

        <Text className="mt-16 text-amber-900">
          Tap anywhere to start
        </Text>

      </View>
    </Pressable>
  );
}