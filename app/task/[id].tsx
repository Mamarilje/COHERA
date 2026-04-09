import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getAuth } from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../src/Firebase/firebaseConfig';

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
  fileUrls?: string[];
  fileNames?: string[];
  groupId?: string;
};

type Member = {
  uid: string;
  name: string;
  email: string;
  profileImage?: string;
};

type TaskComment = {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userEmail: string;
  comment: string;
  createdAt: string;
};

export default function TaskDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [task, setTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingComment, setIsAddingComment] = useState(false);

  useEffect(() => {
    fetchTaskDetails();
  }, [id]);

  const fetchTaskDetails = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      
      // Fetch task
      const taskDoc = await getDoc(doc(db, 'tasks', id as string));
      if (!taskDoc.exists()) {
        Alert.alert('Error', 'Task not found');
        router.back();
        return;
      }

      const taskData = { id: taskDoc.id, ...taskDoc.data() } as Task;
      setTask(taskData);

      // Fetch group members if groupId exists
      if (taskData.groupId) {
        const groupDoc = await getDoc(doc(db, 'groups', taskData.groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          const membersData: Member[] = [];
          
          for (const memberId of groupData.members || []) {
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
        }
      }

      // Fetch comments
      const commentsRef = collection(db, 'taskComments');
      const q = query(commentsRef, where('taskId', '==', id), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const commentsData: TaskComment[] = [];
      snapshot.forEach((doc) => {
        commentsData.push({ id: doc.id, ...doc.data() } as TaskComment);
      });
      setComments(commentsData);
      
    } catch (error) {
      console.error('Error fetching task:', error);
      Alert.alert('Error', 'Failed to load task details');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTaskComplete = async () => {
    if (!task) return;
    
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        completed: !task.completed,
      });
      setTask({ ...task, completed: !task.completed });
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const deleteTask = async () => {
    if (!task) return;
    
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'tasks', task.id));
              Alert.alert('Success', 'Task deleted');
              router.back();
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task');
            }
          },
        },
      ]
    );
  };

  const addComment = async () => {
    if (!newComment.trim() || !task) return;

    setIsAddingComment(true);
    try {
      const commentData = {
        taskId: task.id,
        userId: currentUser?.uid,
        userName: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User',
        userEmail: currentUser?.email,
        comment: newComment.trim(),
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'taskComments'), commentData);
      setNewComment('');
      await fetchTaskDetails();
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setIsAddingComment(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-100 items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  if (!task) {
    return (
      <View className="flex-1 bg-gray-100 items-center justify-center">
        <Text className="text-gray-500">Task not found</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-100">
      <View className="px-5 pt-12 pb-20">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800 flex-1" numberOfLines={1}>
            Task Details
          </Text>
          <TouchableOpacity onPress={deleteTask}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Task Card */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          {/* Title and Status */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center flex-1">
              <TouchableOpacity onPress={toggleTaskComplete} className="mr-3">
                <Ionicons 
                  name={task.completed ? 'checkbox' : 'checkbox-outline'} 
                  size={28} 
                  color={task.completed ? '#22C55E' : '#9CA3AF'} 
                />
              </TouchableOpacity>
              <Text className={`text-2xl font-bold flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {task.title}
              </Text>
            </View>
          </View>

          {/* Status Badge */}
          <View className="mb-4">
            <View className={`self-start px-3 py-1 rounded-full border ${getPriorityColor(task.priority)}`}>
              <Text className={`text-sm font-semibold ${getPriorityColor(task.priority).split(' ')[0]}`}>
                {task.completed ? 'Completed' : 'In Progress'} • {task.priority} Priority
              </Text>
            </View>
          </View>

          {/* Due Date */}
          <View className="border-t border-gray-100 pt-4 mb-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="calendar-outline" size={18} color="#6B7280" />
              <Text className="text-gray-600 ml-2 font-semibold">Due Date</Text>
            </View>
            <Text className="text-gray-800 text-base">
              {new Date(task.deadline).toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Created by */}
          <View className="border-t border-gray-100 pt-4 mb-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="person-outline" size={18} color="#6B7280" />
              <Text className="text-gray-600 ml-2 font-semibold">Created by</Text>
            </View>
            <Text className="text-gray-800">
              You • {new Date(task.createdAt?.toDate?.() || task.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {/* Description */}
          {task.description ? (
            <View className="border-t border-gray-100 pt-4 mb-4">
              <Text className="text-gray-600 font-semibold mb-2">Description</Text>
              <Text className="text-gray-700 leading-5">{task.description}</Text>
            </View>
          ) : null}

          {/* Assigned To */}
          {members.length > 0 && task.assignedTo && task.assignedTo.length > 0 && (
            <View className="border-t border-gray-100 pt-4 mb-4">
              <Text className="text-gray-600 font-semibold mb-3">Assigned to</Text>
              <View className="flex-row flex-wrap gap-2">
                {task.assignedTo.map((memberId) => {
                  const member = members.find(m => m.uid === memberId);
                  return (
                    <View key={memberId} className="bg-gray-100 rounded-full px-3 py-2 flex-row items-center">
                      {member?.profileImage ? (
                        <Image source={{ uri: member.profileImage }} className="w-6 h-6 rounded-full mr-2" />
                      ) : (
                        <View className="w-6 h-6 bg-yellow-200 rounded-full items-center justify-center mr-2">
                          <Text className="text-yellow-700 font-bold text-xs">
                            {member?.name?.charAt(0).toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <Text className="text-gray-700 text-sm">{member?.name || memberId}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Attachments */}
          {task.fileUrls && task.fileUrls.length > 0 && (
            <View className="border-t border-gray-100 pt-4 mb-4">
              <Text className="text-gray-600 font-semibold mb-3">Attachments ({task.fileUrls.length})</Text>
              {task.fileUrls.map((url, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    Alert.alert('Open File', `Would you like to open this file?\n\n${task.fileNames?.[index] || 'File'}`);
                  }}
                  className="bg-gray-50 rounded-xl p-3 mb-2 flex-row items-center"
                >
                  <Ionicons name="document-attach" size={20} color="#EAB308" />
                  <Text className="text-gray-700 ml-2 flex-1" numberOfLines={1}>
                    {task.fileNames?.[index] || `File ${index + 1}`}
                  </Text>
                  <Ionicons name="open-outline" size={18} color="#6B7280" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Comments Section */}
        <View className="bg-white rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-bold text-gray-800 mb-4">
            Class comments ({comments.length})
          </Text>

          {/* Comments List */}
          <View className="space-y-4 mb-4">
            {comments.length === 0 ? (
              <Text className="text-gray-400 text-center py-4">No comments yet</Text>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} className="bg-gray-50 rounded-xl p-4">
                  <View className="flex-row items-center mb-2">
                    <View className="w-8 h-8 bg-yellow-200 rounded-full items-center justify-center mr-2">
                      <Text className="text-yellow-700 font-bold text-sm">
                        {comment.userName?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-800">{comment.userName}</Text>
                      <Text className="text-xs text-gray-400">
                        {new Date(comment.createdAt).toLocaleDateString()} • {new Date(comment.createdAt).toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-gray-700 ml-10">{comment.comment}</Text>
                </View>
              ))
            )}
          </View>

          {/* Add Comment Input */}
          <View className="border-t border-gray-200 pt-4">
            <TextInput
              className="border border-gray-300 rounded-xl p-3 mb-3"
              placeholder="Add a comment..."
              value={newComment}
              onChangeText={setNewComment}
              multiline
              placeholderTextColor="#9CA3AF"
            />
            <View className="flex-row justify-end">
              <TouchableOpacity
                onPress={addComment}
                disabled={isAddingComment || !newComment.trim()}
                className={`px-6 py-2 rounded-xl ${newComment.trim() ? 'bg-yellow-400' : 'bg-gray-200'}`}
              >
                {isAddingComment ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className={`font-semibold ${newComment.trim() ? 'text-white' : 'text-gray-400'}`}>
                    Post
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}