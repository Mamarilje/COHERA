import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getAuth } from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../src/Firebase/firebaseConfig';

type Group = {
  id: string;
  name: string;
  category: string;
  code: string;
  createdBy: string;
  members: string[];
  tasks?: any[];
  meetings?: any[];
};

type Member = {
  uid: string;
  name: string;
  email: string;
  profileImage?: string;
};

type JoinRequest = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  timestamp: any;
};

export default function GroupDetails() {
  const router = useRouter();
  const { groupId, groupName } = useLocalSearchParams();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [activeTab, setActiveTab] = useState<'project' | 'meetings' | 'members'>('project');

  const fetchGroupDetails = async () => {
    if (!groupId) return;

    try {
      const groupDoc = await getDoc(doc(db, 'groups', groupId as string));
      if (groupDoc.exists()) {
        const groupData = { id: groupDoc.id, ...groupDoc.data() } as Group;
        setGroup(groupData);

        // Fetch members details
        const membersData: Member[] = [];
        for (const memberId of groupData.members) {
          try {
            const userDoc = await getDoc(doc(db, 'users', memberId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              membersData.push({
                uid: memberId,
                name: userData.name || userData.displayName || memberId,
                email: userData.email || '',
                profileImage: userData.profileImage || userData.photoURL || undefined,
              });
            } else {
              // If user document doesn't exist, add basic info
              membersData.push({
                uid: memberId,
                name: memberId,
                email: '',
              });
            }
          } catch (error) {
            // Handle permission errors - use basic info
            membersData.push({
              uid: memberId,
              name: memberId,
              email: '',
            });
          }
        }
        setMembers(membersData);

        // Fetch pending join requests
        const requestsRef = collection(db, 'joinRequests');
        const q = query(
          requestsRef,
          where('groupId', '==', groupId)
        );
        const requestsSnapshot = await getDocs(q);
        const requests: JoinRequest[] = [];
        requestsSnapshot.forEach((doc) => {
          const data = doc.data();
          // Filter by pending status in code
          if (data.status === 'pending') {
            requests.push({
              id: doc.id,
              userId: data.userId,
              userName: data.userName,
              userEmail: data.userEmail,
              timestamp: data.timestamp,
            });
          }
        });
        setJoinRequests(requests);
      } else {
        Alert.alert('Error', 'Group not found');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching group:', error);
      Alert.alert('Error', 'Failed to load group details');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchGroupDetails();
  }, [groupId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroupDetails();
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Error', 'Please enter a group code');
      return;
    }

    setIsLoading(true);
    try {
      // Find group by code
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('code', '==', joinCode.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert('Error', 'Invalid group code');
        setIsLoading(false);
        return;
      }

      const groupDoc = querySnapshot.docs[0];
      const groupData = groupDoc.data();

      // Check if user is already a member
      if (groupData.members.includes(currentUser?.uid)) {
        Alert.alert('Info', 'You are already a member of this group');
        setShowJoinModal(false);
        setIsLoading(false);
        return;
      }

      // Check if there's already a pending request
      const existingRequestQuery = query(
        collection(db, 'joinRequests'),
        where('groupId', '==', groupDoc.id),
        where('userId', '==', currentUser?.uid),
        where('status', '==', 'pending')
      );
      const existingRequests = await getDocs(existingRequestQuery);
      
      if (!existingRequests.empty) {
        Alert.alert('Info', 'You already have a pending request for this group');
        setShowJoinModal(false);
        setIsLoading(false);
        return;
      }

      // Add join request
      await addDoc(collection(db, 'joinRequests'), {
        groupId: groupDoc.id,
        userId: currentUser?.uid,
        userName: currentUser?.displayName || currentUser?.email?.split('@')[0],
        userEmail: currentUser?.email,
        timestamp: serverTimestamp(),
        status: 'pending',
      });

      Alert.alert(
        'Request Sent',
        'Your request to join the group has been sent to the group admin',
        [{ text: 'OK', onPress: () => setShowJoinModal(false) }]
      );
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert('Error', 'Failed to send join request');
    } finally {
      setIsLoading(false);
      setJoinCode('');
    }
  };

  const handleAcceptRequest = async (requestId: string, userId: string) => {
    try {
      // Add user to group members
      await updateDoc(doc(db, 'groups', groupId as string), {
        members: arrayUnion(userId),
      });

      // Update request status
      await updateDoc(doc(db, 'joinRequests', requestId), {
        status: 'approved',
      });

      Alert.alert('Success', 'Member added to group');
      fetchGroupDetails(); // Refresh data
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'joinRequests', requestId), {
        status: 'rejected',
      });
      Alert.alert('Success', 'Request rejected');
      fetchGroupDetails(); // Refresh data
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('Error', 'Failed to reject request');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'groups', groupId as string), {
                members: arrayRemove(memberId),
              });
              Alert.alert('Success', 'Member removed');
              fetchGroupDetails();
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const isAdmin = group?.createdBy === currentUser?.uid;

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-100 items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1 bg-gray-100"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F59E0B']} />
      }
    >
      <View className="px-5 pt-10 pb-20">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-800 flex-1" numberOfLines={1}>
            {group?.name}
          </Text>
          <TouchableOpacity onPress={() => setShowJoinModal(true)}>
            <Ionicons name="add-circle-outline" size={28} color="#F59E0B" />
          </TouchableOpacity>
        </View>

        {/* Group Info Card */}
        <View className="bg-white rounded-2xl p-5 mb-6 shadow-sm">
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-2xl font-bold text-orange-500">{group?.code}</Text>
              <Text className="text-gray-500 mt-1">
                {members.length} {members.length === 1 ? 'Member' : 'Members'} · {group?.category}
              </Text>
            </View>
            <View className="bg-orange-100 px-3 py-1 rounded-full">
              <Text className="text-orange-600 text-sm font-medium">{group?.category}</Text>
            </View>
          </View>
        </View>

        {/* Tab Navigation */}
        <View className="flex-row mb-6 bg-white rounded-xl p-1 shadow-sm">
          {(['project', 'meetings', 'members'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-lg ${
                activeTab === tab ? 'bg-orange-500' : ''
              }`}
            >
              <Text
                className={`text-center font-semibold capitalize ${
                  activeTab === tab ? 'text-white' : 'text-gray-600'
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Project Tab Content */}
        {activeTab === 'project' && (
          <View>
            {/* Project Deadlines */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="font-semibold text-gray-800 text-lg">Project Deadlines</Text>
              <TouchableOpacity>
                <Text className="text-orange-500 text-sm">View All</Text>
              </TouchableOpacity>
            </View>

            <View className="space-y-3 mb-6">
              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row items-start">
                  <Ionicons name="ellipse-outline" size={22} color="#9CA3AF" />
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-gray-800">Complete Proposal</Text>
                    <Text className="text-xs text-gray-500 mt-1">Due: Feb 5 • High</Text>
                    <Text className="text-xs text-orange-500 mt-1">You</Text>
                  </View>
                </View>
              </View>

              <View className="bg-white rounded-xl p-4 shadow-sm">
                <View className="flex-row items-start">
                  <Ionicons name="ellipse-outline" size={22} color="#9CA3AF" />
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-gray-800">Review Documentation</Text>
                    <Text className="text-xs text-gray-500 mt-1">Due: Feb 7 • Medium</Text>
                    <Text className="text-xs text-orange-500 mt-1">John</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Team Performance */}
            <View className="bg-white rounded-xl p-5 mb-6">
              <Text className="font-semibold text-gray-800 mb-4">Team Performance</Text>
              <View className="items-center mb-4">
                <Text className="text-5xl font-bold text-orange-500">85%</Text>
                <Text className="text-gray-500 mt-1">Overall</Text>
              </View>
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text className="text-2xl font-bold text-green-500">8</Text>
                  <Text className="text-xs text-gray-500">On Track</Text>
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-bold text-red-500">3</Text>
                  <Text className="text-xs text-gray-500">Pending</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Meetings Tab Content */}
        {activeTab === 'meetings' && (
          <View>
            <TouchableOpacity 
              className="bg-orange-500 rounded-xl p-3 mb-4 flex-row items-center justify-center"
              onPress={() => Alert.alert('Coming Soon', 'Meeting scheduling will be available soon!')}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Schedule Meeting</Text>
            </TouchableOpacity>

            <View className="bg-white rounded-xl p-4 shadow-sm">
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="font-semibold text-gray-800">Team Sync</Text>
                  <Text className="text-sm text-gray-500 mt-1">Tomorrow, 10:00AM • 1 hour</Text>
                </View>
                <Ionicons name="videocam-outline" size={24} color="#F59E0B" />
              </View>
            </View>

            <View className="bg-white rounded-xl p-4 shadow-sm mt-3">
              <View className="flex-row justify-between items-start">
                <View>
                  <Text className="font-semibold text-gray-800">Project Review</Text>
                  <Text className="text-sm text-gray-500 mt-1">Feb 10, 2:00PM • 30 min</Text>
                </View>
                <Ionicons name="people-outline" size={24} color="#F59E0B" />
              </View>
            </View>
          </View>
        )}

        {/* Members Tab Content */}
        {activeTab === 'members' && (
          <View>
            {/* Join Requests (Admin Only) */}
            {isAdmin && joinRequests.length > 0 && (
              <View className="mb-6">
                <Text className="font-semibold text-gray-800 mb-3">
                  Join Requests ({joinRequests.length})
                </Text>
                {joinRequests.map((request) => (
                  <View key={request.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm">
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text className="font-semibold text-gray-800">{request.userName}</Text>
                        <Text className="text-xs text-gray-500 mt-1">{request.userEmail}</Text>
                      </View>
                      <View className="flex-row">
                        <TouchableOpacity
                          onPress={() => handleAcceptRequest(request.id, request.userId)}
                          className="bg-green-500 px-4 py-2 rounded-lg mr-2"
                        >
                          <Text className="text-white text-sm font-medium">Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleRejectRequest(request.id)}
                          className="bg-red-500 px-4 py-2 rounded-lg"
                        >
                          <Text className="text-white text-sm font-medium">Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Members List */}
            <Text className="font-semibold text-gray-800 mb-3">Members ({members.length})</Text>
            {members.map((member) => (
              <View key={member.uid} className="bg-white rounded-xl p-4 mb-3 shadow-sm">
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center flex-1">
                    {member.profileImage ? (
                      <Image
                        source={{ uri: member.profileImage }}
                        className="w-10 h-10 rounded-full mr-3"
                      />
                    ) : (
                      <View className="w-10 h-10 bg-yellow-200 rounded-full items-center justify-center mr-3">
                        <Text className="text-yellow-700 font-bold text-lg">
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-800">{member.name}</Text>
                      {member.email ? (
                        <Text className="text-xs text-gray-500 mt-1">{member.email}</Text>
                      ) : null}
                      {member.uid === group?.createdBy && (
                        <View className="bg-yellow-100 px-2 py-0.5 rounded-full mt-1 self-start">
                          <Text className="text-xs text-yellow-700 font-medium">Admin</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {isAdmin && member.uid !== currentUser?.uid && (
                    <TouchableOpacity onPress={() => handleRemoveMember(member.uid)}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            {/* Invite Code */}
            <View className="bg-white rounded-xl p-4 mt-4 shadow-sm">
              <Text className="text-gray-600 text-sm mb-2">Invite Code</Text>
              <View className="flex-row justify-between items-center">
                <Text className="text-xl font-bold text-orange-500">{group?.code}</Text>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Share Invite Code',
                      `Share this code with others to join "${group?.name}":\n\n${group?.code}\n\nThey can join by tapping the + button in the group details page.`
                    );
                  }}
                >
                  <Ionicons name="share-outline" size={24} color="#F59E0B" />
                </TouchableOpacity>
              </View>
              <Text className="text-xs text-gray-400 mt-2">
                Share this code with others to let them join your group
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Join Group Modal */}
      <Modal
        visible={showJoinModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%]">
            <Text className="text-xl font-bold text-gray-800 mb-4">Join a Group</Text>
            <Text className="text-gray-500 mb-4">
              Enter the group code to request to join
            </Text>
            <TextInput
              className="border border-gray-300 rounded-xl p-3 mb-6 text-base uppercase"
              placeholder="Enter group code"
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              autoCorrect={false}
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
                disabled={isLoading}
                className="bg-orange-500 px-6 py-2 rounded-xl"
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold">Request to Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}