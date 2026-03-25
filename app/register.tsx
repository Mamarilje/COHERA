import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { registerUser } from "@/src/auth/register";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await registerUser(name, email, password);
      Alert.alert("Success", "Account created successfully");
      router.replace("/(tabs)");
    } catch (err: any) {
      const errorMessage = err?.message || "Registration failed";
      setError(errorMessage);
      Alert.alert("Registration Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center px-6 bg-white">

      <Text className="text-3xl font-bold text-center mb-10">
        Register
      </Text>

      {error ? (
        <Text className="text-red-500 text-center mb-4">{error}</Text>
      ) : null}

      <TextInput
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        editable={!loading}
        className="border p-4 rounded-xl mb-4 border-gray-300"
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
        autoCapitalize="none"
        keyboardType="email-address"
        className="border p-4 rounded-xl mb-4 border-gray-300"
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        secureTextEntry
        className="border p-4 rounded-xl mb-4 border-gray-300"
      />

      <TextInput
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!loading}
        secureTextEntry
        className="border p-4 rounded-xl mb-6 border-gray-300"
      />

      <Pressable
        onPress={handleRegister}
        disabled={loading}
        className={`${loading ? "bg-yellow-400" : "bg-yellow-500"} p-4 rounded-xl mb-4`}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-bold">
            Create Account
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.back()} disabled={loading}>
        <Text className="text-center text-gray-500">
          Already have an account? Login
        </Text>
      </Pressable>

    </View>
  );
}