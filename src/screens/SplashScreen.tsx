import { View, Text, TouchableOpacity, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

export default function SplashScreen({ navigation }: Props) {
  return (
    <TouchableOpacity
      className="flex-1 bg-[#E6C35A] items-center justify-center"
      onPress={() => navigation.navigate("Login")}
      activeOpacity={0.9}
    >
      <Image
        source={require("../../assets/logo.png")}
        className="w-40 h-40 mb-6"
      />

      <Text className="text-4xl font-bold text-[#8B4A00]">
        COHERA
      </Text>

      <Text className="text-lg text-[#B87400] mt-2">
        Collaborate Better
      </Text>

      <Text className="mt-16 text-[#8B4A00]">
        Tap anywhere to start
      </Text>
    </TouchableOpacity>
  );
}