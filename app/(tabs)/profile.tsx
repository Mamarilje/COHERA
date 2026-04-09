import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getAuth, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../src/Firebase/firebaseConfig";
import { uploadProfilePhoto } from "../../src/lib/supabaseStorage";
import { supabase } from "../../src/Supabase/supabaseConfig";

export default function Profile() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user data from Firebase and Supabase
  useEffect(() => {
    let isMounted = true;

    const fetchUserData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setUserEmail(user.email || "");

        // Fetch user name from Firebase Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && isMounted) {
          const userData = userDoc.data();
          setUserName(userData.name || userData.displayName || "");
        }

        // Fetch profile from Supabase including photo_url
        const { data, error } = await supabase
          .from("profiles")
          .select("photo_url, full_name")
          .eq("firebase_uid", user.uid)
          .maybeSingle();

        if (error) {
          console.error("Supabase fetch error:", error);
        }

        if (data) {
          // Update name if available from Supabase
          if (data.full_name && !userName) {
            setUserName(data.full_name);
          }

          // Set photo URL with cache buster to prevent caching
          if (data.photo_url) {
            console.log("Found existing photo URL:", data.photo_url);
            setProfileImage(data.photo_url + "?t=" + new Date().getTime());
          } else {
            console.log("No photo URL found in profile");
          }
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handlePhotoUpload = async () => {
    try {
      if (!user) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      // Request permission
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission required",
          "Please allow access to your photo library",
        );
        return;
      }

      // Launch image picker
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

      // Get the selected image
      const imageUri = result.assets[0].uri;

      console.log("Uploading photo for user:", user.uid);
      console.log("Image URI:", imageUri);

      // Upload to Supabase Storage
      const publicUrl = await uploadProfilePhoto(user.uid, imageUri);

      console.log("Upload successful, public URL:", publicUrl);

      // Update Supabase profiles table with photo_url
      const { data, error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            firebase_uid: user.uid,
            photo_url: publicUrl,
            email: user.email,
            full_name: userName || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "firebase_uid",
            ignoreDuplicates: false,
          },
        );

      if (upsertError) {
        console.error("Profile upsert error:", upsertError);
        throw new Error(`Failed to update profile: ${upsertError.message}`);
      }

      console.log("Profile updated successfully:", data);

      // Verify the update by fetching it back
      const { data: verifyData, error: verifyError } = await supabase
        .from("profiles")
        .select("photo_url")
        .eq("firebase_uid", user.uid)
        .single();

      if (verifyError) {
        console.error("Verification error:", verifyError);
      } else {
        console.log("Verified photo URL in database:", verifyData?.photo_url);
      }

      // Update local state with cache buster
      setProfileImage(publicUrl + "?t=" + new Date().getTime());
      Alert.alert("Success", "Profile photo updated successfully!");
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Upload failed", error.message || "Failed to upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to sign out");
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#F5F7FA] items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F5F7FA]">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Profile Header Section */}
        <View
          style={{ backgroundColor: "#F5CF46" }}
          className="px-5 pt-12 pb-8 shadow-sm relative"
        >
          {/* Settings Icon */}
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 10,
              width: 35,
              height: 35,
              backgroundColor: "rgba(255,255,255,0.25)",
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.5)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            <Image
              source={require("../../assets/images/settings.png")}
              style={{ width: 22, height: 22 }}
            />
          </TouchableOpacity>
          <View className="items-center">
            {/* Profile Photo - Clickable */}
            <TouchableOpacity
              onPress={handlePhotoUpload}
              disabled={isUploading}
              className="relative mb-6"
            >
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  className="w-24 h-24 rounded-full border-4 border-indigo-100"
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-gray-100 border-4 border-indigo-100 items-center justify-center">
                  <Ionicons name="person-outline" size={48} color="#9CA3AF" />
                </View>
              )}

              {isUploading && (
                <View className="absolute inset-0 bg-black/40 rounded-full items-center justify-center">
                  <ActivityIndicator size="large" color="white" />
                </View>
              )}

              {/* Camera Icon Overlay */}
              <View className="absolute bottom-0 right-0 bg-indigo-500 rounded-full p-2 shadow-md">
                <Ionicons name="camera" size={16} color="white" />
              </View>
            </TouchableOpacity>

            {/* User Name */}
            <Text className="text-2xl font-bold text-gray-800 mb-1">
              {userName || "User"}
            </Text>

            {/* User Email */}
            <Text className="text-sm text-gray-500">
              {userEmail || "No email"}
            </Text>
          </View>
        </View>

        {/* Empty Space for Scrolling */}
        <View className="flex-1 py-10" />
        {/* Activity Stats Card */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 18,
            marginHorizontal: 16,
            marginTop: -32,
            marginBottom: 24,
            padding: 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "#222",
              marginBottom: 18,
            }}
          >
            Activity Stats
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <View
              style={{
                width: "48%",
                borderWidth: 2,
                borderColor: "#F5CF46",
                borderRadius: 12,
                paddingVertical: 18,
                marginBottom: 14,
                alignItems: "center",
                backgroundColor: "#fff",
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  color: "#D39B1B",
                  marginBottom: 2,
                }}
              >
                23
              </Text>
              <Text style={{ fontSize: 15, color: "#222" }}>Tasks</Text>
            </View>
            <View
              style={{
                width: "48%",
                borderWidth: 2,
                borderColor: "#F5CF46",
                borderRadius: 12,
                paddingVertical: 18,
                marginBottom: 14,
                alignItems: "center",
                backgroundColor: "#fff",
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  color: "#D39B1B",
                  marginBottom: 2,
                }}
              >
                15
              </Text>
              <Text style={{ fontSize: 15, color: "#222" }}>Groups</Text>
            </View>
            <View
              style={{
                width: "48%",
                borderWidth: 2,
                borderColor: "#F5CF46",
                borderRadius: 12,
                paddingVertical: 18,
                marginBottom: 0,
                alignItems: "center",
                backgroundColor: "#fff",
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  color: "#D39B1B",
                  marginBottom: 2,
                }}
              >
                156
              </Text>
              <Text style={{ fontSize: 15, color: "#222" }}>Points</Text>
            </View>
            <View
              style={{
                width: "48%",
                borderWidth: 2,
                borderColor: "#F5CF46",
                borderRadius: 12,
                paddingVertical: 18,
                marginBottom: 0,
                alignItems: "center",
                backgroundColor: "#fff",
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  color: "#D39B1B",
                  marginBottom: 2,
                }}
              >
                89%
              </Text>
              <Text style={{ fontSize: 15, color: "#222" }}>Complete</Text>
            </View>
          </View>
        </View>

        {/* Navigation Cards */}
        <View style={{ gap: 22, marginBottom: 32 }}>
          {/* My Groups */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#FAFAFA",
              borderRadius: 14,
              paddingVertical: 16,
              paddingHorizontal: 18,
              marginHorizontal: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#F3E5C8",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 16,
              }}
            >
              <Ionicons name="people" size={22} color="#222" />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 16,
                color: "#222",
                fontWeight: "bold",
              }}
            >
              My Groups
            </Text>
            <Ionicons name="chevron-forward" size={22} color="#222" />
          </View>
          {/* My Statistics */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#FAFAFA",
              borderRadius: 14,
              paddingVertical: 16,
              paddingHorizontal: 18,
              marginHorizontal: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#F3E5C8",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 16,
              }}
            >
              <Ionicons name="trending-up" size={22} color="#222" />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 16,
                color: "#222",
                fontWeight: "bold",
              }}
            >
              My Statistics
            </Text>
            <Ionicons name="chevron-forward" size={22} color="#222" />
          </View>
          {/* Achievements */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#FAFAFA",
              borderRadius: 14,
              paddingVertical: 16,
              paddingHorizontal: 18,
              marginHorizontal: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#F3E5C8",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 16,
              }}
            >
              <Ionicons name="ribbon-outline" size={22} color="#222" />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 16,
                color: "#222",
                fontWeight: "bold",
              }}
            >
              Achievements
            </Text>
            <Ionicons name="chevron-forward" size={22} color="#222" />
          </View>
        </View>
      </ScrollView>

      {/* Sign Out Button */}
      <View className="bg-white border-t border-gray-200 px-5 py-4">
        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-red-500 rounded-xl p-4 items-center justify-center"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="log-out-outline" size={20} color="white" />
            <Text className="text-white font-semibold">Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
