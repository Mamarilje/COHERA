import { View, Text, Button } from "react-native";
import { router } from "expo-router";

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Welcome to Task Manager</Text>

      <Button title="Go to Login" onPress={() => router.push("/auth/login")} />
      <Button title="Go to Register" onPress={() => router.push("/auth/register")} />
    </View>
  );
}
