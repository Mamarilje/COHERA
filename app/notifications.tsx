import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../src/Firebase/firebaseConfig";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  taskId?: string;
  groupId?: string;
  relatedUserId?: string;
  relatedUserName?: string;
  joinRequestId?: string;
  read: boolean;
  createdAt: any;
}

export default function Notifications() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(notificationsQuery);
      const notificationsList: Notification[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Notification));

      setNotifications(notificationsList);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      Alert.alert("Error", "Failed to load notifications");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        fetchNotifications();
      }
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true,
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, "notifications", notificationId));
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
      Alert.alert("Error", "Failed to delete notification");
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    await markAsRead(notification.id);
    
    // Navigate to task if notification has taskId
    if (notification.taskId) {
      router.push({
        pathname: '/task/[id]',
        params: { id: notification.taskId }
      });
    }
    // Navigate to group details if notification has groupId but no taskId
    else if (notification.groupId) {
      router.push({
        pathname: '/group-details',
        params: { groupId: notification.groupId }
      });
    }
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "member_submitted_work":
        return <Ionicons name="checkmark-circle-outline" size={20} color="#EAB308" />;
      case "task_deadline_one_day":
        return <Ionicons name="timer-outline" size={20} color="#F59E0B" />;
      case "task_deadline_one_hour":
        return <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />;
      case "member_commented":
        return <Ionicons name="chatbubble-outline" size={20} color="#3B82F6" />;
      case "join_request_pending":
        return <Ionicons name="person-add-outline" size={20} color="#10B981" />;
      case "task_assigned_to_you":
        return <Ionicons name="clipboard-outline" size={20} color="#8B5CF6" />;
      case "work_reviewed":
        return <Ionicons name="checkmark-done-outline" size={20} color="#10B981" />;
      case "join_request_declined":
        return <Ionicons name="close-circle-outline" size={20} color="#EF4444" />;
      case "kicked_from_group":
        return <Ionicons name="exit-outline" size={20} color="#EF4444" />;
      default:
        return <Ionicons name="notifications-outline" size={20} color="#9CA3AF" />;
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-100 items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="bg-white px-5 pt-12 pb-4 flex-row items-center border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-800">Notifications</Text>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#EAB308"]}
          />
        }
      >
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              onPress={() => handleNotificationPress(notification)}
              onLongPress={() => deleteNotification(notification.id)}
              activeOpacity={0.7}
              className={`bg-white rounded-xl p-4 mb-3 shadow-sm border-l-4 ${
                notification.read
                  ? "border-l-gray-300 opacity-70"
                  : "border-l-yellow-400"
              }`}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-start flex-1">
                  <View className="mt-1 mr-3">
                    {getNotificationIcon(notification.type)}
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-semibold ${
                        notification.read
                          ? "text-gray-600"
                          : "text-gray-800"
                      }`}
                    >
                      {notification.title}
                    </Text>
                    <Text className="text-gray-500 text-sm mt-1 leading-5">
                      {notification.message}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-2">
                      {formatTime(notification.createdAt)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => deleteNotification(notification.id)}
                  className="ml-2"
                >
                  <Ionicons name="close-circle-outline" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View className="items-center justify-center py-10">
            <Ionicons name="notifications-off-outline" size={50} color="#ccc" />
            <Text className="text-gray-400 mt-3">No notifications yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}