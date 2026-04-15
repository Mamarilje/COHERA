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
  Image,
  Platform,
  FlatList,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getAuth } from 'firebase/auth';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
import { supabase } from '../../src/Supabase/supabaseConfig';
import { firestore } from '../../src/Firebase/firebaseConfig';

type Task = {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  deadline: string;
  assignedTo: string[];
  completed: boolean;
  createdBy: string;
  createdAt: string;
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
  fileUrls?: string[];
  fileNames?: string[];
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
  const [commentFiles, setCommentFiles] = useState<{ name: string; uri: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [selectedDeadlineDate, setSelectedDeadlineDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedAMPM, setSelectedAMPM] = useState<'AM' | 'PM'>('AM');
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  
  // @mention states
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const descriptionInputRef = useRef<TextInput>(null);
  
  // Edit form states
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [editDeadline, setEditDeadline] = useState('');
  const [editFiles, setEditFiles] = useState<{ name: string; uri: string; url?: string }[]>([]);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTaskDetails();
  }, [id]);

  const fetchTaskDetails = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      
      const taskDoc = await getDoc(doc(db, 'tasks', id as string));
      if (!taskDoc.exists()) {
        Alert.alert('Error', 'Task not found');
        router.back();
        return;
      }

      const taskData = { id: taskDoc.id, ...taskDoc.data() } as Task;
      
      let creatorName = 'Unknown';
      try {
        const creatorDoc = await getDoc(doc(db, 'users', taskData.createdBy));
        if (creatorDoc.exists()) {
          creatorName = creatorDoc.data().name || creatorDoc.data().displayName || taskData.createdBy;
        }
      } catch (error) {
        console.error('Error fetching creator:', error);
      }
      taskData.createdBy = creatorName;
      
      setTask(taskData);

      // Debug file URLs
      if (taskData.fileUrls && taskData.fileUrls.length > 0) {
        console.log('=== TASK FILE URLS ===');
        taskData.fileUrls.forEach((url, index) => {
          console.log(`File ${index + 1}:`, url);
          console.log(`Name:`, taskData.fileNames?.[index]);
        });
      }

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

      const fetchComments = async () => {
        try {
          const commentsQuery = query(
            collection(firestore, 'comments'),
            where('taskId', '==', id),
            orderBy('createdAt', 'desc')
          );

          const commentsSnapshot = await getDocs(commentsQuery);
          const commentsData = commentsSnapshot.docs.map((doc) => ({
            id: doc.id,
            taskId: doc.data().taskId,
            userId: doc.data().userId,
            userName: doc.data().userName,
            userEmail: doc.data().userEmail,
            comment: doc.data().comment,
            createdAt: doc.data().createdAt,
            fileUrls: doc.data().fileUrls,
            fileNames: doc.data().fileNames,
          }));

          console.log('Fetched comments:', commentsData);
          setComments(commentsData);
        } catch (error) {
          console.error('Error fetching comments:', error);
          if (error instanceof Error && error.message.includes('permission-denied')) {
            Alert.alert('Permission Denied', 'You do not have access to view these comments.');
          } else {
            Alert.alert('Error', 'Failed to load comments. Please try again.');
          }
        }
      };

      fetchComments();
      
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

  const handleEditPress = () => {
    if (!task) return;
    
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditDeadline(task.deadline);
    setSelectedDeadlineDate(new Date(task.deadline));
    
    const date = new Date(task.deadline);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const isPM = hours >= 12;
    let hours12 = hours % 12;
    if (hours12 === 0) hours12 = 12;
    setSelectedHour(hours12);
    setSelectedMinute(minutes);
    setSelectedAMPM(isPM ? 'PM' : 'AM');
    
    const existingFiles = (task.fileUrls || []).map((url, index) => ({
      name: task.fileNames?.[index] || `File ${index + 1}`,
      uri: url,
      url: url,
    }));
    setEditFiles(existingFiles);
    setShowEditModal(true);
  };

  const handleDescriptionChange = (text: string) => {
    setEditDescription(text);
    
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === text.length - 1) {
      setShowMentions(true);
      setMentionQuery('');
    } else if (lastAtIndex !== -1 && lastAtIndex > text.length - 30) {
      const query = text.substring(lastAtIndex + 1);
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

  // Helper function to get MIME type
  const getMimeType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'txt': 'text/plain',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'zip': 'application/zip',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
    };
    return mimeTypes[extension] || 'application/octet-stream';
  };

  // Helper function to check if file is an image
  const isImageFile = (fileName: string): boolean => {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(extension);
  };

  // Optional: Save image to gallery (requires expo-media-library)
  const saveToGallery = async (filePath: string) => {
    try {
      const MediaLibrary = require('expo-media-library');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(filePath);
        await MediaLibrary.createAlbumAsync('Download', asset, false);
        Alert.alert('Success', 'Image saved to gallery');
      }
    } catch (error) {
      console.error('Error saving to gallery:', error);
    }
  };


const downloadFile = async (fileUrl: string, fileName: string) => {
  if (!fileUrl) {
    Alert.alert('Error', 'No file URL provided');
    return;
  }

  setDownloadingFile(fileName);

  try {
    console.log('Starting download for:', fileName);
    console.log('File URL:', fileUrl);

    // Web handling
    if (Platform.OS === 'web') {
      window.open(fileUrl, '_blank');
      setDownloadingFile(null);
      return;
    }

    const isSharingAvailable = await Sharing.isAvailableAsync();

    if (!isSharingAvailable) {
      const canOpen = await Linking.canOpenURL(fileUrl);
      if (canOpen) {
        await Linking.openURL(fileUrl);
      } else {
        Alert.alert('Error', 'Cannot open this file type');
      }
      setDownloadingFile(null);
      return;
    }

    const cacheDir = FileSystem.cacheDirectory || '';
    let downloadDir = cacheDir + 'Download/';

    try {
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDir, {
          intermediates: true,
        });
      }
    } catch (error) {
      console.error('Error creating directory:', error);
      downloadDir = cacheDir;
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${Date.now()}_${safeFileName}`;
    const filePath = downloadDir + uniqueFileName;

    console.log('Downloading to:', filePath);

    const downloadResult = await FileSystem.downloadAsync(fileUrl, filePath);

    if (downloadResult.status === 200) {
      console.log('Download completed successfully');

      Alert.alert(
        'Download Complete',
        `${fileName} has been downloaded successfully.`,
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Open',
            onPress: async () => {
              try {
                await Sharing.shareAsync(filePath, {
                  mimeType: getMimeType(fileName),
                  dialogTitle: `Open ${fileName}`,
                });
              } catch (error) {
                console.error('Error sharing file:', error);
                Alert.alert('Error', 'Could not open the file');
              }
            },
          },
        ]
      );
    } else {
      throw new Error(`Download failed with status: ${downloadResult.status}`);
    }
  } catch (error: any) {
    console.error('Download error details:', error);

    try {
      const canOpen = await Linking.canOpenURL(fileUrl);
      if (canOpen) {
        Alert.alert(
          'Download Failed',
          'Would you like to open the file in browser instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open in Browser',
              onPress: () => Linking.openURL(fileUrl),
            },
          ]
        );
      } else {
        Alert.alert(
          'Download Failed',
          `Could not download "${fileName}". ${
            error.message || 'Please try again.'
          }`
        );
      }
    } catch {
      Alert.alert(
        'Download Failed',
        `Could not download "${fileName}". Please check your internet connection and try again.`
      );
    }
  } finally {
    setDownloadingFile(null);
  }
};
  

  const uploadFiles = async (files: { name: string; uri: string }[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const file of files) {
      try {
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${timestamp}-${safeFileName}`;
        const folderPath = `tasks/${task?.groupId || 'general'}/${currentUser?.uid}`;
        const fullPath = `${folderPath}/${fileName}`;

        console.log('Uploading to path:', fullPath);

        const response = await fetch(file.uri);
        const blob = await response.blob();

        console.log('File size:', blob.size, 'bytes');

        const { error, data } = await supabase.storage
          .from('task-files')
          .upload(fullPath, blob, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          console.error('Supabase upload error:', error);
          Alert.alert('Upload Error', `Failed to upload ${file.name}: ${error.message}`);
          continue;
        }

        console.log('Upload successful:', data);

        const { data: publicUrlData } = supabase.storage
          .from('task-files')
          .getPublicUrl(fullPath);

        if (publicUrlData?.publicUrl) {
          console.log('Public URL:', publicUrlData.publicUrl);
          uploadedUrls.push(publicUrlData.publicUrl);
        } else {
          console.error('Failed to get public URL for:', fullPath);
        }
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        Alert.alert('Upload Error', `Failed to upload ${file.name}`);
      }
    }

    return uploadedUrls;
  };

  const updateTask = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    if (!editDeadline) {
      Alert.alert('Error', 'Please select a deadline');
      return;
    }

    setIsUploading(true);
    
    try {
      const newFiles = editFiles.filter(f => !f.url);
      let uploadedUrls: string[] = [];
      
      if (newFiles.length > 0) {
        Alert.alert('Uploading', `Uploading ${newFiles.length} file(s)...`);
        uploadedUrls = await uploadFiles(newFiles);
      }
      
      const existingUrls = editFiles.filter(f => f.url).map(f => f.url!);
      const allFileUrls = [...existingUrls, ...uploadedUrls];
      const allFileNames = editFiles.map(f => f.name);
      
      await updateDoc(doc(db, 'tasks', task!.id), {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        deadline: editDeadline,
        ...(allFileUrls.length > 0 && { fileUrls: allFileUrls }),
        ...(allFileNames.length > 0 && { fileNames: allFileNames }),
      });
      
      Alert.alert('Success', 'Task updated successfully');
      setShowEditModal(false);
      fetchTaskDetails();
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddComment = async () => {
    if (!task || (!newComment.trim() && commentFiles.length === 0)) return;

    setIsAddingComment(true);
    
    try {
      let uploadedUrls: string[] = [];
      let uploadedNames: string[] = [];
      
      if (commentFiles.length > 0) {
        const uploadedFiles = await uploadFiles(commentFiles);
        uploadedUrls = uploadedFiles;
        uploadedNames = commentFiles.map(f => f.name);
      }
      
      const commentData = {
        taskId: task.id,
        userId: currentUser?.uid || '',
        userName: currentUser?.displayName || 'Anonymous',
        userEmail: currentUser?.email || '',
        comment: newComment,
        createdAt: new Date().toISOString(),
        fileUrls: uploadedUrls,
        fileNames: uploadedNames,
      };
      
      const docRef = await addDoc(collection(firestore, 'comments'), commentData);
      
      const newCommentObj: TaskComment = {
        id: docRef.id,
        ...commentData,
      };
      setComments(prev => [newCommentObj, ...prev]);
      
      setNewComment('');
      setCommentFiles([]);
      
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
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

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-500';
      case 'Medium':
        return 'bg-yellow-500';
      case 'Low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const renderDescriptionWithMentions = (description: string) => {
    if (!description) return null;
    
    const parts = description.split(/(@\w+)/g);
    return (
      <Text className="text-gray-700 leading-5">
        {parts.map((part, index) => {
          if (part.startsWith('@')) {
            return (
              <Text key={index} className="text-yellow-600 font-semibold">
                {part}
              </Text>
            );
          }
          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    );
  };

  // Get file icon based on extension
  const getFileIcon = (fileName: string, isDownloading: boolean) => {
    if (isDownloading) return null;
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension || '')) {
      return <Ionicons name="image-outline" size={20} color="#EAB308" />;
    } else if (fileExtension === 'pdf') {
      return <Ionicons name="document-text-outline" size={20} color="#EAB308" />;
    } else if (['doc', 'docx'].includes(fileExtension || '')) {
      return <Ionicons name="document-outline" size={20} color="#EAB308" />;
    } else {
      return <Ionicons name="download-outline" size={20} color="#EAB308" />;
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
    <View className="flex-1 bg-gray-100">
      <ScrollView className="flex-1">
        <View className="px-5 pt-12 pb-20">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity onPress={() => router.back()} className="mr-4">
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-800 flex-1" numberOfLines={1}>
              Task Details
            </Text>
            <TouchableOpacity onPress={handleEditPress} className="mr-3">
              <Ionicons name="create-outline" size={24} color="#EAB308" />
            </TouchableOpacity>
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
                {typeof task.createdBy === 'string' ? task.createdBy : 'Unknown'} • {new Date(task.createdAt).toLocaleDateString()}
              </Text>
            </View>

            {/* Description with mention highlighting */}
            {task.description ? (
              <View className="border-t border-gray-100 pt-4 mb-4">
                <Text className="text-gray-600 font-semibold mb-2">Description</Text>
                {renderDescriptionWithMentions(task.description)}
              </View>
            ) : null}

            {/* Attachments - Clickable to download */}
            {task.fileUrls && task.fileUrls.length > 0 && (
              <View className="border-t border-gray-100 pt-4">
                <Text className="text-gray-600 font-semibold mb-3">
                  Attachments ({task.fileUrls.length})
                </Text>
                {task.fileUrls.map((url, index) => {
                  const fileName = task.fileNames?.[index] || `File ${index + 1}`;
                  const isDownloading = downloadingFile === fileName;
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => downloadFile(url, fileName)}
                      disabled={isDownloading}
                      className={`bg-gray-50 rounded-xl p-3 mb-2 flex-row items-center ${
                        isDownloading ? 'opacity-70' : ''
                      }`}
                    >
                      {isDownloading ? (
                        <ActivityIndicator size="small" color="#EAB308" />
                      ) : (
                        getFileIcon(fileName, false)
                      )}
                      <Text className="text-gray-700 ml-2 flex-1" numberOfLines={1}>
                        {fileName}
                      </Text>
                      <View className="flex-row items-center">
                        {!isDownloading && (
                          <Ionicons name="open-outline" size={18} color="#6B7280" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Comments Section */}
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            <Text className="text-lg font-bold text-gray-800 mb-4">
              Comments ({comments.length})
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
                    {comment.comment ? (
                      <Text className="text-gray-700 ml-10">{comment.comment}</Text>
                    ) : null}
                    
                    {/* Comment Attachments - Clickable to download */}
                    {comment.fileUrls && comment.fileUrls.length > 0 && (
                      <View className="ml-10 mt-2">
                        {comment.fileUrls.map((url, idx) => {
                          const fileName = comment.fileNames?.[idx] || `Attachment ${idx + 1}`;
                          const isDownloading = downloadingFile === fileName;
                          
                          return (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => downloadFile(url, fileName)}
                              disabled={isDownloading}
                              className="flex-row items-center bg-white rounded-lg p-2 mt-1"
                            >
                              {isDownloading ? (
                                <ActivityIndicator size="small" color="#EAB308" />
                              ) : (
                                <Ionicons name="download-outline" size={14} color="#EAB308" />
                              )}
                              <Text className="text-xs text-gray-600 ml-1" numberOfLines={1}>
                                {fileName}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
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
              
              {commentFiles.length > 0 && (
                <View className="mb-3">
                  {commentFiles.map((file, index) => (
                    <View key={index} className="flex-row items-center justify-between bg-gray-50 rounded-lg p-2 mb-1">
                      <View className="flex-row items-center flex-1">
                        <Ionicons name="document-text" size={16} color="#EAB308" />
                        <Text className="text-xs text-gray-600 ml-2 flex-1" numberOfLines={1}>
                          {file.name}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setCommentFiles(commentFiles.filter((_, i) => i !== index))}>
                        <Ionicons name="close-circle" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              
              <View className="flex-row justify-between items-center">
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
                        setCommentFiles([...commentFiles, ...newFiles]);
                      }
                    } catch (error) {
                      console.error('Error picking files:', error);
                    }
                  }}
                  className="flex-row items-center"
                >
                  <Ionicons name="attach-outline" size={24} color="#EAB308" />
                  <Text className="text-xs text-amber-500 ml-1">Add file</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={handleAddComment}
                  disabled={isAddingComment || (!newComment.trim() && commentFiles.length === 0)}
                  className={`px-6 py-2 rounded-xl ${(newComment.trim() || commentFiles.length > 0) ? 'bg-yellow-400' : 'bg-gray-200'}`}
                >
                  {isAddingComment ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className={`font-semibold ${(newComment.trim() || commentFiles.length > 0) ? 'text-white' : 'text-gray-400'}`}>
                      Post
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Edit Task Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-800">Edit Task</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
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
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Description Input with @mention */}
              <View className="mb-4 relative">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Description (Use @ to mention team members)
                </Text>
                <TextInput
                  ref={descriptionInputRef}
                  className="border border-gray-300 rounded-lg p-3 h-32"
                  placeholder="Enter task description... Use @ to mention someone"
                  value={editDescription}
                  onChangeText={handleDescriptionChange}
                  multiline
                  placeholderTextColor="#9CA3AF"
                />
                
                {/* Mention Suggestions Modal */}
                {showMentions && members.length > 0 && (
                  <View className="absolute top-24 left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-100 max-h-64 z-10">
                    <FlatList
                      data={members.filter(m => !mentionQuery || m.name.toLowerCase().includes(mentionQuery.toLowerCase()) || m.email.toLowerCase().includes(mentionQuery.toLowerCase()))}
                      keyExtractor={(item) => item.uid}
                      ListHeaderComponent={
                        (!mentionQuery || 'everyone'.includes(mentionQuery.toLowerCase())) ? (
                          <TouchableOpacity
                            onPress={() => {
                              const beforeMention = editDescription.substring(0, editDescription.lastIndexOf('@'));
                              const mentionText = `@everyone `;
                              const newDescription = beforeMention + mentionText;
                              setEditDescription(newDescription);
                              setShowMentions(false);
                              setTimeout(() => {
                                descriptionInputRef.current?.focus();
                              }, 100);
                            }}
                            className="flex-row items-center px-4 py-3 border-b border-gray-50 active:bg-gray-50"
                          >
                            <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-3">
                              <Ionicons name="people" size={20} color="#9333EA" />
                            </View>
                            <View className="flex-1">
                              <Text className="font-semibold text-gray-800 text-base">
                                Mention everyone in this chat
                              </Text>
                              <Text className="text-xs text-gray-400 mt-0.5">
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
                            const beforeMention = editDescription.substring(0, editDescription.lastIndexOf('@'));
                            const mentionText = `@${item.name} `;
                            const newDescription = beforeMention + mentionText;
                            setEditDescription(newDescription);
                            setShowMentions(false);
                            setTimeout(() => {
                              descriptionInputRef.current?.focus();
                            }, 100);
                          }}
                          className="flex-row items-center px-4 py-3 border-b border-gray-50 active:bg-gray-50"
                        >
                          {item.profileImage ? (
                            <Image source={{ uri: item.profileImage }} className="w-10 h-10 rounded-full mr-3" />
                          ) : (
                            <View className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full items-center justify-center mr-3">
                              <Text className="text-white font-bold text-base">
                                {item.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          
                          <View className="flex-1">
                            <Text className="font-semibold text-gray-800 text-base">
                              {item.name}
                            </Text>
                            {item.email && (
                              <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
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
                )}
              </View>

              {/* File Upload */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700">
                    Files ({editFiles.length})
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
                        setEditFiles([...editFiles, ...newFiles]);
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
                    {editFiles.length} file(s) selected
                  </Text>
                </TouchableOpacity>

                {editFiles.length > 0 && (
                  <View className="bg-gray-50 rounded-lg p-3 gap-2">
                    {editFiles.map((file, index) => (
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
                            setEditFiles(editFiles.filter((_, i) => i !== index));
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
                    <View className="flex-row items-center gap-2">
                      <View className={`w-3 h-3 rounded-full ${getPriorityBadgeColor(editPriority)}`} />
                      <Text className="text-gray-700 font-semibold">
                        {editPriority}
                      </Text>
                    </View>
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
                    setShowDeadlinePicker(true);
                  }}
                >
                  <View className="flex-row justify-between items-center">
                    <Text className="text-gray-700 font-semibold">
                      {new Date(editDeadline).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3 mt-6">
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-3"
                >
                  <Text className="text-center text-gray-700 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={updateTask}
                  disabled={isUploading}
                  className={`flex-1 rounded-lg py-3 ${isUploading ? 'bg-yellow-300' : 'bg-yellow-400'}`}
                >
                  {isUploading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-center text-white font-semibold">Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
                    setEditPriority(level);
                    setShowPriorityPicker(false);
                  }}
                  className={`border rounded-lg p-4 ${
                    editPriority === level
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
                        editPriority === level
                          ? 'text-yellow-700'
                          : 'text-gray-700'
                      }`}>
                        {level}
                      </Text>
                    </View>
                    {editPriority === level && (
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

            <ScrollView>
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
            </ScrollView>

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

                  setEditDeadline(finalDate.toISOString());
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
    </View>
  );
}
