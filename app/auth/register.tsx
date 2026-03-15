import { View, Text, TextInput, Button } from "react-native";
import { useState } from "react";
import { registerUser } from "../../src/auth/register";
import { router } from "expo-router";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      await registerUser(name, email, password);
      alert("Registered successfully!");
      router.replace("/(tabs)");
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Register</Text>

      <TextInput
        placeholder="Name"
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          backgroundColor: "#fff",
          color: "#000",
          padding: 12,
          marginBottom: 12,
          borderRadius: 6,
        }}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          backgroundColor: "#fff",
          color: "#000",
          padding: 12,
          marginBottom: 12,
          borderRadius: 6,
        }}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          backgroundColor: "#fff",
          color: "#000",
          padding: 12,
          marginBottom: 20,
          borderRadius: 6,
        }}
      />

      <Button title="Register" onPress={handleRegister} />
    </View>
  );
}
