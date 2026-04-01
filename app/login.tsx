import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { loginUser } from "@/src/auth/login";
import { supabase } from "@/src/Supabase/supabaseConfig";
import { getAuth } from "firebase/auth";


export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

 const handleLogin = async (): Promise<void> => {
  if (!email || !password) {
    setError("Please fill in all fields");
    Alert.alert("Error", "Please fill in all fields");
    return;
  }

  setLoading(true);
  setError("");

  try {
    // 🔥 Login with Firebase
    await loginUser(email, password);

    // 🔥 Get current user
    const user = getAuth().currentUser;

    if (user) {
      // 🔥 Ensure profile exists in Supabase
      const { error } = await supabase
        .from("profiles")
        .upsert(
  {
    firebase_uid: user.uid,
    email: user.email ?? null,
    updated_at: new Date().toISOString(),
  },
  {
    onConflict: "firebase_uid", // 🔥 THIS FIXES 409 ERROR
  }
);

      if (error) {
        console.warn("Supabase upsert warning:", error.message);
      }
    }

    // 🔥 Navigate AFTER sync
    router.replace("/(tabs)");

  } catch (err: any) {
    const errorMessage: string = err?.message || "Login failed";
    setError(errorMessage);
    Alert.alert("Login Error", errorMessage);
  } finally {
    setLoading(false);
  }
};

  return (
    <View className="flex-1 justify-center px-6 bg-white">

      <Text className="text-3xl font-bold text-center mb-10">
        Login
      </Text>

      {error ? (
        <Text className="text-red-500 text-center mb-4">{error}</Text>
      ) : null}

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
        className="border p-4 rounded-xl mb-6 border-gray-300"
      />

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        className={`${loading ? "bg-yellow-400" : "bg-yellow-500"} p-4 rounded-xl mb-4`}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-bold">
            Login
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.push("./register")} disabled={loading}>
        <Text className="text-center text-gray-500">
          Don't have an account? Register
        </Text>
      </Pressable>

    </View>
  );
}