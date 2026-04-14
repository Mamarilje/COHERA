import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getAuth, updateEmail, verifyBeforeUpdateEmail } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TextInput as RNTextInput } from "react-native";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../src/Firebase/firebaseConfig";
import { supabase } from "../src/Supabase/supabaseConfig";
import { uploadProfilePhoto } from "../src/lib/supabaseStorage";

export default function Settings() {
  const router = useRouter();
  const auth = getAuth();
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userName, setUserName] = useState("");
  const [userTitle, setUserTitle] = useState("");
  useEffect(() => {
    if (!showEditModal) {
      setEditName(false);
    }
  }, [showEditModal]);
  const [userEmail, setUserEmail] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [tempName, setTempName] = useState("");
  const [tempTitle, setTempTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  const [isEmailChanging, setIsEmailChanging] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [reauthMethod, setReauthMethod] = useState<
    "password" | "email-otp" | null
  >(null);
  const [reauthValue, setReauthValue] = useState("");
  const [reauthError, setReauthError] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [editName, setEditName] = useState(false);
  const nameInputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setCurrentUser(firebaseUser);
    });
    const fetchUserData = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      try {
        setUserEmail(currentUser.email || "");
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists() && isMounted) {
          const userData = userDoc.data();
          setUserName(userData.name || userData.displayName || "");
          setUserTitle(userData.title || "");
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("photo_url, full_name")
          .eq("firebase_uid", currentUser.uid)
          .maybeSingle();
        if (error) {
          console.error("Supabase fetch error (settings):", error);
        }
        if (data) {
          if (data.full_name && !userName) {
            setUserName(data.full_name);
          }
          if (data.photo_url) {
            setProfileImage(data.photo_url + "?t=" + new Date().getTime());
          }
        }
      } catch (err) {
        console.error("Error loading profile (settings):", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchUserData();
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser]);

  const handleSaveProfile = useCallback(async () => {
    try {
      if (!currentUser) {
        Alert.alert("Error", "User not authenticated");
        return;
      }
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, {
        name: tempName,
        title: tempTitle,
      });
      const { error: supabaseError } = await supabase
        .from("profiles")
        .update({
          full_name: tempName,
          updated_at: new Date().toISOString(),
        })
        .eq("firebase_uid", currentUser.uid);
      if (supabaseError) {
        console.error("Supabase update error (settings):", supabaseError);
        throw new Error(`Failed to update profile: ${supabaseError.message}`);
      }
      setUserName(tempName);
      setUserTitle(tempTitle);
      if (!isEmailChanging && !isReauthenticating && !otpSent) {
        setShowEditModal(false);
        Alert.alert("Success", "Profile updated successfully!");
      } else {
        Alert.alert("Success", "Profile updated successfully!");
      }
    } catch (error) {
      console.error("Profile update error (settings):", error);
      const errMsg = (error as any)?.message || "Failed to update profile";
      Alert.alert("Update failed", errMsg);
    }
  }, [
    currentUser,
    tempName,
    tempTitle,
    setUserName,
    setUserTitle,
    setShowEditModal,
    isEmailChanging,
    isReauthenticating,
    otpSent,
  ]);

  const handleChangeProfilePicture = useCallback(async () => {
    try {
      if (!currentUser) {
        Alert.alert("Error", "User not authenticated");
        return;
      }
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission required",
          "Please allow access to your photo library",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) {
        return;
      }
      setIsUploading(true);
      const imageUri = result.assets[0].uri;
      const publicUrl = await uploadProfilePhoto(currentUser.uid, imageUri);
      const { data, error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            firebase_uid: currentUser.uid,
            photo_url: publicUrl,
            email: currentUser.email,
            full_name: userName || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "firebase_uid",
            ignoreDuplicates: false,
          },
        );
      if (upsertError) {
        console.error("Profile upsert error (settings):", upsertError);
        throw new Error(`Failed to update profile: ${upsertError.message}`);
      }
      const { data: verifyData, error: verifyError } = await supabase
        .from("profiles")
        .select("photo_url")
        .eq("firebase_uid", currentUser.uid)
        .single();
      if (verifyError) {
        console.error("Verification error (settings):", verifyError);
      } else {
        setProfileImage(
          (verifyData?.photo_url || publicUrl) + "?t=" + new Date().getTime(),
        );
      }
      Alert.alert("Success", "Profile photo updated successfully!");
    } catch (error) {
      console.error("Upload error (settings):", error);
      const errMsg = (error as any)?.message || "Failed to upload photo";
      Alert.alert("Upload failed", errMsg);
    } finally {
      setIsUploading(false);
    }
  }, [currentUser, userName, setProfileImage, setIsUploading]);

  const handleSendOtp = useCallback(async () => {
    setIsOtpLoading(true);
    setOtpError("");
    try {
      if (!currentUser) {
        Alert.alert("Error", "User not authenticated");
        setIsOtpLoading(false);
        return;
      }
      await verifyBeforeUpdateEmail(currentUser, tempEmail);
      setOtpSent(true);
      Alert.alert(
        "OTP Sent",
        "A verification link has been sent to your new email. Please check your inbox and click the link to verify.",
      );
    } catch (error) {
      console.error("OTP send error (settings):", error);
      setOtpError(
        (error as any)?.message || "Failed to send verification email",
      );
    } finally {
      setIsOtpLoading(false);
    }
  }, [currentUser, tempEmail]);

  const handleVerifyOtp = useCallback(async () => {
    setIsOtpLoading(true);
    setOtpError("");
    try {
      if (!currentUser) {
        Alert.alert("Error", "User not authenticated");
        setIsOtpLoading(false);
        return;
      }
      await updateEmail(currentUser, tempEmail);
      const userDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(userDocRef, { email: tempEmail });
      const { error: supabaseError } = await supabase
        .from("profiles")
        .update({
          email: tempEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("firebase_uid", currentUser.uid);
      if (supabaseError) {
        throw new Error(`Supabase update error: ${supabaseError.message}`);
      }
      setUserEmail(tempEmail);
      setOtpSent(false);
      setIsEmailChanging(false);
      setShowEditModal(false);
      Alert.alert("Success", "Email updated successfully!");
    } catch (error) {
      console.error("OTP verify error (settings):", error);
      setOtpError(
        (error as any)?.message ||
          "Failed to update email. Make sure you have clicked the verification link in your new email.",
      );
    } finally {
      setIsOtpLoading(false);
    }
  }, [currentUser, tempEmail, setUserEmail, setShowEditModal]);

  const handleCancelEditProfile = useCallback(() => {
    setShowEditModal(false);
  }, []);

  const EditProfileModal = useMemo(
    () => (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showEditModal}
        onRequestClose={handleCancelEditProfile}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center p-5 border-b border-gray-100">
              <TouchableOpacity
                onPress={handleCancelEditProfile}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Cancel Edit Profile"
              >
                <Text className="text-gray-500 text-base">Cancel</Text>
              </TouchableOpacity>
              <Text className="text-lg font-semibold text-gray-800">
                Edit Profile
              </Text>
              <TouchableOpacity
                onPress={handleSaveProfile}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Save Edit Profile"
              >
                <Text className="text-indigo-500 text-base font-semibold">
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5">
              {/* Profile Picture */}
              <View className="items-center mb-6">
                <View className="relative">
                  <View>
                    <Image
                      source={{ uri: profileImage }}
                      className="w-24 h-24 rounded-full"
                    />
                    {isUploading && (
                      <View className="absolute inset-0 bg-black/40 rounded-full items-center justify-center">
                        <ActivityIndicator size="large" color="white" />
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={handleChangeProfilePicture}
                      className="absolute bottom-0 right-0 bg-indigo-500 rounded-full p-2 border-2 border-white"
                      disabled={isUploading}
                    >
                      <Ionicons name="camera" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text className="text-indigo-500 text-sm mt-2 font-medium">
                  Change Photo
                </Text>
              </View>

              {/* Name Input with Pen Icon */}
              <View className="mb-4">
                <Text className="text-gray-700 text-sm font-medium mb-2">
                  Full Name
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TextInput
                    className="bg-gray-50 rounded-xl p-3 text-gray-800 border border-gray-200 flex-1"
                    value={tempName}
                    onChangeText={setTempName}
                    placeholder="Enter your name"
                    placeholderTextColor="#9CA3AF"
                    editable={editName}
                    ref={nameInputRef}
                    onBlur={() => setEditName(false)}
                    selectTextOnFocus={true}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setEditName(true);
                      setTimeout(() => nameInputRef.current?.focus(), 100);
                    }}
                    style={{ marginLeft: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Edit Full Name"
                  >
                    <Ionicons name="pencil" size={20} color="#6366F1" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Title Input */}
              <View className="mb-4">
                <Text className="text-gray-700 text-sm font-medium mb-2">
                  Title / Role
                </Text>
                <TextInput
                  className="bg-gray-50 rounded-xl p-3 text-gray-800 border border-gray-200"
                  value={tempTitle}
                  onChangeText={setTempTitle}
                  placeholder="Enter your title"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Email (Editable) */}
              <View className="mb-4">
                <Text className="text-gray-700 text-sm font-medium mb-2">
                  Email
                </Text>
                <TextInput
                  className="bg-gray-50 rounded-xl p-3 text-gray-800 border border-gray-200"
                  value={tempEmail}
                  onChangeText={setTempEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  editable={!isEmailChanging && !otpSent}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {!otpSent && tempEmail !== userEmail && (
                  <TouchableOpacity
                    className="mt-2 bg-indigo-500 rounded-lg py-2 px-4 items-center"
                    onPress={() => {
                      setIsEmailChanging(true);
                      setIsReauthenticating(true);
                    }}
                    disabled={isEmailChanging}
                  >
                    <Text className="text-white font-semibold">
                      Change Email
                    </Text>
                  </TouchableOpacity>
                )}
                {isEmailChanging && isReauthenticating && !otpSent && (
                  <View className="mt-2">
                    <Text className="text-gray-700 text-xs mb-2 font-semibold">
                      Verify your identity
                    </Text>
                    <Text className="text-gray-500 text-xs mb-2">
                      For security, please verify your identity before changing
                      your email.
                    </Text>
                    <View className="flex-row mb-2">
                      <TouchableOpacity
                        className={`flex-1 mr-1 py-2 rounded-lg items-center border ${reauthMethod === "password" ? "bg-indigo-500" : "bg-gray-100"}`}
                        onPress={() => {
                          setReauthMethod("password");
                          setReauthValue("");
                          setReauthError("");
                        }}
                      >
                        <Text
                          className={
                            reauthMethod === "password"
                              ? "text-white font-semibold"
                              : "text-gray-700"
                          }
                        >
                          Password
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className={`flex-1 ml-1 py-2 rounded-lg items-center border ${reauthMethod === "email-otp" ? "bg-indigo-500" : "bg-gray-100"}`}
                        onPress={() => {
                          setReauthMethod("email-otp");
                          setReauthValue("");
                          setReauthError("");
                        }}
                      >
                        <Text
                          className={
                            reauthMethod === "email-otp"
                              ? "text-white font-semibold"
                              : "text-gray-700"
                          }
                        >
                          Old Email OTP
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {reauthMethod === "password" && (
                      <TextInput
                        className="bg-gray-50 rounded-xl p-3 text-gray-800 border border-gray-200 mb-2"
                        value={reauthValue}
                        onChangeText={setReauthValue}
                        placeholder="Enter your password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry
                      />
                    )}
                    {reauthMethod === "email-otp" && (
                      <TextInput
                        className="bg-gray-50 rounded-xl p-3 text-gray-800 border border-gray-200 mb-2"
                        value={reauthValue}
                        onChangeText={setReauthValue}
                        placeholder="Enter OTP sent to your current email"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                      />
                    )}
                    {reauthError ? (
                      <Text className="text-red-500 text-xs mb-2">
                        {reauthError}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      className="bg-indigo-500 rounded-lg py-2 px-4 items-center"
                      onPress={async () => {
                        setReauthError("");
                        setReauthLoading(true);
                        try {
                          if (!currentUser)
                            throw new Error("User not authenticated");
                          if (!reauthMethod)
                            throw new Error("Select a verification method");
                          if (!reauthValue)
                            throw new Error("Enter your password or OTP");
                          if (reauthMethod === "password") {
                            const {
                              EmailAuthProvider,
                              reauthenticateWithCredential,
                            } = await import("firebase/auth");
                            const credential = EmailAuthProvider.credential(
                              currentUser.email || "",
                              reauthValue,
                            );
                            await reauthenticateWithCredential(
                              currentUser,
                              credential,
                            );
                          } else if (reauthMethod === "email-otp") {
                            if (reauthValue.length < 4)
                              throw new Error("Invalid OTP");
                          }
                          setIsReauthenticating(false);
                          setReauthLoading(false);
                          setReauthValue("");
                          setReauthMethod(null);
                        } catch (err) {
                          setReauthError(
                            (err as any)?.message || "Verification failed",
                          );
                          setReauthLoading(false);
                        }
                      }}
                      disabled={reauthLoading}
                    >
                      {reauthLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white font-semibold">Verify</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                {isEmailChanging && !isReauthenticating && !otpSent && (
                  <View className="mt-2">
                    <Text className="text-gray-500 text-xs mb-2">
                      A verification code will be sent to your new email. Enter
                      the code below to confirm.
                    </Text>
                    {otpError ? (
                      <Text className="text-red-500 text-xs mb-2">
                        {otpError}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      className="bg-indigo-500 rounded-lg py-2 px-4 items-center"
                      onPress={handleSendOtp}
                      disabled={isOtpLoading}
                    >
                      {isOtpLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white font-semibold">
                          Send OTP to New Email
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                {otpSent && (
                  <View className="mt-2">
                    <Text className="text-gray-500 text-xs mb-2">
                      After clicking the verification link in your new email,
                      tap below to complete the update.
                    </Text>
                    {otpError ? (
                      <Text className="text-red-500 text-xs mb-2">
                        {otpError}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      className="bg-indigo-500 rounded-lg py-2 px-4 items-center"
                      onPress={handleVerifyOtp}
                      disabled={isOtpLoading}
                    >
                      {isOtpLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white font-semibold">
                          Verify & Update Email
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Bio Input */}
              <View className="mb-6">
                <Text className="text-gray-700 text-sm font-medium mb-2">
                  Bio
                </Text>
                <TextInput
                  className="bg-gray-50 rounded-xl p-3 text-gray-800 border border-gray-200"
                  value="Product manager with 5+ years of experience in tech"
                  placeholder="Tell us about yourself"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    ),
    [
      showEditModal,
      tempName,
      tempTitle,
      profileImage,
      isUploading,
      handleSaveProfile,
      handleChangeProfilePicture,
      handleSendOtp,
      handleVerifyOtp,
      handleCancelEditProfile,
      reauthMethod,
      reauthValue,
      reauthError,
      reauthLoading,
      isEmailChanging,
      isReauthenticating,
      otpSent,
      otpError,
      isOtpLoading,
    ],
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#F5F7FA] items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F5F7FA]">
      {/* Header */}
      <View className="bg-white px-5 pt-12 pb-4 flex-row items-center border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.replace("/profile")}
          className="mr-4"
          accessibilityRole="button"
          accessibilityLabel="Go back to Profile"
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-gray-800">Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Profile Section */}
        <View className="px-5 mt-4">
          <TouchableOpacity
            onPress={() => {
              setTempName(userName);
              setTempEmail(userEmail);
              setTempTitle(userTitle);
              setEditName(false);
              setShowEditModal(true);
            }}
            className="bg-white rounded-xl p-4 flex-row items-center shadow-sm border border-gray-100 mb-4"
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                className="w-14 h-14 rounded-full mr-3"
              />
            ) : (
              <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mr-3">
                <Ionicons name="person-outline" size={32} color="#9CA3AF" />
              </View>
            )}
            <View className="flex-1">
              <Text className="font-semibold text-gray-800 text-base">
                {userName || "User"}
              </Text>
              <Text className="text-gray-500 text-sm">
                {userTitle || "No title"}
              </Text>
              <Text className="text-indigo-500 text-xs mt-1">Edit profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View className="px-5 mt-2">
          <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3 px-1">
            Preferences
          </Text>

          <View className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 mb-4">
            <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center">
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color="#4B7BEC"
                />
                <Text className="text-gray-700 ml-3">Notifications</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center">
                <Ionicons name="moon-outline" size={22} color="#4B7BEC" />
                <Text className="text-gray-700 ml-3">Dark Mode</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center">
                <Ionicons name="language-outline" size={22} color="#4B7BEC" />
                <Text className="text-gray-700 ml-3">Language</Text>
              </View>
              <View className="flex-row items-center">
                <Text className="text-gray-400 text-sm mr-2">English</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Section */}
        <View className="px-5 mt-2">
          <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3 px-1">
            Account
          </Text>

          <View className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 mb-4">
            {/* ── Change Password row (NEW) ── */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-b border-gray-100"
              onPress={() => router.push("/change-password")}
              accessibilityRole="button"
              accessibilityLabel="Change Password"
            >
              <View className="flex-row items-center">
                <Ionicons name="key-outline" size={22} color="#4B7BEC" />
                <Text className="text-gray-700 ml-3">Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center">
                <Ionicons
                  name="lock-closed-outline"
                  size={22}
                  color="#4B7BEC"
                />
                <Text className="text-gray-700 ml-3">Privacy & Security</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center">
                <Ionicons name="mail-outline" size={22} color="#4B7BEC" />
                <Text className="text-gray-700 ml-3">Email Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center">
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
                <Text className="text-red-500 ml-3">Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View className="px-5 mt-2 mb-8">
          <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 items-center">
            <Text className="text-gray-500 text-sm">Version 1.0.0</Text>
            <Text className="text-gray-400 text-xs mt-1">© 2024 TaskFlow</Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      {EditProfileModal}
    </View>
  );
}
