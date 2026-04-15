import EmailJS from "@emailjs/react-native";
import { router } from "expo-router";
import { getAuth, updatePassword } from "firebase/auth";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";

// ─── EmailJS Config ───────────────────────────────────────────────────────────
const EMAILJS_SERVICE_ID = "service_qtzyxgp"; // from EmailJS dashboard
const EMAILJS_TEMPLATE_ID = "template_f1azoya"; // from EmailJS dashboard
const EMAILJS_PUBLIC_KEY = "K0EXellidvvwgm5jR"; // from EmailJS dashboard

// ─── Shared check-item component ─────────────────────────────────────────────
type CheckItemProps = { met: boolean; label: string };

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a random 6-digit OTP string */
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** Send the OTP via EmailJS */
async function sendOtpEmail(email: string, otp: string): Promise<void> {
  await EmailJS.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    {
      email: email, // ← changed from to_email to email
      otp: otp,
    },
    {
      publicKey: EMAILJS_PUBLIC_KEY,
    },
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type Step = "verify" | "otp" | "password" | "done";

export default function ChangePassword() {
  const auth = getAuth();
  const user = auth.currentUser;

  const [step, setStep] = useState<Step>("verify");
  const [error, setError] = useState("");

  // ── Step 1 / 2 state ──────────────────────────────────────────────────────
  const [sending, setSending] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [verifying, setVerifying] = useState(false);

  // ── Step 3 state ──────────────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Password restriction checks ───────────────────────────────────────────
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

  // ─── Step 1: Send OTP to current email ────────────────────────────────────
  const handleSendOtp = async () => {
    if (!user?.email) {
      setError("No email address found for your account.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const otp = generateOtp();
      await sendOtpEmail(user.email, otp);
      setGeneratedOtp(otp);
      setStep("otp");
    } catch (err: any) {
      setError(
        err?.text ||
          err?.message ||
          "Failed to send verification code. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  // ─── Step 2: Verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = () => {
    setVerifying(true);
    setError("");

    setTimeout(() => {
      if (enteredOtp.trim() === generatedOtp) {
        setStep("password");
      } else {
        setError("Incorrect code. Please check your email and try again.");
      }
      setVerifying(false);
    }, 600);
  };

  // ─── Step 3: Update password ──────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!isPasswordValid || !user) return;

    setSaving(true);
    setError("");

    try {
      await updatePassword(user, newPassword);
      setStep("done");
    } catch (err: any) {
      if (err?.code === "auth/requires-recent-login") {
        setError(
          "Your session has expired. Please log out and log in again before changing your password.",
        );
      } else {
        setError(
          err?.message || "Failed to update password. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Step 1: Send verification email ──────────────────────────────────────
  if (step === "verify") {
    return (
      <View className="flex-1 justify-center px-6 bg-white">
        <Text className="text-3xl font-bold text-center mb-3">
          Change Password
        </Text>
        <Text className="text-gray-500 text-center text-sm mb-10">
          For your security, we'll first send a verification code to{"\n"}
          <Text className="text-indigo-500 font-semibold">
            {user?.email ?? "your email"}
          </Text>
        </Text>

        {error ? (
          <Text className="text-red-500 text-center text-sm mb-4">{error}</Text>
        ) : null}

        <Pressable
          onPress={handleSendOtp}
          disabled={sending}
          className={`p-4 rounded-xl mb-4 ${sending ? "bg-indigo-300" : "bg-indigo-500"}`}
        >
          {sending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-bold">
              Send Verification Code
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} disabled={sending}>
          <Text className="text-center text-gray-500">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Step 2: Enter OTP ────────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <View className="flex-1 justify-center px-6 bg-white">
        <Text className="text-6xl text-center mb-6">📩</Text>

        <Text className="text-3xl font-bold text-center mb-3">
          Enter the Code
        </Text>
        <Text className="text-gray-500 text-center text-sm mb-8">
          A 6-digit code was sent to{"\n"}
          <Text className="text-indigo-500 font-semibold">{user?.email}</Text>
          {"\n"}Please also check your spam folder.
        </Text>

        {error ? (
          <Text className="text-red-500 text-center text-sm mb-4">{error}</Text>
        ) : null}

        <TextInput
          placeholder="6-digit code"
          value={enteredOtp}
          onChangeText={(v) => setEnteredOtp(v.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          editable={!verifying}
          className="border p-4 rounded-xl border-gray-300 text-center text-xl tracking-widest mb-6"
        />

        <Pressable
          onPress={handleVerifyOtp}
          disabled={verifying || enteredOtp.length < 6}
          className={`p-4 rounded-xl mb-4 ${
            verifying || enteredOtp.length < 6 ? "bg-gray-300" : "bg-indigo-500"
          }`}
        >
          {verifying ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-bold">
              Verify Code
            </Text>
          )}
        </Pressable>

        {/* Resend */}
        <Pressable
          onPress={async () => {
            setEnteredOtp("");
            setError("");
            setSending(true);
            try {
              const otp = generateOtp();
              await sendOtpEmail(user?.email ?? "", otp);
              setGeneratedOtp(otp);
              Alert.alert(
                "Code Resent",
                "A new verification code has been sent.",
              );
            } catch (err: any) {
              setError(err?.text || err?.message || "Failed to resend code.");
            } finally {
              setSending(false);
            }
          }}
          disabled={sending}
        >
          <Text className="text-center text-gray-500 text-sm">
            Didn't receive it?{" "}
            <Text className="text-indigo-500 font-medium">Resend code</Text>
          </Text>
        </Pressable>
      </View>
    );
  }

  // ─── Step 3: New password form ────────────────────────────────────────────
  if (step === "password") {
    return (
      <View className="flex-1 justify-center px-6 bg-white">
        <Text className="text-3xl font-bold text-center mb-3">
          New Password
        </Text>
        <Text className="text-gray-500 text-center text-sm mb-8">
          Choose a strong new password for your account.
        </Text>

        {error ? (
          <Text className="text-red-500 text-center text-sm mb-4">{error}</Text>
        ) : null}

        {/* New password */}
        <TextInput
          placeholder="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          editable={!saving}
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

        {/* Confirm password */}
        <TextInput
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!saving}
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

        <Pressable
          onPress={handleChangePassword}
          disabled={saving || !isPasswordValid}
          className={`p-4 rounded-xl mb-4 ${
            saving
              ? "bg-indigo-300"
              : !isPasswordValid
                ? "bg-gray-300"
                : "bg-indigo-500"
          }`}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-bold">
              Update Password
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} disabled={saving}>
          <Text className="text-center text-gray-500">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Step 4: Success ──────────────────────────────────────────────────────
  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-6xl text-center mb-6">🔐</Text>

      <Text className="text-3xl font-bold text-center mb-3">
        Password Updated!
      </Text>
      <Text className="text-gray-500 text-center text-sm mb-10">
        Your password has been changed successfully.{"\n"}
        Use your new password the next time you log in.
      </Text>

      <Pressable
        onPress={() => router.replace("/settings")}
        className="bg-indigo-500 p-4 rounded-xl"
      >
        <Text className="text-white text-center font-bold">
          Back to Settings
        </Text>
      </Pressable>
    </View>
  );
}
