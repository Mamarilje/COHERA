import { View, Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View className="flex-1 bg-white justify-center items-center px-6">
      <Text className="text-3xl font-bold">Welcome to Cohera!</Text>
      <Text className="text-lg text-gray-600 mt-4 text-center">
        You have successfully logged in.
      </Text>
    </View>
  );
}
