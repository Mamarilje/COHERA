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
import { Ionicons } from "@expo/vector-icons"; // Make sure to install expo/vector-icons

type CheckItemProps = {
  met: boolean;
  label: string;
};

function CheckItem({ met, label }: CheckItemProps) {
  return (
    <View className="flex-row items-center mb-2">
      <Text
        className={`mr-2 font-bold text-lg ${met ? "text-green-500" : "text-gray-400"}`}
      >
        {met ? "✓" : "○"}
      </Text>
      <Text className={`text-sm ${met ? "text-green-500" : "text-gray-400"}`}>
        {label}
      </Text>
    </View>
  );
}

function EmailValidationTooltip({
  visible,
  emailFilled,
  emailValid,
}: any) {
  if (!visible) return null;

  return (
    <View className="absolute top-full left-0 mt-2 z-50">
      {/* Pointer triangle */}
      <View className="absolute -top-2 left-10 w-4 h-4 bg-white rotate-45 border-l border-t border-gray-300" />

      {/* Tooltip box */}
      <View className="bg-white border border-gray-300 rounded-xl px-4 py-4 shadow-lg min-w-[320px]">
        <View className="flex-row items-start">
          {/* Warning icon box */}
          <View className="w-10 h-10 rounded-md bg-yellow-400 items-center justify-center mr-4">
            <Text className="text-white font-bold text-xl">!</Text>
          </View>

          <View className="flex-1">
            <Text className="text-sm font-semibold text-orange-600 mb-3">
              Email Requirements:
            </Text>

            <CheckItem met={emailFilled} label="Email is filled in" />
            <CheckItem
              met={emailValid}
              label="Valid email format (e.g. user@email.com)"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function PasswordValidationTooltip({
  visible,
  passwordFilled,
  passwordLongEnough,
  passwordHasUppercase,
  passwordHasLowercase,
  passwordHasNumber,
  passwordHasSpecial,
  passwordNoSpaces,
}: any) {
  if (!visible) return null;

  return (
    <View className="absolute top-full left-0 mt-2 z-50">
      {/* Pointer triangle */}
      <View className="absolute -top-2 left-10 w-4 h-4 bg-white rotate-45 border-l border-t border-gray-300" />

      {/* Tooltip box */}
      <View className="bg-white border border-gray-300 rounded-xl px-4 py-4 shadow-lg min-w-[350px]">
        <View className="flex-row items-start">
          {/* Warning icon box */}
          <View className="w-10 h-10 rounded-md bg-yellow-400 items-center justify-center mr-4">
            <Text className="text-white font-bold text-xl">!</Text>
          </View>

          <View className="flex-1">
            <Text className="text-sm font-semibold text-orange-600 mb-3">
              Password Requirements:
            </Text>

            <CheckItem met={passwordFilled} label="Password is filled in" />
            <CheckItem met={passwordLongEnough} label="At least 8 characters" />
            <CheckItem met={passwordHasUppercase} label="At least one uppercase letter (A-Z)" />
            <CheckItem met={passwordHasLowercase} label="At least one lowercase letter (a-z)" />
            <CheckItem met={passwordHasNumber} label="At least one number (0-9)" />
            <CheckItem met={passwordHasSpecial} label="At least one special character (!@#$%...)" />
            <CheckItem met={passwordNoSpaces} label="No spaces allowed" />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

      {/* Wrapper with higher z-index for tooltip overlay */}
      <View style={{ zIndex: focusedField === "email" ? 100 : 1 }}>
        <View className="relative">
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField("email")}
            onBlur={() => setFocusedField(null)}
            editable={!loading}
            autoCapitalize="none"
            keyboardType="email-address"
            className="border p-4 rounded-xl border-gray-300 bg-white"
          />
          
          <EmailValidationTooltip 
            visible={focusedField === "email"}
            emailFilled={emailFilled}
            emailValid={emailValid}
          />
        </View>
      </View>

      {/* Password wrapper with proper z-index handling */}
      <View style={{ zIndex: focusedField === "password" ? 100 : 1, marginTop: 24 }}>
        <View className="relative">
          <View className="relative">
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              editable={!loading}
              secureTextEntry={!showPassword}
              className="border p-4 rounded-xl border-gray-300 bg-white pr-12"
            />
            
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name={showPassword ? "eye-off" : "eye"} 
                size={24} 
                color="#9CA3AF" 
              />
            </Pressable>
          </View>

          <PasswordValidationTooltip 
            visible={focusedField === "password"}
            passwordFilled={passwordFilled}
            passwordLongEnough={passwordLongEnough}
            passwordHasUppercase={passwordHasUppercase}
            passwordHasLowercase={passwordHasLowercase}
            passwordHasNumber={passwordHasNumber}
            passwordHasSpecial={passwordHasSpecial}
            passwordNoSpaces={passwordNoSpaces}
          />
        </View>
      </View>

      {/* Forgot Password link */}
      <Pressable
        onPress={() => router.push("./forgotPassword")}
        disabled={loading}
        className="mb-6 mt-4 self-end"
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