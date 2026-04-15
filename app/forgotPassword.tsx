import { router } from "expo-router";
import {
  confirmPasswordReset,
  getAuth,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
} from "firebase/auth";
import { useState } from "react";
import {
  ActivityIndicator,
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

export default function ForgotPassword() {
  const [step, setStep] = useState<"input" | "sent" | "reset" | "done">(
    "input",
  );
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // ─── Reset step state ──────────────────────────────────────────────────────
  const [oobCode, setOobCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // ✅ Email checks
  const emailFilled = email.trim().length > 0;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // ✅ Password restriction checks (same as register.tsx)
  const passwordLongEnough = newPassword.length >= 8;
  const passwordHasUppercase = /[A-Z]/.test(newPassword);
  const passwordHasLowercase = /[a-z]/.test(newPassword);
  const passwordHasNumber = /[0-9]/.test(newPassword);
  const passwordHasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
    newPassword,
  );
  const passwordNoSpaces = newPassword.length > 0 && !/\s/.test(newPassword);
  const confirmPasswordFilled = confirmPassword.length > 0;
  const passwordsMatch =
    newPassword === confirmPassword && confirmPassword.length > 0;

  const isPasswordValid =
    passwordLongEnough &&
    passwordHasUppercase &&
    passwordHasLowercase &&
    passwordHasNumber &&
    passwordHasSpecial &&
    passwordNoSpaces &&
    confirmPasswordFilled &&
    passwordsMatch;

  const handleSendReset = async (): Promise<void> => {
    if (!emailValid) return;

    setSending(true);
    setError("");

    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email.trim());
      setStep("sent");
    } catch (err: any) {
      // Show success screen regardless of auth/user-not-found or
      // auth/invalid-email to prevent email enumeration attacks.
      if (
        err?.code === "auth/user-not-found" ||
        err?.code === "auth/invalid-email"
      ) {
        setStep("sent");
      } else {
        setError(
          err?.message || "Failed to send reset email. Please try again.",
        );
      }
    } finally {
      setSending(false);
    }
  };

  // ✅ Called when the user arrives back in-app with the oobCode from the email link.
  // You should call this from your deep-link / URL handler and pass the code here.
  const handleVerifyAndReset = async (): Promise<void> => {
    if (!isPasswordValid || !oobCode) return;

    setResetting(true);
    setError("");

    try {
      const auth = getAuth();
      // Verify the code is still valid before letting the user set a new password
      await verifyPasswordResetCode(auth, oobCode);
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStep("done");
    } catch (err: any) {
      setError(
        err?.message || "Failed to reset password. The link may have expired.",
      );
    } finally {
      setResetting(false);
    }
  };

  // ─── Step 1: Email Input ───────────────────────────────────────────────────
  if (step === "input") {
    return (
      <View className="flex-1 justify-center px-6 bg-white">
        {/* Header */}
        <Text className="text-3xl font-bold text-center mb-3">
          Forgot Password
        </Text>
        <Text className="text-gray-500 text-center text-sm mb-10">
          Enter the email address linked to your account and we'll send you a
          link to reset your password.
        </Text>

        {/* Error */}
        {error ? (
          <Text className="text-red-500 text-center text-sm mb-4">{error}</Text>
        ) : null}

        {/* Email input */}
        <TextInput
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          editable={!sending}
          autoCapitalize="none"
          keyboardType="email-address"
          className="border p-4 rounded-xl border-gray-300"
        />
        <View className="px-1 pt-1 mb-8">
          <CheckItem met={emailFilled} label="Email is filled in" />
          <CheckItem
            met={emailValid}
            label="Valid email format (e.g. user@email.com)"
          />
        </View>

        {/* Send button */}
        <Pressable
          onPress={handleSendReset}
          disabled={sending || !emailValid}
          className={`p-4 rounded-xl mb-4 ${
            sending
              ? "bg-yellow-400"
              : !emailValid
                ? "bg-gray-300"
                : "bg-yellow-500"
          }`}
        >
          {sending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-bold">
              Send Reset Link
            </Text>
          )}
        </Pressable>

        {/* Back to login */}
        <Pressable onPress={() => router.back()} disabled={sending}>
          <Text className="text-center text-gray-500">Back to Login</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Step 2: Confirmation ──────────────────────────────────────────────────
  if (step === "sent") {
    return (
      <View className="flex-1 justify-center px-6 bg-white">
        <Text className="text-6xl text-center mb-6">📬</Text>

        <Text className="text-3xl font-bold text-center mb-3">
          Check Your Email
        </Text>

        <Text className="text-gray-500 text-center text-sm mb-2">
          If an account exists for
        </Text>
        <Text className="text-yellow-600 font-semibold text-center text-base mb-4">
          {email.trim()}
        </Text>
        <Text className="text-gray-500 text-center text-sm mb-10">
          you will receive a password reset link shortly.{"\n"}
          Please also check your spam or junk folder.
        </Text>

        {/* Back to login */}
        <Pressable
          onPress={() => router.replace("./login")}
          className="bg-yellow-500 p-4 rounded-xl mb-4"
        >
          <Text className="text-white text-center font-bold">
            Back to Login
          </Text>
        </Pressable>

        {/* Resend option */}
        <Pressable onPress={() => setStep("input")}>
          <Text className="text-center text-gray-500 text-sm">
            Didn't receive it?{" "}
            <Text className="text-yellow-600 font-medium">Try again</Text>
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── Step 3: New Password Entry ────────────────────────────────────────────
  // This step is shown when the user returns to the app via the reset link.
  // Trigger setStep("reset") and setOobCode(code) from your deep-link handler.
  if (step === "reset") {
    return (
      <View className="flex-1 justify-center px-6 bg-white">
        <Text className="text-3xl font-bold text-center mb-3">
          Set New Password
        </Text>
        <Text className="text-gray-500 text-center text-sm mb-8">
          Choose a strong new password for your account.
        </Text>

        {/* Error */}
        {error ? (
          <Text className="text-red-500 text-center text-sm mb-4">{error}</Text>
        ) : null}

        {/* New Password */}
        <TextInput
          placeholder="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          editable={!resetting}
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
          <CheckItem
            met={passwordHasNumber}
            label="At least one number (0-9)"
          />
          <CheckItem
            met={passwordHasSpecial}
            label="At least one special character (!@#$%...)"
          />
          <CheckItem met={passwordNoSpaces} label="No spaces allowed" />
        </View>

        {/* Confirm New Password */}
        <TextInput
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!resetting}
          secureTextEntry
          className="border p-4 rounded-xl border-gray-300"
        />
        <View className="px-1 pt-1 mb-8">
          <CheckItem
            met={confirmPasswordFilled}
            label="Confirm password is filled in"
          />
          <CheckItem met={passwordsMatch} label="Passwords match" />
        </View>

        {/* Submit button */}
        <Pressable
          onPress={handleVerifyAndReset}
          disabled={resetting || !isPasswordValid}
          className={`p-4 rounded-xl mb-4 ${
            resetting
              ? "bg-yellow-400"
              : !isPasswordValid
                ? "bg-gray-300"
                : "bg-yellow-500"
          }`}
        >
          {resetting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-bold">
              Reset Password
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.replace("./login")}
          disabled={resetting}
        >
          <Text className="text-center text-gray-500">Back to Login</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Step 4: Success ───────────────────────────────────────────────────────
  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-6xl text-center mb-6">✅</Text>

      <Text className="text-3xl font-bold text-center mb-3">
        Password Reset!
      </Text>
      <Text className="text-gray-500 text-center text-sm mb-10">
        Your password has been successfully updated.{"\n"}
        You can now log in with your new password.
      </Text>

      <Pressable
        onPress={() => router.replace("./login")}
        className="bg-yellow-500 p-4 rounded-xl"
      >
        <Text className="text-white text-center font-bold">Back to Login</Text>
      </Pressable>
    </View>
  );
}
