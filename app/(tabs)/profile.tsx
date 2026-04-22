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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../src/Firebase/firebaseConfig";
import { supabase } from "../../src/Supabase/supabaseConfig";
import { uploadProfilePhoto } from "../../src/lib/supabaseStorage";

type TaskStats = {
  total: number;
  completed: number;
  inProgress: number;
  completionRate: number;
};

type GroupStats = {
  total: number;
};

export default function Profile() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  // Profile Data
  const [userName, setUserName] = useState("");
  const [userTitle, setUserTitle] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
  const fetchUserData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setUserEmail(user.email || "");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserName(userData.name || userData.displayName || "");
        setUserTitle(userData.title || "");
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
        if (data.full_name && !userName) {
          setUserName(data.full_name);
        }

        if (data.photo_url) {
          setProfileImage(data.photo_url + "?t=" + new Date().getTime());
        }
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  };

  // Fetch real task statistics
  const fetchTaskStats = async () => {
    if (!user) return;

    try {
      const groupsRef = collection(db, 'groups');
      const groupsQuery = query(groupsRef, where('members', 'array-contains', user.uid));
      const groupsSnapshot = await getDocs(groupsQuery);
      
      const userGroupIds: string[] = [];
      groupsSnapshot.forEach((doc) => {
        userGroupIds.push(doc.id);
      });
      
      if (userGroupIds.length === 0) {
        setTaskStats({
          total: 0,
          completed: 0,
          inProgress: 0,
          completionRate: 0,
        });
        return;
      }
      
      const tasksRef = collection(db, 'tasks');
      let total = 0;
      let completed = 0;
      let inProgress = 0;
      
      for (const groupId of userGroupIds) {
        const tasksQuery = query(tasksRef, where('groupId', '==', groupId));
        const tasksSnapshot = await getDocs(tasksQuery);
        
        total += tasksSnapshot.size;
        
        for (const doc of tasksSnapshot.docs) {
          const data = doc.data();
          if (data.completed) {
            completed++;
          }
          
          // Check for in-progress tasks
          let taskStatus = data.status || 'todo';
          try {
            const submissionsRef = collection(db, 'submissions');
            const submissionsQuery = query(submissionsRef, where('taskId', '==', doc.id));
            const submissionsSnapshot = await getDocs(submissionsQuery);
            
            const hasProgressSubmission = submissionsSnapshot.docs.some(
              (subDoc) => subDoc.data().status === 'Progress'
            );
            
            if (hasProgressSubmission) {
              taskStatus = 'in progress';
            }
          } catch (subError: any) {
            if (subError.code !== 'permission-denied') {
              console.error('Error checking submissions:', subError);
            }
          }
          
          if (taskStatus === 'in progress') {
            inProgress++;
          }
        }
      }
      
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      setTaskStats({ total, completed, inProgress, completionRate });
      
    } catch (error) {
      console.error('Error fetching task stats:', error);
    }
  };

  // Fetch real group statistics
  const fetchGroupStats = async () => {
    if (!user) return;

    try {
      const groupsRef = collection(db, 'groups');
      const groupsQuery = query(groupsRef, where('members', 'array-contains', user.uid));
      const groupsSnapshot = await getDocs(groupsQuery);
      
      setGroupStats({ total: groupsSnapshot.size });
      
    } catch (error) {
      console.error('Error fetching group stats:', error);
    }
  };

  const loadAllData = async () => {
    if (!user) return;
    
    await Promise.all([
      fetchUserData(),
      fetchTaskStats(),
      fetchGroupStats(),
    ]);
    setIsLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAllData();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadAllData();
      }
    }, [user])
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
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace("/login");
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to sign out");
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#EAB308" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
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
          <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
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
                  <Text className="text-2xl font-bold text-gray-800">{taskStats.total}</Text>
                  <Text className="text-sm text-gray-500">Tasks</Text>
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
                  <Text className="text-2xl font-bold text-gray-800">{groupStats.total}</Text>
                  <Text className="text-sm text-gray-500">Groups</Text>
                </View>
              </TouchableOpacity>

              {/* In Progress Stat */}
              <View className="flex-1 items-center">
                <View className="items-center">
                  <View className="bg-blue-50 rounded-full p-3 mb-2">
                    <Ionicons name="time-outline" size={24} color="#3B82F6" />
                  </View>
                  <Text className="text-2xl font-bold text-gray-800">{taskStats.inProgress}</Text>
                  <Text className="text-sm text-gray-500">In Progress</Text>
                </View>
              </View>

              {/* Completion Rate Stat */}
              <View className="flex-1 items-center">
                <View className="items-center">
                  <View className="bg-green-50 rounded-full p-3 mb-2">
                    <Ionicons name="checkmark-done-circle-outline" size={24} color="#10B981" />
                  </View>
                  <Text className="text-2xl font-bold text-gray-800">{taskStats.completionRate}%</Text>
                  <Text className="text-sm text-gray-500">Complete</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Account Section */}
        <View className="px-5 mt-6">
          <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3 px-1">
            Account
          </Text>

          <View className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 mb-4">
            {/* Edit Profile - Now first in Account section */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-b border-gray-100"
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
                <Text className="text-gray-700 ml-3">Edit Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Change Password */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-4 border-b border-gray-100"
              onPress={() => router.push("/change-password")}
            >
              <View className="flex-row items-center">
                <Ionicons name="key-outline" size={22} color="#4B7BEC" />
                <Text className="text-gray-700 ml-3">Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Privacy & Security */}
            <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center">
                <Ionicons name="lock-closed-outline" size={22} color="#4B7BEC" />
                <Text className="text-gray-700 ml-3">Privacy & Security</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Email Settings */}
            <TouchableOpacity 
              className="flex-row items-center justify-between p-4 border-b border-gray-100"
              onPress={() => {
                setTempEmail(userEmail);
                setIsEmailChanging(true);
                setIsReauthenticating(true);
                setShowEditModal(true);
              }}
            >
              <View className="flex-row items-center">
                <Ionicons name="mail-outline" size={22} color="#4B7BEC" />
                <Text className="text-gray-700 ml-3">Email Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Delete Account */}
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

      {/* Sign Out Button */}
      <View className="bg-white border-t border-gray-100 px-5 py-4">
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
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center p-5 border-b border-gray-100">
              <TouchableOpacity 
                onPress={() => {
                  setShowEditModal(false);
                  setIsEmailChanging(false);
                  setIsReauthenticating(false);
                  setOtpSent(false);
                }} 
                activeOpacity={0.7}
              >
                <Text className="text-gray-500 text-base">Cancel</Text>
              </TouchableOpacity>
              <Text className="text-lg font-semibold text-gray-800">Edit Profile</Text>
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
                <Text className="text-gray-700 text-sm font-medium mb-2">Full Name</Text>
                <View className="flex-row items-center">
                  <TextInput
                    className="bg-gray-50 rounded-xl p-3 text-gray-800 border border-gray-200 flex-1"
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
                <Text className="text-gray-700 text-sm font-medium mb-2">Title / Role</Text>
                <TextInput
                  className="bg-gray-50 rounded-xl p-3 text-gray-800 border border-gray-200"
                  value={tempTitle}
                  onChangeText={setTempTitle}
                  placeholder="Enter your title"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Email Section */}
              <View className="mb-4">
                <Text className="text-gray-700 text-sm font-medium mb-2">Email</Text>
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
                    <Text className="text-gray-700 text-xs mb-2 font-semibold">Verify your identity</Text>
                    <Text className="text-gray-500 text-xs mb-2">For security, please verify your identity before changing your email.</Text>
                    
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
                        className="bg-gray-50 rounded-xl p-3 text-gray-800 border border-gray-200 mb-2"
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