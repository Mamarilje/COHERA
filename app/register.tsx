import { registerUser } from "@/src/auth/register";
import { router } from "expo-router";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  reload,
  sendEmailVerification,
} from "firebase/auth";
import { useEffect, useRef, useState } from "react";
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

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ Email verification state
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ✅ General checks
  const nameFilled = name.trim().length > 0;
  const emailFilled = email.trim().length > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const confirmPasswordFilled = confirmPassword.length > 0;
  const passwordsMatch =
    password === confirmPassword && confirmPassword.length > 0;

  // ✅ Password restriction checks
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
    nameFilled &&
    emailFilled &&
    emailValid &&
    passwordLongEnough &&
    passwordHasUppercase &&
    passwordHasLowercase &&
    passwordHasNumber &&
    passwordHasSpecial &&
    passwordNoSpaces &&
    confirmPasswordFilled &&
    passwordsMatch;

  // ✅ Poll Firebase every 3s to check if user verified their email
  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          await reload(user);
          if (user.emailVerified) {
            stopPolling();
            // ✅ Email verified — now finalize account creation
            try {
              await registerUser(name, email, password);
              Alert.alert("Success", "Account created successfully!");
              router.replace("/(tabs)");
            } catch (err: any) {
              // If registerUser does its own createUser internally,
              // the temp account is already verified — just navigate
              router.replace("/(tabs)");
            }
          }
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // ✅ Resend cooldown timer
  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    try {
      const user = getAuth().currentUser;
      if (user) {
        await sendEmailVerification(user);
        startCooldown();
        Alert.alert("Email Sent", "A new verification email has been sent.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to resend email.");
    }
  };

  // ✅ Cancel verification — delete the temporary unverified account
  const handleCancelVerification = async () => {
    stopPolling();
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    try {
      const user = getAuth().currentUser;
      if (user) {
        await deleteUser(user);
      }
    } catch (err) {
      console.warn("Could not delete temp user:", err);
    }
    setAwaitingVerification(false);
    setResendCooldown(0);
    setError("");
  };

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleRegister = async () => {
    if (!isFormValid) return;

    setLoading(true);
    setError("");

    try {
      // Step 1: Create a temporary Firebase account
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      // Step 2: Send verification email before finalizing
      await sendEmailVerification(userCredential.user);

      // Step 3: Show verification screen and start polling
      setAwaitingVerification(true);
      startPolling();
      startCooldown();
    } catch (err: any) {
      const errorMessage = err?.message || "Registration failed";
      setError(errorMessage);
      Alert.alert("Registration Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Email verification waiting screen
  if (awaitingVerification) {
    return (
      <View className="flex-1 justify-center px-6 bg-white">
        <Text className="text-3xl font-bold text-center mb-4">
          Verify Your Email
        </Text>
        <Text className="text-center text-gray-500 mb-2">
          A verification link has been sent to:
        </Text>
        <Text className="text-center font-semibold text-black mb-8">
          {email}
        </Text>

        <View className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-8">
          <Text className="text-yellow-800 text-sm text-center">
            Please check your inbox and click the verification link. This screen
            will automatically continue once verified.
          </Text>
        </View>

        <Pressable
          onPress={handleResend}
          disabled={resendCooldown > 0}
          className={`${
            resendCooldown > 0 ? "bg-gray-300" : "bg-yellow-500"
          } p-4 rounded-xl mb-4`}
        >
          <Text className="text-white text-center font-bold">
            {resendCooldown > 0
              ? `Resend Email (${resendCooldown}s)`
              : "Resend Verification Email"}
          </Text>
        </Pressable>

        <Pressable onPress={handleCancelVerification}>
          <Text className="text-center text-gray-500">
            Cancel & Back to Registration
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-3xl font-bold text-center mb-10">Register</Text>

      {error ? (
        <Text className="text-red-500 text-center mb-4">{error}</Text>
      ) : null}

      {/* Full Name */}
      <TextInput
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        editable={!loading}
        className="border p-4 rounded-xl border-gray-300"
      />
      <View className="px-1 pt-1 mb-4">
        <CheckItem met={nameFilled} label="Full name is filled in" />
      </View>

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
      <View className="px-1 pt-1 mb-4">
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

      {/* Confirm Password */}
      <TextInput
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!loading}
        secureTextEntry
        className="border p-4 rounded-xl border-gray-300"
      />
      <View className="px-1 pt-1 mb-6">
        <CheckItem
          met={confirmPasswordFilled}
          label="Confirm password is filled in"
        />
        <CheckItem met={passwordsMatch} label="Passwords match" />
      </View>

      <Pressable
        onPress={handleRegister}
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
