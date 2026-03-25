import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useRouter } from "expo-router";

export default function Settings() {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [userName, setUserName] = useState("Mark Oprecio");
  const [userTitle, setUserTitle] = useState("Project Manager");
  const [profileImage, setProfileImage] = useState("https://i.pravatar.cc/150?img=7");
  const [tempName, setTempName] = useState(userName);
  const [tempTitle, setTempTitle] = useState(userTitle);

  const handleSaveProfile = () => {
    setUserName(tempName);
    setUserTitle(tempTitle);
    setShowEditModal(false);
    Alert.alert("Success", "Profile updated successfully!");
  };

  const handleChangeProfilePicture = () => {
    Alert.alert("Change Photo", "This would open image picker to select a new profile picture");
  };

  // Edit Profile Modal Component
  const EditProfileModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showEditModal}
      onRequestClose={() => setShowEditModal(false)}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl">
          {/* Modal Header */}
          <View className="flex-row justify-between items-center p-5 border-b border-gray-100">
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text className="text-gray-500 text-base">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-gray-800">Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile}>
              <Text className="text-indigo-500 text-base font-semibold">Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="p-5">
            {/* Profile Picture */}
            <View className="items-center mb-6">
              <View className="relative">
                <Image source={{ uri: profileImage }} className="w-24 h-24 rounded-full" />
                <TouchableOpacity 
                  onPress={handleChangeProfilePicture}
                  className="absolute bottom-0 right-0 bg-indigo-500 rounded-full p-2 border-2 border-white"
                >
                  <Ionicons name="camera" size={16} color="white" />
                </TouchableOpacity>
              </View>
              <Text className="text-indigo-500 text-sm mt-2 font-medium">Change Photo</Text>
            </View>

            {/* Name Input */}
            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-medium mb-2">Full Name</Text>
              <TextInput
                className="bg-gray-50 rounded-xl p-3 text-gray-800 border border-gray-200"
                value={tempName}
                onChangeText={setTempName}
                placeholder="Enter your name"
                placeholderTextColor="#9CA3AF"
              />
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

            {/* Email (Read Only) */}
            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-medium mb-2">Email</Text>
              <View className="bg-gray-100 rounded-xl p-3">
                <Text className="text-gray-500">mark.oprecio@example.com</Text>
              </View>
            </View>

            {/* Bio Input */}
            <View className="mb-6">
              <Text className="text-gray-700 text-sm font-medium mb-2">Bio</Text>
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
  );

  return (
    <View className="flex-1 bg-[#F5F7FA]">
      {/* Header */}
      <View className="bg-white px-5 pt-12 pb-4 flex-row items-center border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-gray-800">Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Profile Section */}
        <View className="px-5 mt-4">
          <TouchableOpacity 
            onPress={() => setShowEditModal(true)}
            className="bg-white rounded-xl p-4 flex-row items-center shadow-sm border border-gray-100 mb-4"
          >
            <Image source={{ uri: profileImage }} className="w-14 h-14 rounded-full mr-3" />
            <View className="flex-1">
              <Text className="font-semibold text-gray-800 text-base">{userName}</Text>
              <Text className="text-gray-500 text-sm">{userTitle}</Text>
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
                <Ionicons name="notifications-outline" size={22} color="#4B7BEC" />
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
            <TouchableOpacity className="flex-row items-center justify-between p-4 border-b border-gray-100">
              <View className="flex-row items-center">
                <Ionicons name="lock-closed-outline" size={22} color="#4B7BEC" />
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
      <EditProfileModal />
    </View>
  );
}