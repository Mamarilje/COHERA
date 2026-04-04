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
  FlatList,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { supabase } from '../src/Supabase/supabaseConfig';
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

type Task = {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  deadline: string;
  assignedTo: string[];
  completed: boolean;
  createdBy: string;
  createdAt: any;
};

type TaskFormData = {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | '';
  deadline: string;
  assignedTo: string[];
  files: { name: string; uri: string }[];
};

export default function GroupDetails() {
  const router = useRouter();
  const { groupId, groupName } = useLocalSearchParams();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [activeTab, setActiveTab] = useState<'project' | 'meetings' | 'members' | 'progress'>('project');
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedAMPM, setSelectedAMPM] = useState<'AM' | 'PM'>('AM');
  const [taskFormData, setTaskFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    priority: '',
    deadline: '',
    assignedTo: [],
    files: [],
  });

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

        // Fetch tasks for this group
        const tasksRef = collection(db, 'tasks');
        const tasksQuery = query(tasksRef, where('groupId', '==', groupId));
        const tasksSnapshot = await getDocs(tasksQuery);
        const fetchedTasks: Task[] = [];
        tasksSnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedTasks.push({
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            priority: data.priority || 'Medium',
            deadline: data.deadline || '',
            assignedTo: data.assignedTo || [],
            completed: data.completed || false,
            createdBy: data.createdBy || '',
            createdAt: data.createdAt,
          });
        });
        setTasks(fetchedTasks);

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

  const handleCreateTask = async (e?: any) => {
    if (!taskFormData.title.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    if (!taskFormData.priority) {
      Alert.alert('Error', 'Please select a priority');
      return;
    }

    if (!taskFormData.deadline) {
      Alert.alert('Error', 'Please select a deadline');
      return;
    }

    if (taskFormData.files.length < 5) {
      Alert.alert('Error', `Please add at least 5 files (${taskFormData.files.length}/5)`);
      return;
    }

    try {
      setIsUploadingFiles(true);
      let uploadedFileUrls: string[] = [];

      // Upload files to Supabase Storage
      if (taskFormData.files.length > 0) {
        const uploadPromises = taskFormData.files.map(async (file) => {
          try {
            const fileName = `${Date.now()}-${file.name}`;
            const folderPath = `tasks/${groupId}/${currentUser?.uid}`;

            // Read the file
            const response = await fetch(file.uri);
            const blob = await response.blob();

            // Upload to Supabase
            const { data, error } = await supabase.storage
              .from('task-files')
              .upload(`${folderPath}/${fileName}`, blob, {
                cacheControl: '3600',
                upsert: false,
              });

            if (error) {
              console.error('Upload error:', error);
              return null;
            }

            // Get public URL
            const { data: publicUrl } = supabase.storage
              .from('task-files')
              .getPublicUrl(`${folderPath}/${fileName}`);

            return publicUrl.publicUrl;
          } catch (error) {
            console.error('Error uploading file:', error);
            return null;
          }
        });

        uploadedFileUrls = (await Promise.all(uploadPromises)).filter((url) => url !== null) as string[];

        if (uploadedFileUrls.length === 0) {
          Alert.alert('Error', 'Failed to upload files');
          setIsUploadingFiles(false);
          return;
        }
      }

      // Save task with file URLs to Firestore
      await addDoc(collection(db, 'tasks'), {
        groupId: groupId,
        title: taskFormData.title,
        description: taskFormData.description,
        priority: taskFormData.priority,
        deadline: taskFormData.deadline,
        assignedTo: taskFormData.assignedTo,
        fileUrls: uploadedFileUrls,
        fileNames: taskFormData.files.map((f) => f.name),
        completed: false,
        createdBy: currentUser?.uid,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Task created successfully with files');
      setTaskFormData({
        title: '',
        description: '',
        priority: '',
        deadline: '',
        assignedTo: [],
        files: [],
      });
      setShowTaskModal(false);
      setIsUploadingFiles(false);
      fetchGroupDetails();
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task');
      setIsUploadingFiles(false);
    }
  };

  const toggleTaskComplete = async (taskId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        completed: !currentStatus,
      });
      fetchGroupDetails();
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const toggleMember = (memberId: string) => {
    setTaskFormData((prev) => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(memberId)
        ? prev.assignedTo.filter((id) => id !== memberId)
        : [...prev.assignedTo, memberId],
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'border-red-400';
      case 'Medium':
        return 'border-yellow-400';
      case 'Low':
        return 'border-blue-400';
      default:
        return 'border-gray-400';
    }
  };

  const getTaskStats = () => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.completed).length;
    const pendingTasks = totalTasks - completedTasks;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = tasks.filter(t => {
      const deadline = new Date(t.deadline);
      deadline.setHours(0, 0, 0, 0);
      return !t.completed && deadline < today;
    }).length;

    return { totalTasks, completedTasks, pendingTasks, completionRate, overdueTasks };
  };

  const getMemberContributions = () => {
    return members.map(member => {
      const assignedTasks = tasks.filter(t => t.assignedTo.includes(member.uid));
      const completed = assignedTasks.filter(t => t.completed).length;
      const total = assignedTasks.length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        ...member,
        tasksCompleted: completed,
        tasksTotal: total,
        completionRate: percentage,
      };
    }).sort((a, b) => b.completionRate - a.completionRate);
  };

  const getSelectedMembersText = () => {
    if (taskFormData.assignedTo.length === 0) return 'Select members';
    if (taskFormData.assignedTo.length === 1) {
      const member = members.find((m) => m.uid === taskFormData.assignedTo[0]);
      return member?.name || 'Select members';
    }
    return `${taskFormData.assignedTo.length} members selected`;
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
          {(['project', 'meetings', 'progress', 'members'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-lg ${
                activeTab === tab ? 'bg-yellow-400' : ''
              }`}
            >
              <Text
                className={`text-center font-semibold capitalize ${
                  activeTab === tab ? 'text-white' : 'text-gray-600'
                }`}
              >
                {tab === 'progress' ? 'Stats' : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Project Tab Content */}
        {activeTab === 'project' && (
          <View>
            {/* Create Task Button */}
            <TouchableOpacity 
              className="bg-yellow-400 rounded-xl p-4 mb-6 flex-row items-center justify-center"
              onPress={() => setShowTaskModal(true)}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Create Task</Text>
            </TouchableOpacity>

            {/* Project Deadlines */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="font-semibold text-gray-800 text-lg">Tasks ({tasks.length})</Text>
            </View>

            {tasks.length === 0 ? (
              <View className="bg-white rounded-xl p-8 shadow-sm items-center">
                <Ionicons name="clipboard-outline" size={40} color="#D1D5DB" />
                <Text className="text-gray-500 mt-3">No tasks yet. Create one to get started!</Text>
              </View>
            ) : (
              <View className="space-y-3 mb-6">
                {tasks.map((task) => (
                  <View
                    key={task.id}
                    className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${getPriorityColor(task.priority)}`}
                  >
                    <View className="flex-row items-start">
                      <TouchableOpacity 
                        onPress={() => toggleTaskComplete(task.id, task.completed)}
                        className="mt-1"
                      >
                        <Ionicons 
                          name={task.completed ? 'checkbox' : 'checkbox-outline'} 
                          size={20} 
                          color={task.completed ? '#22C55E' : '#9CA3AF'} 
                        />
                      </TouchableOpacity>
                      <View className="ml-3 flex-1">
                        <Text className={`font-semibold ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {task.title}
                        </Text>
                        {task.description ? (
                          <Text className="text-xs text-gray-500 mt-1">{task.description}</Text>
                        ) : null}
                        <View className="flex-row items-center gap-2 mt-2">
                          <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                          <Text className="text-xs text-gray-600">
                            Due: {new Date(task.deadline).toLocaleDateString()}
                          </Text>
                          <Text className="text-xs text-gray-600">• {task.priority}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
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

        {/* Progress Tab Content */}
        {activeTab === 'progress' && (
          <View>
            {/* Task Completion Overview */}
            <View className="bg-white rounded-xl p-6 mb-6 shadow-sm">
              <Text className="text-lg font-bold text-gray-800 mb-4">Task Overview</Text>
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text className="text-4xl font-bold text-yellow-400">{getTaskStats().completionRate}%</Text>
                  <Text className="text-xs text-gray-600 mt-2">Completed</Text>
                </View>
                <View className="items-center">
                  <Text className="text-4xl font-bold text-green-500">{getTaskStats().completedTasks}</Text>
                  <Text className="text-xs text-gray-600 mt-2">Done</Text>
                </View>
                <View className="items-center">
                  <Text className="text-4xl font-bold text-orange-500">{getTaskStats().pendingTasks}</Text>
                  <Text className="text-xs text-gray-600 mt-2">Pending</Text>
                </View>
                <View className="items-center">
                  <Text className="text-4xl font-bold text-red-500">{getTaskStats().overdueTasks}</Text>
                  <Text className="text-xs text-gray-600 mt-2">Overdue</Text>
                </View>
              </View>
            </View>

            {/* Member Contributions */}
            <View className="bg-white rounded-xl p-4 shadow-sm">
              <Text className="text-lg font-bold text-gray-800 mb-4">Member Performance</Text>
              {getMemberContributions().length === 0 ? (
                <Text className="text-gray-500 text-center py-4">No members with assigned tasks</Text>
              ) : (
                <View className="space-y-3">
                  {getMemberContributions().map((member, index) => (
                    <View key={member.uid} className="border-b border-gray-100 pb-3">
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center flex-1">
                          {member.profileImage ? (
                            <Image
                              source={{ uri: member.profileImage }}
                              className="w-8 h-8 rounded-full mr-3"
                            />
                          ) : (
                            <View className="w-8 h-8 bg-yellow-200 rounded-full items-center justify-center mr-3">
                              <Text className="text-yellow-700 font-bold text-xs">{member.name.charAt(0)}</Text>
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="font-medium text-gray-800">{member.name}</Text>
                            <Text className="text-xs text-gray-500">{member.tasksCompleted}/{member.tasksTotal}</Text>
                          </View>
                        </View>
                        <Text className="text-lg font-bold text-yellow-500">{member.completionRate}%</Text>
                      </View>
                      <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-yellow-400"
                          style={{ width: `${member.completionRate}%` }}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
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

      {/* Task Creation Modal */}
      <Modal
        visible={showTaskModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTaskModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-800">Create New Task</Text>
              <TouchableOpacity onPress={() => setShowTaskModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title Input */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Title</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg p-3"
                  placeholder="Enter task title"
                  value={taskFormData.title}
                  onChangeText={(text) =>
                    setTaskFormData((prev) => ({ ...prev, title: text }))
                  }
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Description Input */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Description</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg p-3 h-24"
                  placeholder="Enter task description"
                  value={taskFormData.description}
                  onChangeText={(text) =>
                    setTaskFormData((prev) => ({ ...prev, description: text }))
                  }
                  multiline
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* File Upload */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700">
                    Files ({taskFormData.files.length})
                  </Text>
                  <Text className="text-xs text-gray-500">Min: 5 files</Text>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const result = await DocumentPicker.getDocumentAsync({
                        multiple: true,
                        type: '*/*',
                      });

                      if (result.assets && result.assets.length > 0) {
                        const newFiles = result.assets.map((asset) => ({
                          name: asset.name,
                          uri: asset.uri,
                        }));
                        setTaskFormData((prev) => ({
                          ...prev,
                          files: [...prev.files, ...newFiles],
                        }));
                      }
                    } catch (error) {
                      console.error('Error picking files:', error);
                      Alert.alert('Error', 'Failed to pick files');
                    }
                  }}
                  className="border-2 border-dashed border-yellow-400 rounded-lg p-4 items-center mb-3"
                >
                  <Ionicons name="document-attach" size={24} color="#EAB308" />
                  <Text className="text-sm font-semibold text-yellow-600 mt-2">
                    + Add Files
                  </Text>
                </TouchableOpacity>

                {/* Selected Files List */}
                {taskFormData.files.length > 0 && (
                  <View className="bg-gray-50 rounded-lg p-3 gap-2">
                    {taskFormData.files.map((file, index) => (
                      <View
                        key={index}
                        className="flex-row items-center justify-between bg-white border border-gray-200 rounded-lg p-3"
                      >
                        <View className="flex-row items-center gap-2 flex-1">
                          <Ionicons name="document" size={18} color="#6B7280" />
                          <Text className="text-sm text-gray-700 flex-1" numberOfLines={1}>
                            {file.name}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setTaskFormData((prev) => ({
                              ...prev,
                              files: prev.files.filter((_, i) => i !== index),
                            }));
                          }}
                          className="ml-2"
                        >
                          <Ionicons name="close-circle" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Priority */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Priority</Text>
                <TouchableOpacity
                  onPress={() => setShowPriorityPicker(true)}
                  className="border border-gray-300 rounded-lg p-3 bg-white"
                >
                  <View className="flex-row justify-between items-center">
                    <Text className={taskFormData.priority ? 'text-gray-700 font-semibold' : 'text-gray-400'}>
                      {taskFormData.priority || 'Select priority'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Deadline */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Deadline (Date & Time)</Text>
                <TouchableOpacity
                  className="border border-gray-300 rounded-lg p-3 bg-white"
                  onPress={() => {
                    let dateToUse = new Date();
                    if (taskFormData.deadline) {
                      dateToUse = new Date(taskFormData.deadline);
                    } else {
                      const nextWeek = new Date();
                      nextWeek.setDate(nextWeek.getDate() + 7);
                      dateToUse = nextWeek;
                    }
                    
                    setSelectedDeadlineDate(dateToUse);
                    
                    // Extract hour, minute, and AM/PM from the date
                    let hours = dateToUse.getHours();
                    const minutes = dateToUse.getMinutes();
                    const isPM = hours >= 12;
                    let hours12 = hours % 12;
                    if (hours12 === 0) hours12 = 12;
                    
                    setSelectedHour(hours12);
                    setSelectedMinute(minutes);
                    setSelectedAMPM(isPM ? 'PM' : 'AM');
                    
                    setShowDeadlinePicker(true);
                  }}
                >
                  <View className="flex-row justify-between items-center">
                    <Text className={taskFormData.deadline ? 'text-gray-700 font-semibold' : 'text-gray-400'}>
                      {taskFormData.deadline
                        ? new Date(taskFormData.deadline).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Select date and time'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Assign To */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Assign To ({taskFormData.assignedTo.length})</Text>
                <View className="border border-gray-300 rounded-lg p-3 max-h-40">
                  <FlatList
                    data={members}
                    scrollEnabled={false}
                    renderItem={({ item: member }) => (
                      <TouchableOpacity
                        onPress={() => toggleMember(member.uid)}
                        className="flex-row items-center py-2"
                      >
                        <View
                          className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                            taskFormData.assignedTo.includes(member.uid)
                              ? 'bg-yellow-400 border-yellow-400'
                              : 'border-gray-300'
                          }`}
                        >
                          {taskFormData.assignedTo.includes(member.uid) && (
                            <Ionicons name="checkmark" size={14} color="white" />
                          )}
                        </View>
                        <Text className="text-gray-700">{member.name}</Text>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item.uid}
                  />
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3 mt-6">
                <TouchableOpacity
                  onPress={() => setShowTaskModal(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-3"
                >
                  <Text className="text-center text-gray-700 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateTask}
                  disabled={isUploadingFiles}
                  className={`flex-1 rounded-lg py-3 ${isUploadingFiles ? 'bg-yellow-300' : 'bg-yellow-400'}`}
                >
                  {isUploadingFiles ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-center text-white font-semibold">Create Task</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date and Time Picker Modal */}
      <Modal
        visible={showDeadlinePicker}
        transparent
        animationType="slide"
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl pb-6">
            {/* Header */}
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-gray-900">Select Deadline</Text>
              <TouchableOpacity onPress={() => setShowDeadlinePicker(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Calendar View */}
            <View className="p-6">
              {/* Calendar Header with Month/Year */}
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-4">
                  <TouchableOpacity
                    onPress={() => {
                      const newDate = new Date(selectedDeadlineDate);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setSelectedDeadlineDate(newDate);
                    }}
                  >
                    <Ionicons name="chevron-back" size={24} color="#EAB308" />
                  </TouchableOpacity>
                  <Text className="text-base font-semibold text-gray-900">
                    {selectedDeadlineDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const newDate = new Date(selectedDeadlineDate);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setSelectedDeadlineDate(newDate);
                    }}
                  >
                    <Ionicons name="chevron-forward" size={24} color="#EAB308" />
                  </TouchableOpacity>
                </View>

                {/* Weekday Headers */}
                <View className="flex-row justify-between mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Text key={day} className="text-xs font-semibold text-gray-500 w-10 text-center">
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Calendar Days */}
                <View>
                  {(() => {
                    const year = selectedDeadlineDate.getFullYear();
                    const month = selectedDeadlineDate.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const days: (number | null)[] = Array(firstDay).fill(null);
                    for (let i = 1; i <= daysInMonth; i++) days.push(i);

                    return (
                      <View className="flex-row flex-wrap">
                        {days.map((day, index) => (
                          <TouchableOpacity
                            key={index}
                            onPress={() => {
                              if (day) {
                                const newDate = new Date(year, month, day);
                                setSelectedDeadlineDate(newDate);
                              }
                            }}
                            className={`w-[14.28%] aspect-square items-center justify-center rounded-lg mb-2 ${
                              day === selectedDeadlineDate.getDate() &&
                              month === selectedDeadlineDate.getMonth() &&
                              year === selectedDeadlineDate.getFullYear()
                                ? 'bg-yellow-400'
                                : day
                                  ? 'bg-gray-100'
                                  : 'bg-transparent'
                            }`}
                          >
                            {day && (
                              <Text
                                className={`font-semibold ${
                                  day === selectedDeadlineDate.getDate() &&
                                  month === selectedDeadlineDate.getMonth() &&
                                  year === selectedDeadlineDate.getFullYear()
                                    ? 'text-white'
                                    : 'text-gray-700'
                                }`}
                              >
                                {day}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Time Selector */}
              <View className="border-t border-gray-200 pt-6">
                <Text className="text-sm font-semibold text-gray-700 mb-4">Time:</Text>
                <View className="flex-row gap-4 items-center">
                  {/* Hour Dropdown */}
                  <View className="flex-1">
                    <Text className="text-xs text-gray-600 mb-2">Hour (1-12)</Text>
                    <ScrollView
                      showsVerticalScrollIndicator={true}
                      className="border border-gray-300 rounded-lg h-40"
                    >
                      <View>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                          <TouchableOpacity
                            key={hour}
                            onPress={() => setSelectedHour(hour)}
                            className={`px-4 py-3 border-b border-gray-100 ${
                              selectedHour === hour
                                ? 'bg-yellow-400'
                                : 'bg-white'
                            }`}
                          >
                            <Text className={`font-semibold ${selectedHour === hour ? 'text-white' : 'text-gray-700'}`}>
                              {String(hour).padStart(2, '0')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {/* Minute Dropdown */}
                  <View className="flex-1">
                    <Text className="text-xs text-gray-600 mb-2">Minute</Text>
                    <ScrollView
                      showsVerticalScrollIndicator={true}
                      className="border border-gray-300 rounded-lg h-40"
                    >
                      <View>
                        {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                          <TouchableOpacity
                            key={minute}
                            onPress={() => setSelectedMinute(minute)}
                            className={`px-4 py-2 border-b border-gray-100 ${
                              selectedMinute === minute
                                ? 'bg-yellow-400'
                                : 'bg-white'
                            }`}
                          >
                            <Text className={`font-semibold text-sm ${selectedMinute === minute ? 'text-white' : 'text-gray-700'}`}>
                              {String(minute).padStart(2, '0')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {/* AM/PM Toggle */}
                  <View className="flex-1">
                    <Text className="text-xs text-gray-600 mb-2">Period</Text>
                    <View className="flex-row gap-2 border border-gray-300 rounded-lg p-1 bg-white">
                      {(['AM', 'PM'] as const).map((period) => (
                        <TouchableOpacity
                          key={period}
                          onPress={() => setSelectedAMPM(period)}
                          className={`flex-1 py-2 rounded ${
                            selectedAMPM === period
                              ? 'bg-yellow-400'
                              : 'bg-gray-50'
                          }`}
                        >
                          <Text className={`text-center font-semibold ${selectedAMPM === period ? 'text-white' : 'text-gray-700'}`}>
                            {period}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 px-6 border-t border-gray-200 pt-4">
              <TouchableOpacity
                onPress={() => setShowDeadlinePicker(false)}
                className="flex-1 border border-gray-300 rounded-lg py-3"
              >
                <Text className="text-center text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  // Convert 12-hour format to 24-hour format
                  let hours24 = selectedHour;
                  if (selectedAMPM === 'PM' && selectedHour !== 12) {
                    hours24 = selectedHour + 12;
                  } else if (selectedAMPM === 'AM' && selectedHour === 12) {
                    hours24 = 0;
                  }

                  const finalDate = new Date(selectedDeadlineDate);
                  finalDate.setHours(hours24, selectedMinute, 0, 0);

                  setTaskFormData((prev) => ({
                    ...prev,
                    deadline: finalDate.toISOString(),
                  }));
                  setShowDeadlinePicker(false);
                }}
                className="flex-1 bg-yellow-400 rounded-lg py-3"
              >
                <Text className="text-center text-white font-semibold">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Priority Picker Modal */}
      <Modal
        visible={showPriorityPicker}
        transparent
        animationType="slide"
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-2xl pb-6">
            {/* Header */}
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-gray-900">Select Priority</Text>
              <TouchableOpacity onPress={() => setShowPriorityPicker(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Priority Options */}
            <View className="px-6 pt-4 gap-3">
              {(['Low', 'Medium', 'High'] as const).map((level) => (
                <TouchableOpacity
                  key={level}
                  onPress={() => {
                    setTaskFormData((prev) => ({ ...prev, priority: level }));
                    setShowPriorityPicker(false);
                  }}
                  className={`border rounded-lg p-4 ${
                    taskFormData.priority === level
                      ? 'border-yellow-400 bg-yellow-50'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3 flex-1">
                      <View
                        className={`w-4 h-4 rounded-full ${
                          level === 'Low'
                            ? 'bg-green-500'
                            : level === 'Medium'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                      />
                      <Text className={`text-base font-semibold ${
                        taskFormData.priority === level
                          ? 'text-yellow-700'
                          : 'text-gray-700'
                      }`}>
                        {level}
                      </Text>
                    </View>
                    {taskFormData.priority === level && (
                      <Ionicons name="checkmark-circle" size={24} color="#EAB308" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Close Button */}
            <View className="px-6 pt-6 border-t border-gray-200">
              <TouchableOpacity
                onPress={() => setShowPriorityPicker(false)}
                className="bg-yellow-400 rounded-lg py-3"
              >
                <Text className="text-center text-white font-semibold">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Native Date Picker - Only render on iOS/Android */}
      {showDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={selectedDeadlineDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS === 'android') {
              setShowDatePicker(false);
            }
            if (date) {
              setSelectedDeadlineDate(date);
            }
          }}
        />
      )}

      {/* Native Time Picker - Only render on iOS/Android */}
      {showTimePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={selectedDeadlineDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            if (Platform.OS === 'android') {
              setShowTimePicker(false);
            }
            if (date) {
              setSelectedDeadlineDate(date);
            }
          }}
        />
      )}


    </ScrollView>
  );
}