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
import * as FileSystem from 'expo-file-system/legacy';
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
import {
  notifyAdminMemberSubmitted,
  notifyAdminMemberCommented,
  notifyMemberWorkReviewed,
} from '../../src/utils/notificationHelper';

type Task = {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  deadline: string;
  assignedTo: string[];
  completed: boolean;
  completedBy?: string[]; // Track which assigned members completed it
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
  fileUrls?: string[];
  fileNames?: string[];
};

type TaskSubmission = {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userEmail: string;
  link?: string;
  fileUrls?: string[];
  fileNames?: string[];
  photoUrls?: string[];
  note: string;
  status: 'Complete' | 'Progress';
  createdAt: string;
  profileImage?: string;
  adminReview?: {
    status: 'Approved' | 'Need Revise';
    note?: string;
    reviewedBy: string;
    reviewedAt: string;
  };
};

export default function TaskDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [task, setTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<'submissions' | 'discussion'>('submissions');
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [submissionLink, setSubmissionLink] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<'Complete' | 'Progress'>('Progress');
  const [submissionFiles, setSubmissionFiles] = useState<{ name: string; uri: string }[]>([]);
  const [submissionPhotos, setSubmissionPhotos] = useState<{ name: string; uri: string }[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentFiles, setCommentFiles] = useState<{ name: string; uri: string }[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedSubmissionForReview, setSelectedSubmissionForReview] = useState<TaskSubmission | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'Approved' | 'Need Revise'>('Approved');
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
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
  
  // Task overload warning state
  const [showOverloadWarning, setShowOverloadWarning] = useState(false);
  const [memberTaskCount, setMemberTaskCount] = useState(0);
  
  // Edit form states
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [editDeadline, setEditDeadline] = useState('');
  const [editFiles, setEditFiles] = useState<{ name: string; uri: string; url?: string }[]>([]);

  const [refreshing, setRefreshing] = useState(false);
  
  // Task completion confirmation modal state
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);

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
      
      // Store creator name separately, keep createdBy as UID for admin checks
      (taskData as any).creatorName = creatorName;
      
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
      
      // Fetch submissions
      const fetchSubmissions = async () => {
        try {
          const submissionsQuery = query(
            collection(firestore, 'submissions'),
            where('taskId', '==', id)
          );

          const submissionsSnapshot = await getDocs(submissionsQuery);
          const submissionsData = submissionsSnapshot.docs
            .map((doc) => ({
              id: doc.id,
              taskId: doc.data().taskId,
              userId: doc.data().userId,
              userName: doc.data().userName,
              userEmail: doc.data().userEmail,
              link: doc.data().link,
              fileUrls: doc.data().fileUrls,
              fileNames: doc.data().fileNames,
              photoUrls: doc.data().photoUrls,
              note: doc.data().note,
              status: doc.data().status,
              createdAt: doc.data().createdAt,
              profileImage: members.find(m => m.uid === doc.data().userId)?.profileImage,
              adminReview: doc.data().adminReview,
            }))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          setSubmissions(submissionsData);
        } catch (error) {
          console.error('Error fetching submissions:', error);
        }
      };

      fetchSubmissions();
      
      // Check if current user has task overload
      if (taskData && taskData.assignedTo && taskData.assignedTo.includes(currentUser?.uid || '')) {
        checkTaskOverload(taskData);
      }
      
    } catch (error) {
      console.error('Error fetching task:', error);
      Alert.alert('Error', 'Failed to load task details');
    } finally {
      setIsLoading(false);
    }
  };

  const checkTaskOverload = async (taskData: Task) => {
    if (!taskData?.groupId || !currentUser?.uid) return;
    
    try {
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('groupId', '==', taskData.groupId),
        where('assignedTo', 'array-contains', currentUser.uid),
        where('completed', '==', false)
      );
      
      const tasksSnapshot = await getDocs(tasksQuery);
      const incompleteCount = tasksSnapshot.size;
      
      if (incompleteCount >= 3 && incompleteCount <= 4) {
        setMemberTaskCount(incompleteCount);
        setShowOverloadWarning(true);
      }
    } catch (error) {
      console.error('Error checking task overload:', error);
    }
  };

  const toggleTaskComplete = async () => {
    if (!task) return;
    
    // Only admin can mark tasks as complete
    if (currentUser?.uid !== task.createdBy) {
      Alert.alert('Error', 'Only the task creator can mark it as complete');
      return;
    }
    
    try {
      setIsMarkingComplete(true);
      
      // Add current user to completedBy array
      const completedBy = task.completedBy || [];
      
      await updateDoc(doc(db, 'tasks', task.id), {
        completedBy: completedBy,
        completed: true, // Mark global task as complete when admin manually completes it
      });
      
      setTask({ ...task, completed: true, completedBy });
      setShowCompleteConfirmModal(false);
      Alert.alert('Success', 'Task marked as complete');
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to mark task as complete');
    } finally {
      setIsMarkingComplete(false);
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


// Helper function to download with retry logic
const downloadWithRetry = async (url: string, filePath: string, maxRetries: number = 3): Promise<any> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Download attempt ${attempt + 1}/${maxRetries} for: ${filePath}`);
      const result = await FileSystem.downloadAsync(url, filePath);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`Download attempt ${attempt + 1} failed:`, error);
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
};

// Helper function to validate file size before download
const validateFileSize = async (fileUrl: string, maxSizeMB: number = 200): Promise<boolean> => {
  try {
    const response = await fetch(fileUrl, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    
    if (contentLength) {
      const fileSizeMB = parseInt(contentLength) / (1024 * 1024);
      if (fileSizeMB > maxSizeMB) {
        Alert.alert(
          'File Too Large',
          `File size is ${fileSizeMB.toFixed(2)}MB. Maximum allowed is ${maxSizeMB}MB.`,
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  } catch (error) {
    console.log('Could not validate file size (continuing anyway):', error);
    return true; // Continue if validation fails
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

    // Validate file size first
    const isValidSize = await validateFileSize(fileUrl, 200);
    if (!isValidSize) {
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

    // Get directories with proper fallback for Expo Go
    let downloadDir = '';
    let useBasePath = false;

    // Try to access Downloads folder first (for physical devices)
    if (Platform.OS === 'android') {
      try {
        // Try common Android Downloads path
        const downloadsPath = '/storage/emulated/0/Download/';
        console.log('Trying Android Downloads path:', downloadsPath);
        downloadDir = downloadsPath;
      } catch (e) {
        console.log('Android Downloads path error:', e);
      }
    }

    // Fallback to document directory
    if (!downloadDir) {
      try {
        const docDir = FileSystem.documentDirectory;
        console.log('documentDirectory:', docDir);
        if (docDir && docDir.trim() !== '') {
          downloadDir = docDir;
        }
      } catch (e) {
        console.log('documentDirectory error:', e);
      }
    }

    // Fallback to cache directory
    if (!downloadDir) {
      try {
        const cacheDir = FileSystem.cacheDirectory;
        console.log('cacheDirectory:', cacheDir);
        if (cacheDir && cacheDir.trim() !== '') {
          downloadDir = cacheDir;
        }
      } catch (e) {
        console.log('cacheDirectory error:', e);
      }
    }

    // Fallback to temporary directory
    if (!downloadDir) {
      try {
        const tempDir = (FileSystem as any).temporaryDirectory;
        console.log('temporaryDirectory:', tempDir);
        if (tempDir && tempDir.trim() !== '') {
          downloadDir = tempDir;
        }
      } catch (e) {
        console.log('temporaryDirectory error:', e);
      }
    }

    // Try to use raw temp path as last resort
    if (!downloadDir) {
      console.log('Trying raw temp path approach');
      downloadDir = '/tmp/';
      useBasePath = true;
    }

    console.log('Final downloadDir:', downloadDir, 'useBasePath:', useBasePath);

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${Date.now()}_${safeFileName}`;
    
    // Create file path
    let filePath = '';
    if (useBasePath) {
      filePath = uniqueFileName; // Simple filename for /tmp
    } else {
      filePath = downloadDir + uniqueFileName;
    }

    console.log('File will be saved to:', filePath);
    console.log('Safe file name:', safeFileName);

    try {
      // Try to download the file
      const downloadResult = await downloadWithRetry(fileUrl, filePath, 3);

      if (downloadResult.status === 200) {
        console.log('Download completed successfully');
        console.log('File saved at:', filePath);

        // If we used base path, we need to get the full path for sharing
        let fullFilePath = filePath;
        if (useBasePath && downloadDir) {
          fullFilePath = downloadDir + filePath;
        }

        // Check if saved to Downloads folder
        const isInDownloads = downloadDir && downloadDir.includes('Download');

        // For Android, use share to allow saving
        if (Platform.OS === 'android') {
          try {
            // If already in Downloads folder, just show success
            if (isInDownloads) {
              Alert.alert(
                '✅ Download Complete',
                `${fileName}\n\nFile saved to your Downloads folder.`,
                [
                  { text: 'OK', style: 'default' },
                  {
                    text: 'Open in Files',
                    onPress: () => {
                      // Try to open file manager
                      Linking.openURL('content://com.android.externalstorage.documents/root/Download');
                    },
                  },
                ]
              );
            } else {
              // Show share dialog to save to Downloads
              await Sharing.shareAsync(fullFilePath, {
                mimeType: getMimeType(fileName),
                dialogTitle: `Save ${fileName} to Downloads`,
              });
              
              Alert.alert(
                'Download Successful',
                `${fileName} is ready to save.\n\nTap "Save" to add it to your Downloads folder.`,
                [{ text: 'OK' }]
              );
            }
          } catch (shareError) {
            console.error('Share error:', shareError);
            Alert.alert(
              'Download Successful',
              `${fileName} has been downloaded and saved to your device.`,
              [{ text: 'OK' }]
            );
          }
        } else {
          // iOS
          Alert.alert(
            'Download Complete',
            `${fileName} downloaded successfully.\n\nTap "Open" to view the file.`,
            [
              { text: 'Close', style: 'cancel' },
              {
                text: 'Open',
                onPress: async () => {
                  try {
                    await Sharing.shareAsync(fullFilePath, {
                      mimeType: getMimeType(fileName),
                      dialogTitle: `Open ${fileName}`,
                    });
                  } catch (error) {
                    console.error('Error opening file:', error);
                    Alert.alert('Error', 'Could not open the file');
                  }
                },
              },
            ]
          );
        }
      } else {
        throw new Error(`Download failed with status: ${downloadResult.status}`);
      }
    } catch (downloadError) {
      console.error('Download error:', downloadError);
      throw downloadError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    console.error('Download error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Suggest browser fallback since directories weren't available
    Alert.alert(
      'Download Not Available',
      'Your device does not support local file saving. You can open the file in your browser instead, where you can save it normally.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open in Browser',
          onPress: () => Linking.openURL(fileUrl),
        },
      ]
    );
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

      // Fetch the actual user name from the database
      let userName = currentUser?.displayName || 'Anonymous';
      try {
        if (currentUser?.uid) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            userName = userDoc.data().name || userDoc.data().displayName || currentUser.displayName || 'Anonymous';
          }
        }
      } catch (error) {
        console.error('Error fetching user name:', error);
        // Fall back to displayName if fetch fails
      }
      
      const commentData = {
        taskId: task.id,
        userId: currentUser?.uid || '',
        userName: userName,
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
      
      // Notify admin that member commented on task
      if (task.createdBy && task.createdBy !== currentUser?.uid) {
        await notifyAdminMemberCommented(
          task.createdBy,
          userName,
          task.title,
          task.id,
          task.groupId || '',
          currentUser?.uid || ''
        );
      }
      
      setNewComment('');
      setCommentFiles([]);
      
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleAddSubmission = async () => {
    if (!task || !submissionNote.trim()) {
      Alert.alert('Error', 'Please add a note to your submission');
      return;
    }

    setIsAddingComment(true);
    
    try {
      let uploadedFileUrls: string[] = [];
      let uploadedFileNames: string[] = [];
      let uploadedPhotoUrls: string[] = [];
      
      if (submissionFiles.length > 0) {
        const uploadedFiles = await uploadFiles(submissionFiles);
        uploadedFileUrls = uploadedFiles;
        uploadedFileNames = submissionFiles.map(f => f.name);
      }
      
      if (submissionPhotos.length > 0) {
        uploadedPhotoUrls = await uploadFiles(submissionPhotos);
      }

      // Fetch the actual user name from the database
      let userName = currentUser?.displayName || 'Anonymous';
      try {
        if (currentUser?.uid) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            userName = userDoc.data().name || userDoc.data().displayName || currentUser.displayName || 'Anonymous';
          }
        }
      } catch (error) {
        console.error('Error fetching user name:', error);
        // Fall back to displayName if fetch fails
      }
      
      const submissionData: any = {
        taskId: task.id,
        userId: currentUser?.uid || '',
        userName: userName,
        userEmail: currentUser?.email || '',
        note: submissionNote,
        status: submissionStatus,
        createdAt: new Date().toISOString(),
        taskCreatedBy: task.createdBy || '',
      };

      // Only add optional fields if they have values
      if (submissionLink.trim()) {
        submissionData.link = submissionLink;
      }
      if (uploadedFileUrls.length > 0) {
        submissionData.fileUrls = uploadedFileUrls;
        submissionData.fileNames = uploadedFileNames;
      }
      if (uploadedPhotoUrls.length > 0) {
        submissionData.photoUrls = uploadedPhotoUrls;
      }
      
      const docRef = await addDoc(collection(firestore, 'submissions'), submissionData);
      
      const newSubmissionObj: TaskSubmission = {
        id: docRef.id,
        ...submissionData,
        profileImage: members.find(m => m.uid === currentUser?.uid)?.profileImage,
      };
      setSubmissions(prev => [newSubmissionObj, ...prev]);
      
      // Notify admin that member submitted work
      if (task.createdBy) {
        await notifyAdminMemberSubmitted(
          task.createdBy,
          userName,
          currentUser?.email || '',
          task.id,
          task.title,
          task.groupId || '',
          currentUser?.uid || ''
        );
      }
      
      setSubmissionLink('');
      setSubmissionNote('');
      setSubmissionStatus('Progress');
      setSubmissionFiles([]);
      setSubmissionPhotos([]);
      setShowSubmissionModal(false);
      
      Alert.alert('Success', 'Your submission has been uploaded');
      
    } catch (error) {
      console.error('Error adding submission:', error);
      Alert.alert('Error', 'Failed to upload submission. Please try again.');
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleReviewSubmission = async () => {
    if (!task || !selectedSubmissionForReview) {
      Alert.alert('Error', 'No submission selected');
      return;
    }

    setIsSubmittingReview(true);

    try {
      const reviewData = {
        adminReview: {
          status: reviewStatus,
          note: reviewNote || undefined,
          reviewedBy: currentUser?.uid || '',
          reviewedAt: new Date().toISOString(),
        },
      };

      // Update submission with admin review
      await updateDoc(doc(firestore, 'submissions', selectedSubmissionForReview.id), reviewData);

      // Notify member that their work was reviewed
      const adminName = currentUser?.displayName || 'Admin';
      await notifyMemberWorkReviewed(
        selectedSubmissionForReview.userId,
        reviewStatus,
        task.title,
        task.id,
        task.groupId || '',
        adminName,
        currentUser?.uid || '',
        reviewNote
      );

      // If admin approves, add the submitting user to the completedBy array
      if (reviewStatus === 'Approved') {
        const completedBy = task.completedBy || [];
        const submittingUserId = selectedSubmissionForReview.userId;
        
        // Add user to completedBy if not already there
        if (!completedBy.includes(submittingUserId)) {
          completedBy.push(submittingUserId);
          
          // Check if all assigned members have now completed the task
          const assignedMembers = task.assignedTo || [];
          const allMembersCompleted = assignedMembers.length > 0 && completedBy.length === assignedMembers.length;
          
          // Update task with the new completedBy array, and mark as completed if all members are done
          const updateData: any = {
            completedBy: completedBy,
          };
          
          if (allMembersCompleted) {
            updateData.completed = true;
          }
          
          await updateDoc(doc(db, 'tasks', task.id), updateData);
          
          // Update the task locally
          setTask({ ...task, completedBy, ...(allMembersCompleted && { completed: true }) });
        }
        
        // Update the submission object locally
        setSubmissions(prev =>
          prev.map(sub =>
            sub.id === selectedSubmissionForReview.id
              ? { ...sub, adminReview: reviewData.adminReview }
              : sub
          )
        );
      } else {
        // For revisions needed, just update the submission
        setSubmissions(prev =>
          prev.map(sub =>
            sub.id === selectedSubmissionForReview.id
              ? { ...sub, adminReview: reviewData.adminReview }
              : sub
          )
        );
      }

      setShowReviewModal(false);
      setSelectedSubmissionForReview(null);
      setReviewStatus('Approved');
      setReviewNote('');

      // After approval, check if all members have completed
      if (reviewStatus === 'Approved') {
        const completedBy = task.completedBy || [];
        const submittingUserId = selectedSubmissionForReview.userId;
        const newCompletedCount = completedBy.includes(submittingUserId) ? completedBy.length : completedBy.length + 1;
        const assignedCount = task.assignedTo?.length || 0;
        const isTaskFullyCompleted = newCompletedCount === assignedCount;

        Alert.alert(
          'Success',
          `Submission has been marked as "${reviewStatus}"${reviewNote ? ' with a note' : ''}${isTaskFullyCompleted ? ' - All assigned members completed, task marked as complete' : reviewStatus === 'Approved' ? ' - Member task marked as complete' : ''}`
        );
      } else {
        Alert.alert(
          'Success',
          `Submission has been marked as "${reviewStatus}"${reviewNote ? ' with a note' : ''}`
        );
      }
    } catch (error) {
      console.error('Error reviewing submission:', error);
      Alert.alert('Error', 'Failed to review submission. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const openReviewModal = (submission: TaskSubmission) => {
    setSelectedSubmissionForReview(submission);
    setReviewStatus(submission.adminReview?.status || 'Approved');
    setReviewNote(submission.adminReview?.note || '');
    setShowReviewModal(true);
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
            {/* Overload Warning Banner */}
            {showOverloadWarning && (
              <View className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-4">
                <View className="flex-row items-start gap-3">
                  <Ionicons name="warning" size={20} color="#EF4444" />
                  <View className="flex-1">
                    <Text className="font-bold text-red-700 mb-1">Task Overload Alert</Text>
                    <Text className="text-sm text-red-600">
                      You have {memberTaskCount} incomplete task{memberTaskCount !== 1 ? 's' : ''} assigned to you. Your admin may have assigned too many tasks at once. Please communicate if you need support.
                    </Text>
                  </View>
                </View>
              </View>
            )}
            
            {/* Title and Status */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center flex-1">
                  {(task.completed || (task.completedBy && task.completedBy.length > 0)) && (
                    <View className="mr-3">
                      <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                    </View>
                  )}
                  <Text className={`text-2xl font-bold flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.title}
                  </Text>
                </View>
                {(task.completed || (task.completedBy && task.completedBy.length > 0)) && (
                  <View className="bg-green-100 px-3 py-1 rounded-full ml-2 flex-row items-center gap-1">
                    <Text className="text-green-700 font-semibold text-xs">Completed</Text>
                  </View>
                )}
              </View>
              
              {/* Only show "Mark as Complete" button if user is the admin (task creator) */}
              {!task.completed && currentUser?.uid === task.createdBy && (
                <TouchableOpacity 
                  onPress={() => setShowCompleteConfirmModal(true)}
                  className="bg-green-500 rounded-lg py-2 px-4 flex-row items-center justify-center"
                >
                  <Ionicons name="checkmark-done" size={18} color="white" />
                  <Text className="text-white font-semibold ml-2">Mark as Complete</Text>
                </TouchableOpacity>
              )}
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
                {typeof (task as any).creatorName === 'string' ? (task as any).creatorName : 'Unknown'} • {(() => {
                  try {
                    const date = task.createdAt?.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
                    return date.toLocaleDateString();
                  } catch (e) {
                    return 'Date unavailable';
                  }
                })()}
              </Text>
            </View>

            {/* Assigned Members */}
            {task.assignedTo && task.assignedTo.length > 0 && (
              <View className="border-t border-gray-100 pt-4 mb-4">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="people-outline" size={18} color="#6B7280" />
                  <Text className="text-gray-600 ml-2 font-semibold">Assigned to ({task.assignedTo.length})</Text>
                </View>
                <View className="gap-2">
                  {members
                    .filter(member => task.assignedTo.includes(member.uid))
                    .map((member) => {
                      const isCompleted = task.completedBy?.includes(member.uid) || false;
                      return (
                        <View key={member.uid} className={`flex-row items-center gap-3 rounded-lg p-3 ${isCompleted ? 'bg-green-50' : 'bg-yellow-50'}`}>
                          {member.profileImage ? (
                            <Image
                              source={{ uri: member.profileImage }}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <View className={`w-8 h-8 rounded-full items-center justify-center ${isCompleted ? 'bg-green-200' : 'bg-yellow-200'}`}>
                              <Text className={`font-bold text-xs ${isCompleted ? 'text-green-700' : 'text-yellow-700'}`}>
                                {member.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="font-semibold text-gray-800">{member.name}</Text>
                            {member.email && (
                              <Text className="text-xs text-gray-500">{member.email}</Text>
                            )}
                          </View>
                          <View className={`px-3 py-1 rounded-full flex-row items-center gap-1 ${isCompleted ? 'bg-green-100' : 'bg-yellow-100'}`}>
                            <Ionicons 
                              name={isCompleted ? "checkmark-circle" : "ellipse-outline"} 
                              size={14} 
                              color={isCompleted ? "#22C55E" : "#F59E0B"} 
                            />
                            <Text className={`text-xs font-semibold ${isCompleted ? 'text-green-700' : 'text-yellow-700'}`}>
                              {isCompleted ? 'Completed' : 'Pending'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                </View>
              </View>
            )}

            {/* Description with mention highlighting */}
            {task.description ? (
              <View className="border-t border-gray-100 pt-4 mb-4">
                <Text className="text-gray-600 font-semibold mb-2">Description</Text>
                <View>
                  {renderDescriptionWithMentions(task.description)}
                </View>
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

          {/* Submissions and Discussion Tabs */}
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            {/* Tab Switcher */}
            <View className="flex-row border-b border-gray-200 mb-4">
              <TouchableOpacity
                onPress={() => setActiveTab('submissions')}
                className={`flex-1 pb-3 border-b-2 ${activeTab === 'submissions' ? 'border-yellow-400' : 'border-transparent'}`}
              >
                <Text className={`text-center font-semibold ${activeTab === 'submissions' ? 'text-yellow-400' : 'text-gray-400'}`}>
                  Submissions ({submissions.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('discussion')}
                className={`flex-1 pb-3 border-b-2 ${activeTab === 'discussion' ? 'border-yellow-400' : 'border-transparent'}`}
              >
                <Text className={`text-center font-semibold ${activeTab === 'discussion' ? 'text-yellow-400' : 'text-gray-400'}`}>
                  Discussion ({comments.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* SUBMISSIONS TAB */}
            {activeTab === 'submissions' && (
              <View>
                <TouchableOpacity
                  onPress={() => setShowSubmissionModal(true)}
                  className="bg-yellow-400 rounded-xl p-4 mb-4 flex-row items-center justify-center"
                >
                  <Ionicons name="add-circle-outline" size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Submit Your Work</Text>
                </TouchableOpacity>

                {submissions.length === 0 ? (
                  <Text className="text-gray-400 text-center py-4">No submissions yet</Text>
                ) : (
                  submissions.map((submission) => (
                    <View key={submission.id} className="bg-gray-50 rounded-xl p-4 mb-3 border border-gray-200">
                      {/* Member Info Header */}
                      <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-gray-200">
                        <View className="flex-row items-center flex-1">
                          {submission.profileImage ? (
                            <Image
                              source={{ uri: submission.profileImage }}
                              className="w-10 h-10 rounded-full mr-3"
                            />
                          ) : (
                            <View className="w-10 h-10 bg-yellow-200 rounded-full items-center justify-center mr-3">
                              <Text className="text-yellow-700 font-bold text-sm">
                                {submission.userName?.charAt(0).toUpperCase() || 'U'}
                              </Text>
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="text-base font-bold text-gray-900">
                              {submission.userName || 'Anonymous'}
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5">
                              {new Date(submission.createdAt).toLocaleDateString()} at {new Date(submission.createdAt).toLocaleTimeString()}
                            </Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-2">
                          {task && currentUser?.uid === task.createdBy && (
                            <TouchableOpacity
                              onPress={() => openReviewModal(submission)}
                              className="bg-blue-500 rounded-lg px-3 py-1.5 flex-row items-center"
                            >
                              <Ionicons name="checkmark-done" size={14} color="white" />
                              <Text className="text-white text-xs font-semibold ml-1">Review</Text>
                            </TouchableOpacity>
                          )}
                          <View className={`px-3 py-1.5 rounded-full ${
                            submission.adminReview 
                              ? (submission.adminReview.status === 'Approved' ? 'bg-green-100' : 'bg-orange-100')
                              : (submission.status === 'Complete' ? 'bg-green-100' : 'bg-blue-100')
                          }`}>
                            <Text className={`text-xs font-bold ${
                              submission.adminReview 
                                ? (submission.adminReview.status === 'Approved' ? 'text-green-700' : 'text-orange-700')
                                : (submission.status === 'Complete' ? 'text-green-700' : 'text-blue-700')
                            }`}>
                              {submission.adminReview 
                                ? (submission.adminReview.status === 'Approved' ? 'Approved' : 'Need Revision')
                                : submission.status
                              }
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Note */}
                      {submission.note && (
                        <Text className="text-gray-700 mb-2">{submission.note}</Text>
                      )}

                      {/* Link */}
                      {submission.link && (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(submission.link!)}
                          className="flex-row items-center bg-white rounded-lg p-2 mb-2"
                        >
                          <Ionicons name="link" size={16} color="#3B82F6" />
                          <Text className="text-blue-500 ml-2 flex-1 underline" numberOfLines={1}>
                            {submission.link}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Files */}
                      {submission.fileUrls && submission.fileUrls.length > 0 && (
                        <View className="mt-2 mb-2">
                          {submission.fileUrls.map((url, idx) => {
                            const fileName = submission.fileNames?.[idx] || `File ${idx + 1}`;
                            const isDownloading = downloadingFile === fileName;
                            
                            return (
                              <TouchableOpacity
                                key={idx}
                                onPress={() => downloadFile(url, fileName)}
                                disabled={isDownloading}
                                className="flex-row items-center bg-white rounded-lg p-2 mb-1"
                              >
                                {isDownloading ? (
                                  <ActivityIndicator size="small" color="#EAB308" />
                                ) : (
                                  <Ionicons name="document-outline" size={16} color="#EAB308" />
                                )}
                                <Text className="text-xs text-gray-600 ml-2 flex-1" numberOfLines={1}>
                                  {fileName}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                      {/* Photos */}
                      {submission.photoUrls && submission.photoUrls.length > 0 && (
                        <View className="mt-2">
                          {submission.photoUrls.map((url, idx) => (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => Linking.openURL(url)}
                              className="bg-white rounded-lg p-2 mb-1"
                            >
                              <Image
                                source={{ uri: url }}
                                className="w-full h-32 rounded-lg"
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* Admin Review Section */}
                      {submission.adminReview && (
                        <View className={`mt-3 p-3 rounded-lg ${submission.adminReview.status === 'Approved' ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                          <View className="flex-row items-center mb-2">
                            <Ionicons name={submission.adminReview.status === 'Approved' ? 'checkmark-circle' : 'alert-circle'} size={18} color={submission.adminReview.status === 'Approved' ? '#10B981' : '#F97316'} />
                            <Text className={`font-semibold ml-2 ${submission.adminReview.status === 'Approved' ? 'text-green-700' : 'text-orange-700'}`}>
                              {submission.adminReview.status === 'Approved' ? 'Approved' : 'Needs Revision'}
                            </Text>
                          </View>
                          {submission.adminReview.note && (
                            <Text className={`text-sm ${submission.adminReview.status === 'Approved' ? 'text-green-600' : 'text-orange-600'}`}>
                              {submission.adminReview.note}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* DISCUSSION TAB */}
            {activeTab === 'discussion' && (
              <View>
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
                        
                        {/* Comment Attachments */}
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
            )}
          </View>
        </View>
      </ScrollView>

      {/* Admin Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowReviewModal(false);
          setSelectedSubmissionForReview(null);
          setReviewStatus('Approved');
          setReviewNote('');
        }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-800">Review Submission</Text>
              <TouchableOpacity onPress={() => {
                setShowReviewModal(false);
                setSelectedSubmissionForReview(null);
                setReviewStatus('Approved');
                setReviewNote('');
              }}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Submitter Info */}
              {selectedSubmissionForReview && (
                <View className="bg-gray-50 rounded-lg p-4 mb-4">
                  <Text className="text-sm text-gray-500 mb-1">Submitted by</Text>
                  <Text className="font-semibold text-gray-800">{selectedSubmissionForReview.userName}</Text>
                  <Text className="text-xs text-gray-400">
                    {new Date(selectedSubmissionForReview.createdAt).toLocaleDateString()} • {new Date(selectedSubmissionForReview.createdAt).toLocaleTimeString()}
                  </Text>
                </View>
              )}

              {/* Status Picker */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-3">Review Status</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setReviewStatus('Approved')}
                    className={`flex-1 p-4 rounded-lg border-2 items-center ${reviewStatus === 'Approved' ? 'bg-green-200 border-green-400' : 'bg-white border-gray-300'}`}
                  >
                    <Ionicons name="checkmark-circle" size={24} color={reviewStatus === 'Approved' ? '#10B981' : '#9CA3AF'} />
                    <Text className={`text-sm font-semibold mt-2 ${reviewStatus === 'Approved' ? 'text-green-700' : 'text-gray-700'}`}>
                      Approved
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setReviewStatus('Need Revise')}
                    className={`flex-1 p-4 rounded-lg border-2 items-center ${reviewStatus === 'Need Revise' ? 'bg-orange-200 border-orange-400' : 'bg-white border-gray-300'}`}
                  >
                    <Ionicons name="alert-circle" size={24} color={reviewStatus === 'Need Revise' ? '#F97316' : '#9CA3AF'} />
                    <Text className={`text-sm font-semibold mt-2 ${reviewStatus === 'Need Revise' ? 'text-orange-700' : 'text-gray-700'}`}>
                      Need Revise
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Review Note */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Feedback (Optional)</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg p-3 h-24"
                  placeholder="Add feedback for the student..."
                  value={reviewNote}
                  onChangeText={setReviewNote}
                  multiline
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleReviewSubmission}
                disabled={isSubmittingReview}
                className="bg-blue-500 rounded-lg p-4 flex-row items-center justify-center"
              >
                {isSubmittingReview ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={20} color="white" />
                    <Text className="text-white font-semibold ml-2">Submit Review</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Submit Work Modal */}
      <Modal
        visible={showSubmissionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowSubmissionModal(false);
          setSubmissionLink('');
          setSubmissionNote('');
          setSubmissionStatus('Progress');
          setSubmissionFiles([]);
          setSubmissionPhotos([]);
        }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-800">Submit Your Work</Text>
              <TouchableOpacity onPress={() => {
                setShowSubmissionModal(false);
                setSubmissionLink('');
                setSubmissionNote('');
                setSubmissionStatus('Progress');
                setSubmissionFiles([]);
                setSubmissionPhotos([]);
              }}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Link Input */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Link (Optional)</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg p-3"
                  placeholder="https://example.com"
                  value={submissionLink}
                  onChangeText={setSubmissionLink}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Note Input */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Note</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg p-3 h-24"
                  placeholder="Add a note about your submission..."
                  value={submissionNote}
                  onChangeText={setSubmissionNote}
                  multiline
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Status Picker */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">Status</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setSubmissionStatus('Progress')}
                    className={`flex-1 p-3 rounded-lg border ${submissionStatus === 'Progress' ? 'bg-blue-200 border-blue-400' : 'bg-white border-gray-300'}`}
                  >
                    <Text className={`text-center font-semibold ${submissionStatus === 'Progress' ? 'text-blue-700' : 'text-gray-700'}`}>
                      Progress
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSubmissionStatus('Complete')}
                    className={`flex-1 p-3 rounded-lg border ${submissionStatus === 'Complete' ? 'bg-green-200 border-green-400' : 'bg-white border-gray-300'}`}
                  >
                    <Text className={`text-center font-semibold ${submissionStatus === 'Complete' ? 'text-green-700' : 'text-gray-700'}`}>
                      Complete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* File Upload */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700">Files (Optional)</Text>
                  <Text className="text-xs text-gray-500">{submissionFiles.length} selected</Text>
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
                        setSubmissionFiles([...submissionFiles, ...newFiles]);
                      }
                    } catch (error) {
                      console.error('Error picking files:', error);
                    }
                  }}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 items-center"
                >
                  <Ionicons name="document-attach" size={24} color="#9CA3AF" />
                  <Text className="text-gray-600 mt-2 text-sm">Tap to add files</Text>
                </TouchableOpacity>

                {submissionFiles.length > 0 && (
                  <View className="mt-3">
                    {submissionFiles.map((file, index) => (
                      <View key={index} className="flex-row items-center justify-between bg-gray-50 rounded-lg p-2 mb-1">
                        <View className="flex-row items-center flex-1">
                          <Ionicons name="document-text" size={16} color="#EAB308" />
                          <Text className="text-xs text-gray-600 ml-2 flex-1" numberOfLines={1}>
                            {file.name}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => setSubmissionFiles(submissionFiles.filter((_, i) => i !== index))}>
                          <Ionicons name="close-circle" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Photo Upload */}
              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm font-semibold text-gray-700">Photos (Optional)</Text>
                  <Text className="text-xs text-gray-500">{submissionPhotos.length} selected</Text>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const result = await DocumentPicker.getDocumentAsync({
                        multiple: true,
                        type: 'image/*',
                      });

                      if (result.assets && result.assets.length > 0) {
                        const newPhotos = result.assets.map((asset) => ({
                          name: asset.name,
                          uri: asset.uri,
                        }));
                        setSubmissionPhotos([...submissionPhotos, ...newPhotos]);
                      }
                    } catch (error) {
                      console.error('Error picking photos:', error);
                    }
                  }}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 items-center"
                >
                  <Ionicons name="image" size={24} color="#9CA3AF" />
                  <Text className="text-gray-600 mt-2 text-sm">Tap to add photos</Text>
                </TouchableOpacity>

                {submissionPhotos.length > 0 && (
                  <View className="mt-3">
                    {submissionPhotos.map((photo, index) => (
                      <View key={index} className="flex-row items-center justify-between bg-gray-50 rounded-lg p-2 mb-1">
                        <View className="flex-row items-center flex-1">
                          <Ionicons name="image" size={16} color="#EAB308" />
                          <Text className="text-xs text-gray-600 ml-2 flex-1" numberOfLines={1}>
                            {photo.name}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => setSubmissionPhotos(submissionPhotos.filter((_, i) => i !== index))}>
                          <Ionicons name="close-circle" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleAddSubmission}
                disabled={isAddingComment || !submissionNote.trim()}
                className={`p-4 rounded-xl mb-4 ${submissionNote.trim() ? 'bg-yellow-400' : 'bg-gray-200'}`}
              >
                {isAddingComment ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className={`text-center font-semibold ${submissionNote.trim() ? 'text-white' : 'text-gray-400'}`}>
                    Submit Work
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      {/* Task Completion Confirmation Modal */}
      <Modal
        visible={showCompleteConfirmModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCompleteConfirmModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-2xl p-6 w-[85%]">
            <View className="items-center mb-4">
              <View className="bg-green-100 rounded-full p-4 mb-4">
                <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
              </View>
              <Text className="text-xl font-bold text-gray-800 text-center mb-2">
                Complete Task?
              </Text>
              <Text className="text-base font-semibold text-gray-700 mb-1">
                {task?.title}
              </Text>
            </View>

            <View className="bg-green-50 rounded-lg p-3 mb-6">
              <Text className="text-sm text-gray-700 text-center">
                Are you sure you want to mark this task as complete? This action cannot be undone.
              </Text>
            </View>

            <View className="flex-row justify-end gap-3">
              <TouchableOpacity
                onPress={() => setShowCompleteConfirmModal(false)}
                className="px-5 py-2 rounded-lg border border-gray-300"
              >
                <Text className="text-gray-700 font-semibold">No, Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleTaskComplete}
                disabled={isMarkingComplete}
                className={`px-5 py-2 rounded-lg ${isMarkingComplete ? 'bg-green-300' : 'bg-green-500'}`}
              >
                {isMarkingComplete ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold">Yes, Complete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
