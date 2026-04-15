import { loginUser } from "@/src/auth/login";
import { supabase } from "@/src/Supabase/supabaseConfig";
import { router } from "expo-router";
import { getAuth } from "firebase/auth";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

type CheckItemProps = {
  met: boolean;
  label: string;
};

function CheckItem({ met, label }: CheckItemProps) {
  return (
    <View className="flex-row items-center mb-1">
      <Text
        className={`mr-2 font-bold ${met ? "text-green-500" : "text-gray-400"}`}
      >
        {met ? "✓" : "○"}
      </Text>
      <Text className={`text-sm ${met ? "text-green-500" : "text-gray-400"}`}>
        {label}
      </Text>
    </View>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ Email checks
  const emailFilled = email.trim().length > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ✅ Password checks
  const passwordFilled = password.length > 0;
  const passwordLongEnough = password.length >= 8;
  const passwordHasUppercase = /[A-Z]/.test(password);
  const passwordHasLowercase = /[a-z]/.test(password);
  const passwordHasNumber = /[0-9]/.test(password);
  const passwordHasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
    password,
  );
  const passwordNoSpaces = password.length > 0 && !/\s/.test(password);

  // ✅ All restrictions must be met before allowing submission
  const isFormValid =
    emailFilled &&
    emailValid &&
    passwordFilled &&
    passwordLongEnough &&
    passwordHasUppercase &&
    passwordHasLowercase &&
    passwordHasNumber &&
    passwordHasSpecial &&
    passwordNoSpaces;

  const handleLogin = async (): Promise<void> => {
    if (!isFormValid) return;

    setLoading(true);
    setError("");

    try {
      await loginUser(email, password);

      const user = getAuth().currentUser;

      if (user) {
        const { error } = await supabase.from("profiles").upsert(
          {
            firebase_uid: user.uid,
            email: user.email ?? null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "firebase_uid",
          },
        );

        if (error) {
          console.warn("Supabase upsert warning:", error.message);
        }
      }

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
      <Text className="text-3xl font-bold text-center mb-10">Login</Text>

      {error ? (
        <Text className="text-red-500 text-center mb-4">{error}</Text>
      ) : null}

      {/* Email */}
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
        autoCapitalize="none"
        keyboardType="email-address"
        className="border p-4 rounded-xl border-gray-300"
      />
      <View className="px-1 pt-1 mb-4">
        <CheckItem met={emailFilled} label="Email is filled in" />
        <CheckItem
          met={emailValid}
          label="Valid email format (e.g. user@email.com)"
        />
      </View>

      {/* Password */}
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        secureTextEntry
        className="border p-4 rounded-xl border-gray-300"
      />
      <View className="px-1 pt-1 mb-2">
        <CheckItem met={passwordFilled} label="Password is filled in" />
        <CheckItem met={passwordLongEnough} label="At least 8 characters" />
        <CheckItem
          met={passwordHasUppercase}
          label="At least one uppercase letter (A-Z)"
        />
        <CheckItem
          met={passwordHasLowercase}
          label="At least one lowercase letter (a-z)"
        />
        <CheckItem met={passwordHasNumber} label="At least one number (0-9)" />
        <CheckItem
          met={passwordHasSpecial}
          label="At least one special character (!@#$%...)"
        />
        <CheckItem met={passwordNoSpaces} label="No spaces allowed" />
      </View>

      {/* ── Forgot Password link ── */}
      <Pressable
        onPress={() => router.push("./forgotPassword")}
        disabled={loading}
        className="mb-6 self-end"
      >
        <Text className="text-yellow-600 text-sm font-medium">
          Forgot password?
        </Text>
      </Pressable>

      <Pressable
        onPress={handleLogin}
        disabled={loading || !isFormValid}
        className={`${
          loading
            ? "bg-yellow-400"
            : !isFormValid
              ? "bg-gray-300"
              : "bg-yellow-500"
        } p-4 rounded-xl mb-4`}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-bold">Login</Text>
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
