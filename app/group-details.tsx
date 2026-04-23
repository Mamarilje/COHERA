import React, { useState, useEffect, useRef } from 'react';
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
import {
  notifyAdminJoinRequest,
  notifyMemberJoinRequestDeclined,
  notifyMemberKickedFromGroup,
  notifyMemberTaskAssigned,
  getUserData,
} from '../src/utils/notificationHelper';

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
  completedBy?: string[];
  createdBy: string;
  createdAt: any;
  fileUrls?: string[];
  fileNames?: string[];
  archived?: boolean;
};

type TaskFormData = {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | '';
  deadline: string;
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
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [activeTab, setActiveTab] = useState<'project' | 'progress' | 'members'>('project');
  
  // Confirmation modals state
  const [showAcceptConfirmModal, setShowAcceptConfirmModal] = useState(false);
  const [showRejectConfirmModal, setShowRejectConfirmModal] = useState(false);
  const [showKickConfirmModal, setShowKickConfirmModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [selectedRequestForAccept, setSelectedRequestForAccept] = useState<JoinRequest | null>(null);
  const [selectedRequestForReject, setSelectedRequestForReject] = useState<JoinRequest | null>(null);
  const [selectedMemberForKick, setSelectedMemberForKick] = useState<Member | null>(null);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedAMPM, setSelectedAMPM] = useState<'AM' | 'PM'>('AM');
  
  // @mention states
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  
  const descriptionInputRef = useRef<TextInput>(null);
  
  // Assigned members state
  const [selectedAssignedMembers, setSelectedAssignedMembers] = useState<string[]>([]);
  
  // Warning modal state
  const [showAbuseWarningModal, setShowAbuseWarningModal] = useState(false);
  const [overloadedMembers, setOverloadedMembers] = useState<Array<{uid: string, name: string, taskCount: number}>>([]);
  
  // Archive state
  const [showArchiveDropdown, setShowArchiveDropdown] = useState(false);
  const [showArchiveTasks, setShowArchiveTasks] = useState(false);
  const [showArchiveConfirmModal, setShowArchiveConfirmModal] = useState(false);
  const [selectedTaskIdForArchive, setSelectedTaskIdForArchive] = useState<string | null>(null);
  const [showUnarchiveConfirmModal, setShowUnarchiveConfirmModal] = useState(false);
  const [selectedTaskIdForUnarchive, setSelectedTaskIdForUnarchive] = useState<string | null>(null);
  
  const [taskFormData, setTaskFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    priority: '',
    deadline: '',
    files: [],
  });

  const fetchGroupDetails = async () => {
    if (!groupId) return;

    try {
      const groupDoc = await getDoc(doc(db, 'groups', groupId as string));
      if (groupDoc.exists()) {
        const groupData = { id: groupDoc.id, ...groupDoc.data() } as Group;
        setGroup(groupData);

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
              membersData.push({
                uid: memberId,
                name: memberId,
                email: '',
              });
            }
          } catch (error) {
            membersData.push({
              uid: memberId,
              name: memberId,
              email: '',
            });
          }
        }
        setMembers(membersData);

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
            completedBy: data.completedBy || [],
            createdBy: data.createdBy || '',
            createdAt: data.createdAt,
            fileUrls: data.fileUrls || [],
            fileNames: data.fileNames || [],
            archived: data.archived || false,
          });
        });
        setTasks(fetchedTasks);

        const requestsRef = collection(db, 'joinRequests');
        const q = query(
          requestsRef,
          where('groupId', '==', groupId)
        );
        const requestsSnapshot = await getDocs(q);
        const requests: JoinRequest[] = [];
        requestsSnapshot.forEach((doc) => {
          const data = doc.data();
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

  const checkForOverloadedMembers = async (memberIds: string[]): Promise<Array<{uid: string, name: string, taskCount: number}>> => {
    const overloaded: Array<{uid: string, name: string, taskCount: number}> = [];
    
    for (const memberId of memberIds) {
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('groupId', '==', groupId),
        where('assignedTo', 'array-contains', memberId),
        where('completed', '==', false)
      );
      
      const tasksSnapshot = await getDocs(tasksQuery);
      const incompleteTaskCount = tasksSnapshot.size;
      
      // Check if member has 3 or more incomplete tasks
      if (incompleteTaskCount >= 3) {
        const memberName = members.find(m => m.uid === memberId)?.name || memberId;
        overloaded.push({
          uid: memberId,
          name: memberName,
          taskCount: incompleteTaskCount
        });
      }
    }
    
    return overloaded;
  };

  const handleAcceptRequest = async (requestId: string, userId: string) => {
    try {
      await updateDoc(doc(db, 'groups', groupId as string), {
        members: arrayUnion(userId),
      });

      await updateDoc(doc(db, 'joinRequests', requestId), {
        status: 'approved',
      });

      Alert.alert('Success', 'Member added to group');
      fetchGroupDetails();
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string, userId: string) => {
    try {
      await updateDoc(doc(db, 'joinRequests', requestId), {
        status: 'rejected',
      });

      // Notify the requester that their request was declined
      if (group) {
        await notifyMemberJoinRequestDeclined(userId, group.name, group.id, requestId);
      }

      Alert.alert('Success', 'Request rejected');
      fetchGroupDetails();
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

  const handleDescriptionChange = (text: string) => {
    setTaskFormData(prev => ({ ...prev, description: text }));
    
    // Check for @ mention
    const cursorPosition = text.length;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const query = textBeforeCursor.substring(lastAtIndex + 1);
      // If there's no space after the @, show mentions
      if (!query.includes(' ')) {
        setShowMentions(true);
        setMentionQuery(query);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (member: Member) => {
    const text = taskFormData.description;
    const lastAtIndex = text.lastIndexOf('@');
    const beforeMention = text.substring(0, lastAtIndex);
    const afterMention = text.substring(lastAtIndex + mentionQuery.length + 1);
    const mentionText = `@${member.name} `;
    const newDescription = beforeMention + mentionText + afterMention;
    
    setTaskFormData(prev => ({ ...prev, description: newDescription }));
    
    setShowMentions(false);
    
    setTimeout(() => {
      descriptionInputRef.current?.focus();
    }, 100);
  };

  const getFilteredMembers = () => {
    if (!mentionQuery) return members;
    return members.filter(member => 
      member.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  };

  const handleCreateTask = async () => {
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

    // Check for overloaded members before creating task
    if (selectedAssignedMembers.length > 0) {
      const overloaded = await checkForOverloadedMembers(selectedAssignedMembers);
      if (overloaded.length > 0) {
        setOverloadedMembers(overloaded);
        setShowAbuseWarningModal(true);
        return;
      }
    }

    await createTaskWithAssignments();
  };

  const createTaskWithAssignments = async () => {
    try {
      setIsUploadingFiles(true);
      let uploadedFileUrls: string[] = [];

      if (taskFormData.files.length > 0) {
        const uploadPromises = taskFormData.files.map(async (file) => {
          try {
            const fileName = `${Date.now()}-${file.name}`;
            const folderPath = `tasks/${groupId}/${currentUser?.uid}`;
            const fullPath = `${folderPath}/${fileName}`;

            const response = await fetch(file.uri);
            const blob = await response.blob();

            const { error } = await supabase.storage
              .from('task-files')
              .upload(fullPath, blob, {
                cacheControl: '3600',
                upsert: false,
              });

            if (error) {
              console.error('Supabase upload error:', error);
              return null;
            }

            const { data: publicUrl } = supabase.storage
              .from('task-files')
              .getPublicUrl(fullPath);

            return publicUrl?.publicUrl;
          } catch (error) {
            console.error(`Error uploading file:`, error);
            return null;
          }
        });

        uploadedFileUrls = (await Promise.all(uploadPromises)).filter((url) => url !== null) as string[];
      }

      const taskData = {
        groupId: groupId,
        title: taskFormData.title,
        description: taskFormData.description,
        priority: taskFormData.priority,
        deadline: taskFormData.deadline,
        assignedTo: selectedAssignedMembers,
        ...(uploadedFileUrls.length > 0 && { fileUrls: uploadedFileUrls }),
        ...(uploadedFileUrls.length > 0 && { fileNames: taskFormData.files.slice(0, uploadedFileUrls.length).map((f) => f.name) }),
        completed: false,
        completedBy: [],
        createdBy: currentUser?.uid,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'tasks'), taskData);
      
      // Notify assigned members about the new task
      const adminName = currentUser?.displayName || 'Admin';
      for (const memberId of selectedAssignedMembers) {
        if (memberId !== currentUser?.uid) { // Don't notify yourself
          await notifyMemberTaskAssigned(
            memberId,
            taskFormData.title,
            '', // Task ID would be set during addDoc, but we can pass empty for now
            groupId as string,
            adminName,
            currentUser?.uid || ''
          );
        }
      }
      
      Alert.alert('Success', 'Task created successfully');
      
      setTaskFormData({
        title: '',
        description: '',
        priority: '',
        deadline: '',
        files: [],
      });
      setSelectedAssignedMembers([]);
      setShowTaskModal(false);
      setShowAbuseWarningModal(false);
      setIsUploadingFiles(false);
      fetchGroupDetails();
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Error', `Failed to create task: ${(error as any)?.message}`);
      setIsUploadingFiles(false);
    }
  };

  const archiveTask = async (taskId: string) => {
    if (!isAdmin) {
      Alert.alert('Error', 'Only group creators can archive tasks');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        archived: true,
      });
      
      await fetchGroupDetails();
      
      setShowArchiveTasks(true);
      setShowArchiveDropdown(true);
      
      Alert.alert('Success', 'Task archived');
    } catch (error) {
      console.error('Error archiving task:', error);
      Alert.alert('Error', `Failed to archive task: ${(error as any)?.message}`);
    }
  };

  const unarchiveTask = async (taskId: string) => {
    if (!isAdmin) {
      Alert.alert('Error', 'Only group creators can unarchive tasks');
      return;
    }
    
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        archived: false,
      });
      
      await fetchGroupDetails();
      
      setShowArchiveTasks(false);
      setShowArchiveDropdown(false);
      
      Alert.alert('Success', 'Task restored');
    } catch (error) {
      console.error('Error unarchiving task:', error);
      Alert.alert('Error', `Failed to restore task: ${(error as any)?.message}`);
    }
  };

  const handleTaskPress = (task: Task) => {
    router.push({
      pathname: '/task/[id]',
      params: { id: task.id }
    });
  };

  const getTaskBorderColor = (task: Task) => {
    // Check if the CURRENT user has completed this task
    const currentUserCompleted = task.completedBy?.includes(currentUser?.uid || '');
    
    // If current user completed the task, return green
    if (currentUserCompleted) {
      return 'border-green-500';
    }
    
    // Otherwise return based on priority
    switch (task.priority) {
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
    // Count tasks as completed if either the task is marked complete or any member has completed it
    const completedTasks = tasks.filter(t => 
      t.completed || (t.completedBy && t.completedBy.length > 0)
    ).length;
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
  return members
    .map(member => {
      const assignedTasks = tasks.filter(t => t.assignedTo.includes(member.uid));
      const completed = assignedTasks.filter(t => 
        t.completed || t.completedBy?.includes(member.uid)
      ).length;
      const total = assignedTasks.length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        ...member,
        tasksCompleted: completed,
        tasksTotal: total,
        completionRate: percentage,
      };
    })
    .filter(member => member.tasksTotal > 0) // Only show members with assigned tasks
    .sort((a, b) => b.completionRate - a.completionRate);
};

  const leaveGroup = async () => {
    if (!group || !currentUser) return;
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: arrayRemove(currentUser.uid),
      });
      setShowLeaveConfirmModal(false);
      Alert.alert('Success', 'You have left the group', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error leaving group:', error);
      Alert.alert('Error', 'Failed to leave group');
    }
  };

  const getSortedTasks = () => {
    const filtered = showArchiveTasks 
      ? tasks.filter(t => t.archived)
      : tasks.filter(t => !t.archived);
    
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.deadline).getTime();
      const dateB = new Date(b.deadline).getTime();
      return dateB - dateA; // Newest (latest) first
    });
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
          <TouchableOpacity
            onPress={() => setActiveTab('project')}
            className={`flex-1 py-3 rounded-lg ${activeTab === 'project' ? 'bg-yellow-400' : ''}`}
          >
            <Text className={`text-center font-semibold ${activeTab === 'project' ? 'text-white' : 'text-gray-600'}`}>
              Project
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('progress')}
            className={`flex-1 py-3 rounded-lg ${activeTab === 'progress' ? 'bg-yellow-400' : ''}`}
          >
            <Text className={`text-center font-semibold ${activeTab === 'progress' ? 'text-white' : 'text-gray-600'}`}>
              Progress
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('members')}
            className={`flex-1 py-3 rounded-lg ${activeTab === 'members' ? 'bg-yellow-400' : ''}`}
          >
            <Text className={`text-center font-semibold ${activeTab === 'members' ? 'text-white' : 'text-gray-600'}`}>
              Members
            </Text>
          </TouchableOpacity>
        </View>

        {/* Project Tab Content */}
        {activeTab === 'project' && (
          <View>
            <TouchableOpacity 
              className="bg-yellow-400 rounded-xl p-4 mb-6 flex-row items-center justify-center"
              onPress={() => {
                setShowTaskModal(true);
                setSelectedAssignedMembers([]);
              }}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Create Task</Text>
            </TouchableOpacity>

            <View className="flex-row justify-between items-center mb-4">
              <TouchableOpacity 
                onPress={() => setShowArchiveDropdown(!showArchiveDropdown)}
                className="flex-row items-center gap-2"
              >
                <Text className="font-semibold text-gray-800 text-lg">Tasks ({tasks.filter(t => !t.archived).length})</Text>
                <Ionicons 
                  name={showArchiveDropdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#6B7280" 
                />
              </TouchableOpacity>
            </View>

            {/* Archive Dropdown */}
            {showArchiveDropdown && (
              <View className="bg-white rounded-xl p-3 mb-4 shadow-sm">
                <TouchableOpacity
                  onPress={() => {
                    setShowArchiveTasks(false);
                    setShowArchiveDropdown(false);
                  }}
                  className={`p-3 rounded-lg mb-2 ${!showArchiveTasks ? 'bg-gray-100' : 'bg-white'}`}
                >
                  <Text className={`font-medium ${!showArchiveTasks ? 'text-gray-800' : 'text-gray-600'}`}>
                    All Tasks ({tasks.filter(t => !t.archived).length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setShowArchiveTasks(true);
                    setShowArchiveDropdown(false);
                  }}
                  className={`p-3 rounded-lg ${showArchiveTasks ? 'bg-gray-100' : 'bg-white'}`}
                >
                  <Text className={`font-medium ${showArchiveTasks ? 'text-gray-800' : 'text-gray-600'}`}>
                    Archived Tasks ({tasks.filter(t => t.archived).length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {tasks.length === 0 ? (
              <View className="bg-white rounded-xl p-8 shadow-sm items-center">
                <Ionicons name="clipboard-outline" size={40} color="#D1D5DB" />
                <Text className="text-gray-500 mt-3">No tasks yet. Create one to get started!</Text>
              </View>
            ) : (
              <View className="space-y-3 mb-6">
                {getSortedTasks().map((task) => {
                  const isCompletedByCurrentUser = task.completedBy?.includes(currentUser?.uid || '');
                  
                  return (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => handleTaskPress(task)}
                      activeOpacity={0.7}
                    >
                      <View
                        className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${getTaskBorderColor(task)}`}
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="flex-row items-start flex-1">
                            <View className="flex-1">
                              <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                                <Text className={`font-semibold ${isCompletedByCurrentUser ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                  {task.title}
                                </Text>
                                {isCompletedByCurrentUser && (
                                  <View className="bg-green-500 px-2 py-0.5 rounded-full">
                                    <Text className="text-white text-xs font-medium">Completed</Text>
                                  </View>
                                )}
                              </View>
                              {task.description ? (
                                <Text className="text-xs text-gray-500 mt-1" numberOfLines={2}>
                                  {task.description}
                                </Text>
                              ) : null}
                              <View className="flex-row items-center gap-2 mt-2">
                                <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                                <Text className="text-xs text-gray-600">
                                  Due: {new Date(task.deadline).toLocaleDateString()}
                                </Text>
                                <Text className="text-xs text-gray-600">• {task.priority}</Text>
                              </View>
                              
                              {/* Show how many members completed the task */}
                              {task.completedBy && task.completedBy.length > 0 && (
                                <View className="flex-row items-center gap-1 mt-2">
                                  <Ionicons name="people" size={12} color="#22C55E" />
                                  <Text className="text-xs text-green-600">
                                    Completed by: {task.completedBy.length} member(s)
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                          {isAdmin && (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                
                                if (task.archived) {
                                  setSelectedTaskIdForUnarchive(task.id);
                                  setShowUnarchiveConfirmModal(true);
                                } else {
                                  setSelectedTaskIdForArchive(task.id);
                                  setShowArchiveConfirmModal(true);
                                }
                              }}
                              className="ml-2"
                            >
                              <Ionicons 
                                name={task.archived ? "arrow-undo-outline" : "archive-outline"} 
                                size={20} 
                                color={task.archived ? "#22C55E" : "#9CA3AF"} 
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Progress Tab Content */}
        {activeTab === 'progress' && (
          <View>
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

            <View className="bg-white rounded-xl p-4 shadow-sm">
              <Text className="text-lg font-bold text-gray-800 mb-4">Member Performance</Text>
              {getMemberContributions().length === 0 ? (
                <Text className="text-gray-500 text-center py-4">No members with assigned tasks</Text>
              ) : (
                <View className="space-y-3">
                  {getMemberContributions().map((member) => (
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
                          onPress={() => {
                            setSelectedRequestForAccept(request);
                            setShowAcceptConfirmModal(true);
                          }}
                          className="bg-green-500 px-4 py-2 rounded-lg mr-2"
                        >
                          <Text className="text-white text-sm font-medium">Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedRequestForReject(request);
                            setShowRejectConfirmModal(true);
                          }}
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
                    <TouchableOpacity 
                      onPress={() => {
                        setSelectedMemberForKick(member);
                        setShowKickConfirmModal(true);
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                  {!isAdmin && member.uid === currentUser?.uid && (
                    <TouchableOpacity 
                      onPress={() => setShowLeaveConfirmModal(true)}
                      className="px-3 py-1 rounded-lg bg-red-100"
                    >
                      <Text className="text-red-600 text-sm font-medium">Leave</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Task Creation Modal */}
      <Modal
        visible={showTaskModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTaskModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-800">Create New Task</Text>
              <TouchableOpacity onPress={() => {
                setShowTaskModal(false);
                setSelectedAssignedMembers([]);
              }}>
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

              {/* Description Input with @mention */}
              <View className="mb-4" style={{ zIndex: showMentions ? 100 : 1 }}>
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Description (Use @ to mention team members)
                </Text>

                {/* Text Input with Dropdown */}
                <View>
                  <TextInput
                    ref={descriptionInputRef}
                    className="border border-gray-300 rounded-lg p-3 h-32 bg-white text-gray-800"
                    placeholder="Enter task description... Use @ to mention someone"
                    value={taskFormData.description}
                    onChangeText={handleDescriptionChange}
                    multiline
                    placeholderTextColor="#9CA3AF"
                  />

                  {/* Mention Suggestions Dropdown */}
                  {showMentions && members.length > 0 && (
                    <>
                      {/* Backdrop overlay */}
                      <TouchableOpacity 
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: -500,
                          backgroundColor: 'transparent',
                          zIndex: 999,
                        }}
                        activeOpacity={1}
                        onPress={() => setShowMentions(false)}
                      />
                      
                      {/* Dropdown content */}
                      <View 
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: 4,
                          backgroundColor: 'white',
                          borderRadius: 12,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 6,
                          elevation: 10,
                          zIndex: 1000,
                          maxHeight: 280,
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                        }}
                      >
                        <FlatList
                          data={getFilteredMembers()}
                          keyExtractor={(item) => item.uid}
                          keyboardShouldPersistTaps="handled"
                          nestedScrollEnabled={true}
                          style={{ backgroundColor: 'white', borderRadius: 12 }}
                          ListHeaderComponent={
                            (!mentionQuery || 'everyone'.includes(mentionQuery.toLowerCase())) ? (
                              <TouchableOpacity
                                onPress={() => {
                                  const beforeMention = taskFormData.description.substring(0, taskFormData.description.lastIndexOf('@'));
                                  const mentionText = `@everyone `;
                                  const newDescription = beforeMention + mentionText;
                                  setTaskFormData(prev => ({ ...prev, description: newDescription }));
                                  setShowMentions(false);
                                  setTimeout(() => {
                                    descriptionInputRef.current?.focus();
                                  }, 100);
                                }}
                                className="flex-row items-center px-4 py-3 border-b border-gray-100"
                              >
                                <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-3">
                                  <Ionicons name="people" size={20} color="#9333EA" />
                                </View>
                                <View className="flex-1">
                                  <Text className="font-semibold text-gray-800">
                                    Mention everyone in this chat
                                  </Text>
                                  <Text className="text-xs text-gray-500">
                                    Notify all members
                                  </Text>
                                </View>
                                <View className="w-8 h-8 bg-purple-100 rounded-full items-center justify-center ml-2">
                                  <Ionicons name="notifications-outline" size={16} color="#9333EA" />
                                </View>
                              </TouchableOpacity>
                            ) : null
                          }
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              onPress={() => {
                                const text = taskFormData.description;
                                const lastAtIndex = text.lastIndexOf('@');
                                const beforeMention = text.substring(0, lastAtIndex);
                                const afterMention = text.substring(lastAtIndex + (mentionQuery.length + 1));
                                const mentionText = `@${item.name} `;
                                const newDescription = beforeMention + mentionText + afterMention;
                                
                                setTaskFormData(prev => ({ ...prev, description: newDescription }));
                                setShowMentions(false);
                                
                                setTimeout(() => {
                                  descriptionInputRef.current?.focus();
                                }, 100);
                              }}
                              className="flex-row items-center px-4 py-3 border-b border-gray-100"
                            >
                              {item.profileImage ? (
                                <Image source={{ uri: item.profileImage }} className="w-10 h-10 rounded-full mr-3" />
                              ) : (
                                <View className="w-10 h-10 bg-yellow-400 rounded-full items-center justify-center mr-3">
                                  <Text className="text-white font-bold text-base">
                                    {item.name.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              
                              <View className="flex-1">
                                <Text className="font-semibold text-gray-800">
                                  {item.name}
                                </Text>
                                {item.email && (
                                  <Text className="text-xs text-gray-500" numberOfLines={1}>
                                    {item.email}
                                  </Text>
                                )}
                              </View>
                              
                              <View className="w-8 h-8 bg-yellow-100 rounded-full items-center justify-center ml-2">
                                <Ionicons name="at" size={16} color="#EAB308" />
                              </View>
                            </TouchableOpacity>
                          )}
                          ListEmptyComponent={
                            <View className="p-6 items-center">
                              <Text className="text-gray-400">No members found</Text>
                            </View>
                          }
                        />
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* File Upload */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700">
                    Files ({taskFormData.files.length})
                  </Text>
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
                    + Add Files (Optional)
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1">
                    {taskFormData.files.length} file(s) selected
                  </Text>
                </TouchableOpacity>

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

              {/* Assign Members */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Assign to Members</Text>
                <View className="bg-gray-50 rounded-lg p-3 max-h-60">
                  <ScrollView showsVerticalScrollIndicator={true}>
                    {members.length === 0 ? (
                      <Text className="text-gray-500 text-center py-4">No members available</Text>
                    ) : (
                      <View>
                        {members.map((member) => (
                          <TouchableOpacity
                            key={member.uid}
                            onPress={() => {
                              setSelectedAssignedMembers((prev) =>
                                prev.includes(member.uid)
                                  ? prev.filter((id) => id !== member.uid)
                                  : [...prev, member.uid]
                              );
                            }}
                            className="flex-row items-center py-3 px-2 border-b border-gray-200"
                          >
                            <View
                              className={`w-5 h-5 border-2 rounded mr-3 items-center justify-center ${
                                selectedAssignedMembers.includes(member.uid)
                                  ? 'bg-yellow-400 border-yellow-400'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {selectedAssignedMembers.includes(member.uid) && (
                                <Ionicons name="checkmark" size={12} color="white" />
                              )}
                            </View>
                            <View className="flex-row items-center flex-1">
                              {member.profileImage ? (
                                <Image
                                  source={{ uri: member.profileImage }}
                                  className="w-8 h-8 rounded-full mr-2"
                                />
                              ) : (
                                <View className="w-8 h-8 bg-yellow-200 rounded-full items-center justify-center mr-2">
                                  <Text className="text-yellow-700 font-bold text-xs">
                                    {member.name.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              <View className="flex-1">
                                <Text className="font-medium text-gray-800">{member.name}</Text>
                                {member.email && (
                                  <Text className="text-xs text-gray-500">{member.email}</Text>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </ScrollView>
                </View>
                {selectedAssignedMembers.length > 0 && (
                  <Text className="text-xs text-gray-500 mt-2">
                    {selectedAssignedMembers.length} member(s) selected
                  </Text>
                )}
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3 mt-6">
                <TouchableOpacity
                  onPress={() => {
                    setShowTaskModal(false);
                    setSelectedAssignedMembers([]);
                  }}
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
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-gray-900">Select Deadline</Text>
              <TouchableOpacity onPress={() => setShowDeadlinePicker(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View className="p-6">
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

                <View className="flex-row justify-between mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Text key={day} className="text-xs font-semibold text-gray-500 w-10 text-center">
                      {day}
                    </Text>
                  ))}
                </View>

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

              <View className="border-t border-gray-200 pt-6">
                <Text className="text-sm font-semibold text-gray-700 mb-4">Time:</Text>
                <View className="flex-row gap-4 items-center">
                  <View className="flex-1">
                    <Text className="text-xs text-gray-600 mb-2">Hour (1-12)</Text>
                    <ScrollView showsVerticalScrollIndicator={true} className="border border-gray-300 rounded-lg h-40">
                      <View>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                          <TouchableOpacity
                            key={hour}
                            onPress={() => setSelectedHour(hour)}
                            className={`px-4 py-3 border-b border-gray-100 ${
                              selectedHour === hour ? 'bg-yellow-400' : 'bg-white'
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

                  <View className="flex-1">
                    <Text className="text-xs text-gray-600 mb-2">Minute</Text>
                    <ScrollView showsVerticalScrollIndicator={true} className="border border-gray-300 rounded-lg h-40">
                      <View>
                        {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                          <TouchableOpacity
                            key={minute}
                            onPress={() => setSelectedMinute(minute)}
                            className={`px-4 py-2 border-b border-gray-100 ${
                              selectedMinute === minute ? 'bg-yellow-400' : 'bg-white'
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

                  <View className="flex-1">
                    <Text className="text-xs text-gray-600 mb-2">Period</Text>
                    <View className="flex-row gap-2 border border-gray-300 rounded-lg p-1 bg-white">
                      {(['AM', 'PM'] as const).map((period) => (
                        <TouchableOpacity
                          key={period}
                          onPress={() => setSelectedAMPM(period)}
                          className={`flex-1 py-2 rounded ${
                            selectedAMPM === period ? 'bg-yellow-400' : 'bg-gray-50'
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

            <View className="flex-row gap-3 px-6 border-t border-gray-200 pt-4">
              <TouchableOpacity
                onPress={() => setShowDeadlinePicker(false)}
                className="flex-1 border border-gray-300 rounded-lg py-3"
              >
                <Text className="text-center text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
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
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-gray-900">Select Priority</Text>
              <TouchableOpacity onPress={() => setShowPriorityPicker(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

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
                            ? 'bg-blue-500'
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

      {/* Accept Member Confirmation Modal */}
      <Modal
        visible={showAcceptConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowAcceptConfirmModal(false);
          setSelectedRequestForAccept(null);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%]">
            <View className="items-center mb-4">
              <View className="bg-green-100 rounded-full p-4 mb-4">
                <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
              </View>
              <Text className="text-xl font-bold text-gray-800 text-center mb-2">
                Accept Member?
              </Text>
              {selectedRequestForAccept && (
                <>
                  <Text className="text-base font-semibold text-gray-700 mb-1">
                    {selectedRequestForAccept.userName}
                  </Text>
                  <Text className="text-sm text-gray-500 text-center">
                    {selectedRequestForAccept.userEmail}
                  </Text>
                </>
              )}
            </View>

            <View className="bg-blue-50 rounded-lg p-3 mb-6">
              <Text className="text-sm text-gray-700 text-center">
                Are you sure you want to accept this member to join <Text className="font-semibold">{group?.name}</Text>?
              </Text>
            </View>

            <View className="flex-row justify-end gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowAcceptConfirmModal(false);
                  setSelectedRequestForAccept(null);
                }}
                className="px-5 py-2 rounded-lg border border-gray-300"
              >
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (selectedRequestForAccept) {
                    await handleAcceptRequest(selectedRequestForAccept.id, selectedRequestForAccept.userId);
                    setShowAcceptConfirmModal(false);
                    setSelectedRequestForAccept(null);
                  }
                }}
                className="px-5 py-2 rounded-lg bg-green-500"
              >
                <Text className="text-white font-semibold">Confirm Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Member Confirmation Modal */}
      <Modal
        visible={showRejectConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowRejectConfirmModal(false);
          setSelectedRequestForReject(null);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%]">
            <View className="items-center mb-4">
              <View className="bg-orange-100 rounded-full p-4 mb-4">
                <Ionicons name="close-circle" size={40} color="#F97316" />
              </View>
              <Text className="text-xl font-bold text-gray-800 text-center mb-2">
                Reject Member?
              </Text>
              {selectedRequestForReject && (
                <>
                  <Text className="text-base font-semibold text-gray-700 mb-1">
                    {selectedRequestForReject.userName}
                  </Text>
                  <Text className="text-sm text-gray-500 text-center">
                    {selectedRequestForReject.userEmail}
                  </Text>
                </>
              )}
            </View>

            <View className="bg-orange-50 rounded-lg p-3 mb-6">
              <Text className="text-sm text-gray-700 text-center">
                This member's request to join <Text className="font-semibold">{group?.name}</Text> will be rejected. They can send another request later.
              </Text>
            </View>

            <View className="flex-row justify-end gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowRejectConfirmModal(false);
                  setSelectedRequestForReject(null);
                }}
                className="px-5 py-2 rounded-lg border border-gray-300"
              >
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (selectedRequestForReject) {
                    await handleRejectRequest(selectedRequestForReject.id, selectedRequestForReject.userId);
                    setShowRejectConfirmModal(false);
                    setSelectedRequestForReject(null);
                  }
                }}
                className="px-5 py-2 rounded-lg bg-orange-500"
              >
                <Text className="text-white font-semibold">Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Kick Member Confirmation Modal */}
      <Modal
        visible={showKickConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowKickConfirmModal(false);
          setSelectedMemberForKick(null);
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%]">
            <View className="items-center mb-4">
              <View className="bg-red-100 rounded-full p-4 mb-4">
                <Ionicons name="trash" size={40} color="#EF4444" />
              </View>
              <Text className="text-xl font-bold text-gray-800 text-center mb-2">
                Remove Member?
              </Text>
              {selectedMemberForKick && (
                <>
                  <Text className="text-base font-semibold text-gray-700 mb-1">
                    {selectedMemberForKick.name}
                  </Text>
                  {selectedMemberForKick.email && (
                    <Text className="text-sm text-gray-500 text-center">
                      {selectedMemberForKick.email}
                    </Text>
                  )}
                </>
              )}
            </View>

            <View className="bg-red-50 rounded-lg p-3 mb-6">
              <Text className="text-sm text-gray-700 text-center">
                This member will be removed from <Text className="font-semibold">{group?.name}</Text> and will no longer have access to group tasks and information.
              </Text>
            </View>

            <View className="flex-row justify-end gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowKickConfirmModal(false);
                  setSelectedMemberForKick(null);
                }}
                className="px-5 py-2 rounded-lg border border-gray-300"
              >
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (selectedMemberForKick) {
                    try {
                      await updateDoc(doc(db, 'groups', groupId as string), {
                        members: arrayRemove(selectedMemberForKick.uid),
                      });
                      
                      // Notify the member they were kicked
                      const adminName = currentUser?.displayName || 'Admin';
                      await notifyMemberKickedFromGroup(
                        selectedMemberForKick.uid,
                        group?.name || 'Group',
                        groupId as string,
                        adminName,
                        currentUser?.uid || ''
                      );
                      
                      Alert.alert('Success', 'Member removed');
                      fetchGroupDetails();
                    } catch (error) {
                      console.error('Error removing member:', error);
                      Alert.alert('Error', 'Failed to remove member');
                    }
                    setShowKickConfirmModal(false);
                    setSelectedMemberForKick(null);
                  }
                }}
                className="px-5 py-2 rounded-lg bg-red-500"
              >
                <Text className="text-white font-semibold">Remove Member</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Abuse of Power Warning Modal */}
      <Modal
        visible={showAbuseWarningModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAbuseWarningModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%] max-h-[80%]">
            <View className="items-center mb-4">
              <View className="bg-red-100 rounded-full p-4 mb-4">
                <Ionicons name="warning" size={40} color="#EF4444" />
              </View>
              <Text className="text-xl font-bold text-gray-800 text-center">
                Task Overload Warning
              </Text>
            </View>

            <View className="bg-red-50 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
              <Text className="text-sm font-semibold text-red-700 mb-3">
                The following member(s) already have 3-4 incomplete tasks:
              </Text>
              <View>
                {overloadedMembers.map((member) => (
                  <View 
                    key={member.uid}
                    className="flex-row items-center justify-between bg-white rounded-lg p-3 mb-2 border border-red-200"
                  >
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-800">{member.name}</Text>
                      <Text className="text-xs text-red-600">
                        {member.taskCount} incomplete task{member.taskCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text className="text-xs text-gray-600 mt-3">
                Assigning more tasks may be considered an abuse of administrative power. Please ensure this assignment is necessary.
              </Text>
            </View>

            <View className="flex-row justify-end gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowAbuseWarningModal(false);
                  setOverloadedMembers([]);
                }}
                className="px-5 py-2 rounded-lg border border-gray-300"
              >
                <Text className="text-gray-700 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowAbuseWarningModal(false);
                  createTaskWithAssignments();
                }}
                className="px-5 py-2 rounded-lg bg-orange-500"
              >
                <Text className="text-white font-semibold">Assign Anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Leave Group Confirmation Modal */}
      <Modal
        visible={showLeaveConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLeaveConfirmModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-2xl p-6 w-80 shadow-lg">
            <View className="items-center mb-4">
              <View className="bg-red-100 rounded-full p-4 mb-3">
                <Ionicons name="exit-outline" size={32} color="#EF4444" />
              </View>
              <Text className="text-xl font-bold text-gray-800 text-center">Leave Group?</Text>
            </View>
            
            <Text className="text-gray-600 text-center mb-6">
              Are you sure you want to leave "{group?.name}"? You can rejoin later using the group code.
            </Text>
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowLeaveConfirmModal(false)}
                className="flex-1 bg-gray-200 rounded-lg py-3"
              >
                <Text className="text-gray-800 text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={leaveGroup}
                className="flex-1 bg-red-500 rounded-lg py-3"
              >
                <Text className="text-white text-center font-semibold">Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal
        visible={showArchiveConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowArchiveConfirmModal(false);
          setSelectedTaskIdForArchive(null);
        }}
      >
        <View className="flex-1 bg-black/50 items-center justify-center">
          <View className="bg-white rounded-2xl p-6 mx-6 w-[85%]">
            <Text className="text-xl font-bold text-gray-800 mb-2">Archive Task</Text>
            <Text className="text-gray-600 mb-6">Are you sure you want to archive this task?</Text>
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowArchiveConfirmModal(false);
                  setSelectedTaskIdForArchive(null);
                }}
                className="flex-1 bg-gray-200 rounded-lg py-3"
              >
                <Text className="text-gray-800 text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => {
                  if (selectedTaskIdForArchive) {
                    archiveTask(selectedTaskIdForArchive);
                  }
                  setShowArchiveConfirmModal(false);
                  setSelectedTaskIdForArchive(null);
                }}
                className="flex-1 bg-red-500 rounded-lg py-3"
              >
                <Text className="text-white text-center font-semibold">Archive</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Unarchive Confirmation Modal */}
      <Modal
        visible={showUnarchiveConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowUnarchiveConfirmModal(false);
          setSelectedTaskIdForUnarchive(null);
        }}
      >
        <View className="flex-1 bg-black/50 items-center justify-center">
          <View className="bg-white rounded-2xl p-6 mx-6 w-[85%]">
            <Text className="text-xl font-bold text-gray-800 mb-2">Restore Task</Text>
            <Text className="text-gray-600 mb-6">Are you sure you want to restore this task to the main list?</Text>
            
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowUnarchiveConfirmModal(false);
                  setSelectedTaskIdForUnarchive(null);
                }}
                className="flex-1 bg-gray-200 rounded-lg py-3"
              >
                <Text className="text-gray-800 text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => {
                  if (selectedTaskIdForUnarchive) {
                    unarchiveTask(selectedTaskIdForUnarchive);
                  }
                  setShowUnarchiveConfirmModal(false);
                  setSelectedTaskIdForUnarchive(null);
                }}
                className="flex-1 bg-green-500 rounded-lg py-3"
              >
                <Text className="text-white text-center font-semibold">Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}