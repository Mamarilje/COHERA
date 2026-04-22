import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../src/Firebase/firebaseConfig';
import { notifyAdminJoinRequest } from '../src/utils/notificationHelper';

type Category = {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
};

const categories: Category[] = [
  {
    id: 'school',
    name: 'School',
    icon: '🎓',
    description: 'Academic Collaboration',
    color: '#3B82F6',
  },
  {
    id: 'family',
    name: 'Family',
    icon: '👨‍👩‍👧‍👦',
    description: 'Household Coordination',
    color: '#10B981',
  },
  {
    id: 'work',
    name: 'Work',
    icon: '💼',
    description: 'Productivity & Performance',
    color: '#F59E0B',
  },
];

export default function CreateGroup() {
  const router = useRouter();
  const auth = getAuth();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [customName, setCustomName] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successGroupName, setSuccessGroupName] = useState('');

  const generateGroupCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setShowNameModal(true);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    setIsCreating(true);
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      setIsCreating(false);
      return;
    }

    try {
      const groupCode = generateGroupCode();
      
      await addDoc(collection(db, 'groups'), {
        name: groupName.trim(),
        category: selectedCategory.name,
        code: groupCode,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp(),
        tasks: [],
        meetings: [],
        pendingMembers: [],
      });

      setSuccessGroupName(groupName);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setIsCreating(false);
      setShowNameModal(false);
      setGroupName('');
    }
  };

  const handleCustomCategory = async () => {
    if (!customCategory.trim()) {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }
    if (!customName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    setIsCreating(true);
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      setIsCreating(false);
      return;
    }

    try {
      const groupCode = generateGroupCode();
      
      await addDoc(collection(db, 'groups'), {
        name: customName.trim(),
        category: customCategory.trim(),
        code: groupCode,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp(),
        tasks: [],
        meetings: [],
        pendingMembers: [],
      });

      setSuccessGroupName(customName);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setIsCreating(false);
      setShowCustomModal(false);
      setCustomCategory('');
      setCustomName('');
    }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Error', 'Please enter a group code');
      return;
    }

    setIsJoining(true);
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      setIsJoining(false);
      return;
    }

    try {
      // Find group by code
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('code', '==', joinCode.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert('Error', 'Invalid group code');
        setIsJoining(false);
        return;
      }

      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();

      // Check if user is already a member
      if (groupData.members.includes(user.uid)) {
        Alert.alert('Info', 'You are already a member of this group');
        setShowJoinModal(false);
        setIsJoining(false);
        return;
      }

      // Check if there's already a pending request
      const existingRequestQuery = query(
        collection(db, 'joinRequests'),
        where('groupId', '==', groupDoc.id),
        where('userId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const existingRequests = await getDocs(existingRequestQuery);

      if (!existingRequests.empty) {
        Alert.alert('Info', 'You already have a pending request for this group');
        setShowJoinModal(false);
        setIsJoining(false);
        return;
      }

      // Add join request
      await addDoc(collection(db, 'joinRequests'), {
        groupId: groupDoc.id,
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0],
        userEmail: user.email,
        timestamp: serverTimestamp(),
        status: 'pending',
      });

      // Notify the group admin about the join request
      await notifyAdminJoinRequest(
        groupData.createdBy,
        user.displayName || user.email?.split('@')[0] || 'User',
        user.email || '',
        groupData.name,
        groupDoc.id,
        '', // joinRequestId would be the docRef.id, but we can pass empty for now
        user.uid
      );

      setShowJoinModal(false);
      setJoinCode('');
      setShowApprovalModal(true);
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert('Error', 'Failed to join group. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const CategoryCard = ({ category }: { category: Category }) => (
    <TouchableOpacity
      onPress={() => handleCategorySelect(category)}
      className="bg-white rounded-xl p-6 mb-4 shadow-sm border border-gray-100"
      activeOpacity={0.8}
    >
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center flex-1">
          <Text className="text-4xl mr-4">{category.icon}</Text>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-gray-800">{category.name}</Text>
            <Text className="text-gray-500 text-sm mt-1">{category.description}</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward" size={24} color="#F59E0B" />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="px-5 pt-10 pb-20">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-800">New Group</Text>
        </View>

        <Text className="text-gray-500 text-base mb-6">
          What type of group? Choose a category to get started.
        </Text>

        {/* Category Cards */}
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}

        {/* Custom Type Option */}
        <TouchableOpacity
          onPress={() => setShowCustomModal(true)}
          className="bg-white rounded-xl p-6 mb-4 shadow-sm border-2 border-dashed border-gray-300"
          activeOpacity={0.8}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center mr-4">
                <Ionicons name="add" size={24} color="#9CA3AF" />
              </View>
              <View>
                <Text className="text-lg font-semibold text-gray-800">Custom Type</Text>
                <Text className="text-gray-500 text-sm mt-1">Create your own category</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={24} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        {/* Join Group Option */}
        <TouchableOpacity
          onPress={() => setShowJoinModal(true)}
          className="bg-white rounded-xl p-6 mb-4 shadow-sm border-2 border-dashed border-yellow-300"
          activeOpacity={0.8}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <View className="w-12 h-12 bg-yellow-100 rounded-full items-center justify-center mr-4">
                <Ionicons name="log-in" size={24} color="#EAB308" />
              </View>
              <View>
                <Text className="text-lg font-semibold text-gray-800">Join Group</Text>
                <Text className="text-gray-500 text-sm mt-1">Enter group code to join</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={24} color="#EAB308" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Group Name Modal */}
      <Modal
        visible={showNameModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNameModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%]">
            <Text className="text-xl font-bold text-gray-800 mb-4">
              Create {selectedCategory?.name} Group
            </Text>
            <Text className="text-gray-500 mb-4">
              Enter a name for your new group
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl p-3 mb-6 text-base"
              placeholder="e.g., CS 101 Study Group"
              value={groupName}
              onChangeText={setGroupName}
              autoFocus
            />
            <View className="flex-row justify-end space-x-3">
              <TouchableOpacity
                onPress={() => {
                  setShowNameModal(false);
                  setGroupName('');
                }}
                className="px-4 py-2"
              >
                <Text className="text-gray-500">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateGroup}
                disabled={isCreating}
                className="bg-orange-500 px-6 py-2 rounded-xl"
              >
                {isCreating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold">Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Category Modal */}
      <Modal
        visible={showCustomModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%]">
            <Text className="text-xl font-bold text-gray-800 mb-4">Custom Group</Text>
            <Text className="text-gray-500 mb-2">Category Name</Text>
            <TextInput
              className="border border-gray-300 rounded-xl p-3 mb-4 text-base"
              placeholder="e.g., Hobby, Sports, Gaming, etc."
              value={customCategory}
              onChangeText={setCustomCategory}
            />
            <Text className="text-gray-500 mb-2">Group Name</Text>
            <TextInput
              className="border border-gray-300 rounded-xl p-3 mb-6 text-base"
              placeholder="Enter your group name"
              value={customName}
              onChangeText={setCustomName}
            />
            <View className="flex-row justify-end space-x-3">
              <TouchableOpacity
                onPress={() => {
                  setShowCustomModal(false);
                  setCustomCategory('');
                  setCustomName('');
                }}
                className="px-4 py-2"
              >
                <Text className="text-gray-500">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCustomCategory}
                disabled={isCreating}
                className="bg-orange-500 px-6 py-2 rounded-xl"
              >
                {isCreating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold">Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Group Modal */}
      <Modal
        visible={showJoinModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%]">
            <Text className="text-xl font-bold text-gray-800 mb-4">Join Group</Text>
            <Text className="text-gray-500 mb-4">
              Ask the group creator for the group code
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl p-3 mb-6 text-base"
              placeholder="Enter group code"
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              autoFocus
              maxLength={8}
            />
            <View className="flex-row justify-end space-x-3">
              <TouchableOpacity
                onPress={() => {
                  setShowJoinModal(false);
                  setJoinCode('');
                }}
                className="px-4 py-2"
              >
                <Text className="text-gray-500">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleJoinGroup}
                disabled={isJoining}
                className="bg-yellow-400 px-6 py-2 rounded-xl"
              >
                {isJoining ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold">Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Approval Waiting Modal */}
      <Modal
        visible={showApprovalModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowApprovalModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%] items-center">
            <View className="w-16 h-16 rounded-full bg-blue-100 items-center justify-center mb-4">
              <Ionicons name="hourglass-outline" size={32} color="#3B82F6" />
            </View>
            <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
              Waiting for Approval
            </Text>
            <Text className="text-gray-500 mb-6 text-center">
              Please wait for the group admin to accept your request to join the group.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowApprovalModal(false);
                router.back();
              }}
              className="bg-blue-500 px-8 py-3 rounded-xl w-full"
            >
              <Text className="text-white font-semibold text-center">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%] items-center">
            <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
              <Ionicons name="checkmark-circle" size={40} color="#10B981" />
            </View>
            <Text className="text-xl font-bold text-gray-800 mb-2 text-center">
              Success!
            </Text>
            <Text className="text-gray-600 mb-6 text-center text-base">
              You successfully created "{successGroupName}"
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
              className="bg-green-500 px-8 py-3 rounded-xl w-full"
            >
              <Text className="text-white font-semibold text-center">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}