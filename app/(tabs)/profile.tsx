import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import { getAuth, signOut, updateEmail, verifyBeforeUpdateEmail } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TextInput as RNTextInput } from "react-native";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../src/Firebase/firebaseConfig";
import { supabase } from "../../src/Supabase/supabaseConfig";
import { uploadProfilePhoto } from "../../src/lib/supabaseStorage";
import { useAppTheme } from "../../src/theme/AppThemeContext";

type TaskStats = {
  total: number;
  completed: number;
  inProgress: number;
  completionRate: number;
};

type GroupStats = {
  total: number;
};

type UserProfileData = {
  userName: string;
  userTitle: string;
  userEmail: string;
  profileImage: string;
};

const FIRESTORE_IN_QUERY_LIMIT = 10;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

export default function Profile() {
  const router = useRouter();
  const auth = getAuth();
  const { isDark, toggleTheme, colors } = useAppTheme();
  const user = auth.currentUser;
  const hasLoadedOnceRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Profile Data
  const [userName, setUserName] = useState("");
  const [userTitle, setUserTitle] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Stats Data
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    completionRate: 0,
  });
  const [groupStats, setGroupStats] = useState<GroupStats>({
    total: 0,
  });

  // Edit Profile Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempTitle, setTempTitle] = useState("");
  const [tempEmail, setTempEmail] = useState("");
  const [editName, setEditName] = useState(false);
  const nameInputRef = useRef<RNTextInput>(null);

  // Email Change State
  const [isEmailChanging, setIsEmailChanging] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [reauthMethod, setReauthMethod] = useState<"password" | "email-otp" | null>(null);
  const [reauthValue, setReauthValue] = useState("");
  const [reauthError, setReauthError] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");

  useEffect(() => {
    if (!showEditModal) {
      setEditName(false);
    }
  }, [showEditModal]);

  // Fetch user data from Firebase and Supabase
  const fetchUserData = useCallback(async (): Promise<UserProfileData> => {
    if (!user) {
      return {
        userName: "",
        userTitle: "",
        userEmail: "",
        profileImage: "",
      };
    }

    try {
      let resolvedName = "";
      let resolvedTitle = "";
      let resolvedEmail = user.email || "";
      let resolvedProfileImage = "";

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        resolvedName = userData.name || userData.displayName || "";
        resolvedTitle = userData.title || "";
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("photo_url, full_name")
        .eq("firebase_uid", user.uid)
        .maybeSingle();

      if (error) {
        console.error("Supabase fetch error:", error);
      }

      if (data) {
        if (data.full_name && !resolvedName) {
          resolvedName = data.full_name;
        }

        if (data.photo_url) {
          resolvedProfileImage = data.photo_url + "?t=" + new Date().getTime();
        }
      }

      return {
        userName: resolvedName,
        userTitle: resolvedTitle,
        userEmail: resolvedEmail,
        profileImage: resolvedProfileImage,
      };
    } catch (err) {
      console.error("Error loading profile:", err);
      return {
        userName: "",
        userTitle: "",
        userEmail: user.email || "",
        profileImage: "",
      };
    }
  }, [user]);

  const fetchUserGroupIds = useCallback(async () => {
    if (!user) {
      return [];
    }

    try {
      const groupsRef = collection(db, 'groups');
      const groupsQuery = query(groupsRef, where('members', 'array-contains', user.uid));
      const groupsSnapshot = await getDocs(groupsQuery);

      return groupsSnapshot.docs.map((groupDoc) => groupDoc.id);
    } catch (error) {
      console.error('Error fetching user groups:', error);
      return [];
    }
  }, [user]);

  const fetchTaskStats = useCallback(async (userGroupIds: string[]): Promise<TaskStats> => {
    if (!user || userGroupIds.length === 0) {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        completionRate: 0,
      };
    }

    try {
      const tasksRef = collection(db, 'tasks');
      const taskSnapshots = await Promise.all(
        chunkArray(userGroupIds, FIRESTORE_IN_QUERY_LIMIT).map((groupIdChunk) =>
          getDocs(query(tasksRef, where('groupId', 'in', groupIdChunk)))
        )
      );

      const taskDocs = taskSnapshots.flatMap((snapshot) => snapshot.docs);
      const total = taskDocs.length;
      const completed = taskDocs.filter((taskDoc) => Boolean(taskDoc.data().completed)).length;
      const incompleteTaskIds = taskDocs
        .filter((taskDoc) => !taskDoc.data().completed)
        .map((taskDoc) => taskDoc.id);

      const progressTaskIds = new Set<string>();

      if (incompleteTaskIds.length > 0) {
        try {
          const submissionsRef = collection(db, 'submissions');
          const submissionSnapshots = await Promise.all(
            chunkArray(incompleteTaskIds, FIRESTORE_IN_QUERY_LIMIT).map((taskIdChunk) =>
              getDocs(query(submissionsRef, where('taskId', 'in', taskIdChunk)))
            )
          );

          submissionSnapshots.forEach((snapshot) => {
            snapshot.docs.forEach((submissionDoc) => {
              const submission = submissionDoc.data();

              if (submission.status === 'Progress' && submission.taskId) {
                progressTaskIds.add(submission.taskId);
              }
            });
          });
        } catch (subError: any) {
          if (subError.code !== 'permission-denied') {
            console.error('Error checking submissions:', subError);
          }
        }
      }

      const inProgress = taskDocs.filter((taskDoc) => progressTaskIds.has(taskDoc.id)).length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return { total, completed, inProgress, completionRate };
    } catch (error) {
      console.error('Error fetching task stats:', error);
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        completionRate: 0,
      };
    }
  }, [user]);

  const loadAllData = useCallback(async ({ showSpinner = true } = {}) => {
    if (isLoadingRef.current) {
      return;
    }

    if (!user) {
      setUserName("");
      setUserTitle("");
      setUserEmail("");
      setProfileImage("");
      setTaskStats({
        total: 0,
        completed: 0,
        inProgress: 0,
        completionRate: 0,
      });
      setGroupStats({ total: 0 });
      setIsLoading(false);
      setRefreshing(false);
      hasLoadedOnceRef.current = false;
      return;
    }

    try {
      isLoadingRef.current = true;
      if (showSpinner) {
        setIsLoading(true);
      }

      const [profileData, userGroupIds] = await Promise.all([
        fetchUserData(),
        fetchUserGroupIds(),
      ]);
      const resolvedTaskStats = await fetchTaskStats(userGroupIds);

      setUserName(profileData.userName);
      setUserTitle(profileData.userTitle);
      setUserEmail(profileData.userEmail);
      setProfileImage(profileData.profileImage);
      setTaskStats(resolvedTaskStats);
      setGroupStats({ total: userGroupIds.length });
      hasLoadedOnceRef.current = true;
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  }, [fetchTaskStats, fetchUserData, fetchUserGroupIds, user]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      if (user && hasLoadedOnceRef.current) {
        loadAllData({ showSpinner: false });
      }
    }, [loadAllData, user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
  };

  const handlePhotoUpload = async () => {
    try {
      if (!user) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission required", "Please allow access to your photo library");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      setIsUploading(true);
      const imageUri = result.assets[0].uri;
      const publicUrl = await uploadProfilePhoto(user.uid, imageUri);

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            firebase_uid: user.uid,
            photo_url: publicUrl,
            email: user.email,
            full_name: userName || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "firebase_uid", ignoreDuplicates: false }
        );

      if (upsertError) throw new Error(`Failed to update profile: ${upsertError.message}`);

      setProfileImage(publicUrl + "?t=" + new Date().getTime());
      Alert.alert("Success", "Profile photo updated successfully!");
    } catch (error: any) {
      Alert.alert("Upload failed", error.message || "Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = useCallback(async () => {
    try {
      if (!user) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      const userDocRef = doc(db, "users", user.uid);
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
        .eq("firebase_uid", user.uid);

      if (supabaseError) throw new Error(`Failed to update profile: ${supabaseError.message}`);

      setUserName(tempName);
      setUserTitle(tempTitle);

      if (!isEmailChanging && !isReauthenticating && !otpSent) {
        setShowEditModal(false);
        Alert.alert("Success", "Profile updated successfully!");
      }
    } catch (error: any) {
      Alert.alert("Update failed", error.message || "Failed to update profile");
    }
  }, [user, tempName, tempTitle, isEmailChanging, isReauthenticating, otpSent]);

  const handleSendOtp = useCallback(async () => {
    setIsOtpLoading(true);
    setOtpError("");
    try {
      if (!user) throw new Error("User not authenticated");
      await verifyBeforeUpdateEmail(user, tempEmail);
      setOtpSent(true);
      Alert.alert("OTP Sent", "A verification link has been sent to your new email.");
    } catch (error: any) {
      setOtpError(error?.message || "Failed to send verification email");
    } finally {
      setIsOtpLoading(false);
    }
  }, [user, tempEmail]);

  const handleVerifyOtp = useCallback(async () => {
    setIsOtpLoading(true);
    setOtpError("");
    try {
      if (!user) throw new Error("User not authenticated");
      await updateEmail(user, tempEmail);
      
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { email: tempEmail });
      
      const { error: supabaseError } = await supabase
        .from("profiles")
        .update({ email: tempEmail, updated_at: new Date().toISOString() })
        .eq("firebase_uid", user.uid);
      
      if (supabaseError) throw new Error(`Supabase update error: ${supabaseError.message}`);
      
      setUserEmail(tempEmail);
      setOtpSent(false);
      setIsEmailChanging(false);
      setShowEditModal(false);
      Alert.alert("Success", "Email updated successfully!");
    } catch (error: any) {
      setOtpError(error?.message || "Failed to update email");
    } finally {
      setIsOtpLoading(false);
    }
  }, [user, tempEmail]);

  const handleSignOut = async () => {
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    try {
      setIsSigningOut(true);
      await signOut(auth);
      setShowSignOutModal(false);
      router.replace("/login");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to sign out");
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#EAB308" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        style={{ backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EAB308']} />
        }
      >
        {/* Profile Header Section - Yellow Theme */}
        <View className="bg-yellow-400 px-5 pt-12 pb-8">
          <View className="items-center">
            {/* Profile Photo - Clickable */}
            <TouchableOpacity onPress={handlePhotoUpload} disabled={isUploading} className="relative mb-4">
              {profileImage ? (
                <Image source={{ uri: profileImage }} className="w-24 h-24 rounded-full border-4 border-white" />
              ) : (
                <View className="w-24 h-24 rounded-full bg-yellow-300 border-4 border-white items-center justify-center">
                  <Ionicons name="person-outline" size={48} color="white" />
                </View>
              )}

              {isUploading && (
                <View className="absolute inset-0 bg-black/40 rounded-full items-center justify-center">
                  <ActivityIndicator size="large" color="white" />
                </View>
              )}

              {/* Camera Icon Overlay */}
              <View className="absolute bottom-0 right-0 bg-yellow-600 rounded-full p-2 shadow-md">
                <Ionicons name="camera" size={16} color="white" />
              </View>
            </TouchableOpacity>

            {/* User Name */}
            <Text className="text-2xl font-bold text-white mb-1">{userName || "User"}</Text>
            
            {/* User Email */}
            <Text className="text-sm text-yellow-100">{userEmail || "No email"}</Text>
          </View>
        </View>

        {/* Stats Card - Below the yellow header (not overlapped) */}
        <View className="px-5 pt-6 pb-2">
          <View
            className="rounded-2xl p-5 shadow-sm border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <View className="flex-row justify-between">
              {/* Tasks Stat */}
              <TouchableOpacity 
                onPress={() => router.push('/(tabs)/task')}
                className="flex-1 items-center"
                activeOpacity={0.8}
              >
                <View className="items-center">
                  <View className="bg-yellow-50 rounded-full p-3 mb-2">
                    <Ionicons name="checkbox-outline" size={24} color="#EAB308" />
                  </View>
                  <Text className="text-2xl font-bold" style={{ color: colors.text }}>{taskStats.total}</Text>
                  <Text className="text-sm" style={{ color: colors.textMuted }}>Tasks</Text>
                </View>
              </TouchableOpacity>

              {/* Groups Stat */}
              <TouchableOpacity 
                onPress={() => router.push('/all-groups')}
                className="flex-1 items-center"
                activeOpacity={0.8}
              >
                <View className="items-center">
                  <View className="bg-yellow-50 rounded-full p-3 mb-2">
                    <Ionicons name="people-outline" size={24} color="#EAB308" />
                  </View>
                  <Text className="text-2xl font-bold" style={{ color: colors.text }}>{groupStats.total}</Text>
                  <Text className="text-sm" style={{ color: colors.textMuted }}>Groups</Text>
                </View>
              </TouchableOpacity>

              {/* In Progress Stat */}
              <View className="flex-1 items-center">
                <View className="items-center">
                  <View className="bg-blue-50 rounded-full p-3 mb-2">
                    <Ionicons name="time-outline" size={24} color="#3B82F6" />
                  </View>
                  <Text className="text-2xl font-bold" style={{ color: colors.text }}>{taskStats.inProgress}</Text>
                  <Text className="text-sm" style={{ color: colors.textMuted }}>In Progress</Text>
                </View>
              </View>

              {/* Completion Rate Stat */}
              <View className="flex-1 items-center">
                <View className="items-center">
                  <View className="bg-green-50 rounded-full p-3 mb-2">
                    <Ionicons name="checkmark-done-circle-outline" size={24} color="#10B981" />
                  </View>
                  <Text className="text-2xl font-bold" style={{ color: colors.text }}>{taskStats.completionRate}%</Text>
                  <Text className="text-sm" style={{ color: colors.textMuted }}>Complete</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View className="px-5 mt-6">
          <Text className="text-xs font-semibold uppercase tracking-wide mb-3 px-1" style={{ color: colors.textSoft }}>
            Account
          </Text>

          <View className="rounded-xl overflow-hidden shadow-sm border mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {/* Edit Profile - Now first in Account section */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-b"
              style={{ borderBottomColor: colors.border }}
              onPress={() => {
                setTempName(userName);
                setTempEmail(userEmail);
                setTempTitle(userTitle);
                setEditName(false);
                setShowEditModal(true);
              }}
            >
              <View className="flex-row items-center">
                <Ionicons name="create-outline" size={22} color="#EAB308" />
                <Text className="ml-3" style={{ color: colors.text }}>Edit Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSoft} />
            </TouchableOpacity>

            {/* Change Password */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-b"
              style={{ borderBottomColor: colors.border }}
              onPress={() => router.push("/change-password")}
            >
              <View className="flex-row items-center">
                <Ionicons name="key-outline" size={22} color="#4B7BEC" />
                <Text className="ml-3" style={{ color: colors.text }}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSoft} />
            </TouchableOpacity>

            <View className="flex-row items-center justify-between p-4 border-b" style={{ borderBottomColor: colors.border }}>
              <View className="flex-row items-center flex-1 mr-4">
                <Ionicons name={isDark ? "moon" : "moon-outline"} size={22} color="#4B7BEC" />
                <View className="ml-3 flex-1">
                  <Text style={{ color: colors.text }}>Dark Mode</Text>
                  <Text className="text-xs" style={{ color: colors.textSoft }}>
                    Switch between light and dark color schemes
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: "#D1D5DB", true: "#60A5FA" }}
                thumbColor={isDark ? "#DBEAFE" : "#FFFFFF"}
              />
            </View>

            {/* Delete Account */}
            <TouchableOpacity className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center">
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
                <Text className="text-red-500 ml-3">Delete Account</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSoft} />
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View className="px-5 mt-2 mb-8">
          <View className="rounded-xl p-4 shadow-sm border items-center" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <Text className="text-sm" style={{ color: colors.textMuted }}>Version 1.0.0</Text>
            <Text className="text-gray-400 text-xs mt-1">© 2026 Cohera</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sign Out Button */}
      <View className="border-t px-5 py-4" style={{ backgroundColor: colors.surface, borderTopColor: colors.border }}>
        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-red-500 rounded-xl p-4 items-center justify-center shadow-sm"
          activeOpacity={0.8}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="log-out-outline" size={20} color="white" />
            <Text className="text-white font-semibold text-base">Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showSignOutModal}
        onRequestClose={() => {
          if (!isSigningOut) {
            setShowSignOutModal(false);
          }
        }}
      >
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: colors.overlay }}>
          <View className="w-full max-w-sm rounded-3xl p-6 shadow-lg" style={{ backgroundColor: colors.surface }}>
            <View className="items-center mb-5">
              <View className="rounded-full p-4 mb-4" style={{ backgroundColor: isDark ? colors.dangerSoft : '#FEE2E2' }}>
                <Ionicons name="log-out-outline" size={28} color="#EF4444" />
              </View>
              <Text className="text-xl font-bold mb-2" style={{ color: colors.text }}>Confirm Sign Out</Text>
              <Text className="text-center" style={{ color: colors.textMuted }}>
                Do you want to sign out and go back to the login screen?
              </Text>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowSignOutModal(false)}
                disabled={isSigningOut}
                className="flex-1 rounded-2xl border py-3 items-center"
                style={{ borderColor: colors.border }}
                activeOpacity={0.8}
              >
                <Text className="font-semibold" style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmSignOut}
                disabled={isSigningOut}
                className={`flex-1 rounded-2xl py-3 items-center ${
                  isSigningOut ? "bg-red-300" : "bg-red-500"
                }`}
                activeOpacity={0.8}
              >
                {isSigningOut ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="font-semibold text-white">Yes, Sign Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showEditModal}
        onRequestClose={() => {
          setShowEditModal(false);
          setIsEmailChanging(false);
          setIsReauthenticating(false);
          setOtpSent(false);
        }}
      >
        <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
          <View className="rounded-t-3xl" style={{ backgroundColor: colors.surface }}>
            {/* Modal Header */}
            <View className="flex-row justify-between items-center p-5 border-b" style={{ borderBottomColor: colors.border }}>
              <TouchableOpacity 
                onPress={() => {
                  setShowEditModal(false);
                  setIsEmailChanging(false);
                  setIsReauthenticating(false);
                  setOtpSent(false);
                }} 
                activeOpacity={0.7}
              >
                <Text className="text-base" style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <Text className="text-lg font-semibold" style={{ color: colors.text }}>Edit Profile</Text>
              <TouchableOpacity onPress={handleSaveProfile} activeOpacity={0.7}>
                <Text className="text-yellow-500 text-base font-semibold">Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5">
              {/* Profile Picture */}
              <View className="items-center mb-6">
                <View className="relative">
                  <Image
                    source={{ uri: profileImage || "https://via.placeholder.com/96" }}
                    className="w-24 h-24 rounded-full"
                  />
                  {isUploading && (
                    <View className="absolute inset-0 bg-black/40 rounded-full items-center justify-center">
                      <ActivityIndicator size="large" color="white" />
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={handlePhotoUpload}
                    className="absolute bottom-0 right-0 bg-yellow-500 rounded-full p-2 border-2 border-white"
                    disabled={isUploading}
                  >
                    <Ionicons name="camera" size={16} color="white" />
                  </TouchableOpacity>
                </View>
                <Text className="text-yellow-500 text-sm mt-2 font-medium">Change Photo</Text>
              </View>

              {/* Name Input */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text }}>Full Name</Text>
                <View className="flex-row items-center">
                  <TextInput
                    className="rounded-xl p-3 border flex-1"
                    style={{ backgroundColor: colors.surfaceMuted, color: colors.text, borderColor: colors.border }}
                    value={tempName}
                    onChangeText={setTempName}
                    placeholder="Enter your name"
                    placeholderTextColor="#9CA3AF"
                    editable={editName}
                    ref={nameInputRef}
                    onBlur={() => setEditName(false)}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setEditName(true);
                      setTimeout(() => nameInputRef.current?.focus(), 100);
                    }}
                    className="ml-2"
                  >
                    <Ionicons name="pencil" size={20} color="#EAB308" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Title Input */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text }}>Title / Role</Text>
                <TextInput
                  className="rounded-xl p-3 border"
                  style={{ backgroundColor: colors.surfaceMuted, color: colors.text, borderColor: colors.border }}
                  value={tempTitle}
                  onChangeText={setTempTitle}
                  placeholder="Enter your title"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Email Section */}
              <View className="mb-4">
                <Text className="text-sm font-medium mb-2" style={{ color: colors.text }}>Email</Text>
                <TextInput
                  className="rounded-xl p-3 border"
                  style={{ backgroundColor: colors.surfaceMuted, color: colors.text, borderColor: colors.border }}
                  value={tempEmail}
                  onChangeText={setTempEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  editable={!isEmailChanging && !otpSent}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                
                {!otpSent && tempEmail !== userEmail && !isEmailChanging && (
                  <TouchableOpacity
                    className="mt-2 bg-yellow-500 rounded-lg py-2 px-4 items-center"
                    onPress={() => {
                      setIsEmailChanging(true);
                      setIsReauthenticating(true);
                    }}
                  >
                    <Text className="text-white font-semibold">Change Email</Text>
                  </TouchableOpacity>
                )}

                {/* Re-authentication Section */}
                {isEmailChanging && isReauthenticating && !otpSent && (
                  <View className="mt-2">
                    <Text className="text-xs mb-2 font-semibold" style={{ color: colors.text }}>Verify your identity</Text>
                    <Text className="text-xs mb-2" style={{ color: colors.textMuted }}>For security, please verify your identity before changing your email.</Text>
                    
                    <View className="flex-row mb-2">
                      <TouchableOpacity
                        className={`flex-1 mr-1 py-2 rounded-lg items-center border ${reauthMethod === "password" ? "bg-yellow-500" : "bg-gray-100"}`}
                        onPress={() => {
                          setReauthMethod("password");
                          setReauthValue("");
                          setReauthError("");
                        }}
                      >
                        <Text className={reauthMethod === "password" ? "text-white font-semibold" : "text-gray-700"}>Password</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className={`flex-1 ml-1 py-2 rounded-lg items-center border ${reauthMethod === "email-otp" ? "bg-yellow-500" : "bg-gray-100"}`}
                        onPress={() => {
                          setReauthMethod("email-otp");
                          setReauthValue("");
                          setReauthError("");
                        }}
                      >
                        <Text className={reauthMethod === "email-otp" ? "text-white font-semibold" : "text-gray-700"}>Old Email OTP</Text>
                      </TouchableOpacity>
                    </View>

                    {reauthMethod === "password" && (
                      <TextInput
                        className="rounded-xl p-3 border mb-2"
                        style={{ backgroundColor: colors.surfaceMuted, color: colors.text, borderColor: colors.border }}
                        value={reauthValue}
                        onChangeText={setReauthValue}
                        placeholder="Enter your password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry
                      />
                    )}

                    {reauthError && <Text className="text-red-500 text-xs mb-2">{reauthError}</Text>}

                    <TouchableOpacity
                      className="bg-yellow-500 rounded-lg py-2 px-4 items-center"
                      onPress={async () => {
                        setReauthError("");
                        setReauthLoading(true);
                        try {
                          if (!user) throw new Error("User not authenticated");
                          if (!reauthMethod) throw new Error("Select a verification method");
                          if (!reauthValue) throw new Error("Enter your password or OTP");
                          
                          if (reauthMethod === "password") {
                            const { EmailAuthProvider, reauthenticateWithCredential } = await import("firebase/auth");
                            const credential = EmailAuthProvider.credential(user.email || "", reauthValue);
                            await reauthenticateWithCredential(user, credential);
                          }
                          
                          setIsReauthenticating(false);
                          setReauthLoading(false);
                          setReauthValue("");
                          setReauthMethod(null);
                        } catch (err: any) {
                          setReauthError(err?.message || "Verification failed");
                          setReauthLoading(false);
                        }
                      }}
                      disabled={reauthLoading}
                    >
                      {reauthLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Verify</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {/* OTP Section */}
                {!isReauthenticating && isEmailChanging && !otpSent && (
                  <View className="mt-2">
                    <Text className="text-gray-500 text-xs mb-2">A verification code will be sent to your new email.</Text>
                    {otpError && <Text className="text-red-500 text-xs mb-2">{otpError}</Text>}
                    <TouchableOpacity
                      className="bg-yellow-500 rounded-lg py-2 px-4 items-center"
                      onPress={handleSendOtp}
                      disabled={isOtpLoading}
                    >
                      {isOtpLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Send OTP to New Email</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Verify OTP Section */}
                {otpSent && (
                  <View className="mt-2">
                    <Text className="text-gray-500 text-xs mb-2">After clicking the verification link in your new email, tap below to complete the update.</Text>
                    {otpError && <Text className="text-red-500 text-xs mb-2">{otpError}</Text>}
                    <TouchableOpacity
                      className="bg-yellow-500 rounded-lg py-2 px-4 items-center"
                      onPress={handleVerifyOtp}
                      disabled={isOtpLoading}
                    >
                      {isOtpLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Verify & Update Email</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
