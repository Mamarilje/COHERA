import { db } from '../Firebase/firebaseConfig';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';

export type NotificationType = 
  | 'member_submitted_work'
  | 'task_deadline_one_day'
  | 'task_deadline_one_hour'
  | 'member_commented'
  | 'join_request_pending'
  | 'task_assigned_to_you'
  | 'work_reviewed'
  | 'join_request_declined'
  | 'kicked_from_group';

interface NotificationData {
  userId: string; // Recipient
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string;
  groupId?: string;
  relatedUserId?: string; // For who triggered the notification
  relatedUserName?: string;
  joinRequestId?: string;
  read: boolean;
  createdAt: any;
}

/**
 * Create a notification in Firestore
 */
export const createNotification = async (data: Omit<NotificationData, 'createdAt' | 'read'>) => {
  try {
    const notificationRef = collection(db, 'notifications');
    await addDoc(notificationRef, {
      ...data,
      read: false,
      createdAt: serverTimestamp(),
    });
    console.log('Notification created:', data.type);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

/**
 * Notify admin when member submits work
 */
export const notifyAdminMemberSubmitted = async (
  adminId: string,
  memberName: string,
  memberEmail: string,
  taskId: string,
  taskTitle: string,
  groupId: string,
  memberId: string
) => {
  await createNotification({
    userId: adminId,
    type: 'member_submitted_work',
    title: 'New Work Submission',
    message: `${memberName} has submitted work for task "${taskTitle}"`,
    taskId,
    groupId,
    relatedUserId: memberId,
    relatedUserName: memberName,
  });
};

/**
 * Notify admin of deadline approaching (1 day before)
 */
export const notifyAdminDeadlineOneDay = async (
  adminId: string,
  taskTitle: string,
  taskId: string,
  groupId: string
) => {
  await createNotification({
    userId: adminId,
    type: 'task_deadline_one_day',
    title: '⏰ Task Deadline Approaching',
    message: `"${taskTitle}" is due in 1 day`,
    taskId,
    groupId,
  });
};

/**
 * Notify admin of deadline approaching (1 hour before)
 */
export const notifyAdminDeadlineOneHour = async (
  adminId: string,
  taskTitle: string,
  taskId: string,
  groupId: string
) => {
  await createNotification({
    userId: adminId,
    type: 'task_deadline_one_hour',
    title: '🚨 Task Deadline - 1 Hour Left',
    message: `"${taskTitle}" is due in 1 hour!`,
    taskId,
    groupId,
  });
};

/**
 * Notify admin when member comments on task
 */
export const notifyAdminMemberCommented = async (
  adminId: string,
  memberName: string,
  taskTitle: string,
  taskId: string,
  groupId: string,
  memberId: string
) => {
  await createNotification({
    userId: adminId,
    type: 'member_commented',
    title: 'New Comment on Task',
    message: `${memberName} commented on "${taskTitle}"`,
    taskId,
    groupId,
    relatedUserId: memberId,
    relatedUserName: memberName,
  });
};

/**
 * Notify admin of pending join request
 */
export const notifyAdminJoinRequest = async (
  adminId: string,
  requesterName: string,
  requesterEmail: string,
  groupName: string,
  groupId: string,
  joinRequestId: string,
  requesterId: string
) => {
  await createNotification({
    userId: adminId,
    type: 'join_request_pending',
    title: 'New Join Request',
    message: `${requesterName} (${requesterEmail}) requested to join "${groupName}"`,
    groupId,
    joinRequestId,
    relatedUserId: requesterId,
    relatedUserName: requesterName,
  });
};

/**
 * Notify member when task is assigned to them
 */
export const notifyMemberTaskAssigned = async (
  memberId: string,
  taskTitle: string,
  taskId: string,
  groupId: string,
  adminName: string,
  adminId: string
) => {
  await createNotification({
    userId: memberId,
    type: 'task_assigned_to_you',
    title: 'New Task Assigned',
    message: `${adminName} assigned you to "${taskTitle}"`,
    taskId,
    groupId,
    relatedUserId: adminId,
    relatedUserName: adminName,
  });
};

/**
 * Notify member when their work is reviewed
 */
export const notifyMemberWorkReviewed = async (
  memberId: string,
  reviewStatus: 'Approved' | 'Need Revise',
  taskTitle: string,
  taskId: string,
  groupId: string,
  adminName: string,
  adminId: string,
  reviewNote?: string
) => {
  const statusText = reviewStatus === 'Approved' ? '✅ Approved' : '📝 Needs Revision';
  await createNotification({
    userId: memberId,
    type: 'work_reviewed',
    title: `Work ${statusText}`,
    message: `${adminName} reviewed your submission for "${taskTitle}"${reviewNote ? `: ${reviewNote}` : ''}`,
    taskId,
    groupId,
    relatedUserId: adminId,
    relatedUserName: adminName,
  });
};

/**
 * Notify member of deadline approaching (1 day before)
 */
export const notifyMemberDeadlineOneDay = async (
  memberId: string,
  taskTitle: string,
  taskId: string,
  groupId: string
) => {
  await createNotification({
    userId: memberId,
    type: 'task_deadline_one_day',
    title: '⏰ Task Deadline Approaching',
    message: `"${taskTitle}" is due in 1 day`,
    taskId,
    groupId,
  });
};

/**
 * Notify member of deadline approaching (1 hour before)
 */
export const notifyMemberDeadlineOneHour = async (
  memberId: string,
  taskTitle: string,
  taskId: string,
  groupId: string
) => {
  await createNotification({
    userId: memberId,
    type: 'task_deadline_one_hour',
    title: '🚨 Task Deadline - 1 Hour Left',
    message: `"${taskTitle}" is due in 1 hour!`,
    taskId,
    groupId,
  });
};

/**
 * Notify member when their join request is declined
 */
export const notifyMemberJoinRequestDeclined = async (
  memberId: string,
  groupName: string,
  groupId: string,
  joinRequestId: string
) => {
  await createNotification({
    userId: memberId,
    type: 'join_request_declined',
    title: 'Join Request Declined',
    message: `Your request to join "${groupName}" was declined`,
    groupId,
    joinRequestId,
  });
};

/**
 * Notify member when they are kicked from group
 */
export const notifyMemberKickedFromGroup = async (
  memberId: string,
  groupName: string,
  groupId: string,
  adminName: string,
  adminId: string
) => {
  await createNotification({
    userId: memberId,
    type: 'kicked_from_group',
    title: '❌ Removed from Group',
    message: `${adminName} removed you from "${groupName}"`,
    groupId,
    relatedUserId: adminId,
    relatedUserName: adminName,
  });
};

/**
 * Helper to check if deadline is approaching
 */
export const getTimeUntilDeadline = (deadline: string): { days: number; hours: number; minutes: number } => {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return { days, hours, minutes };
};

/**
 * Check if should notify about 1 day before deadline
 */
export const shouldNotifyOneDayBefore = (deadline: string): boolean => {
  const { days, hours } = getTimeUntilDeadline(deadline);
  return days === 1 && hours >= 0 && hours < 24;
};

/**
 * Check if should notify about 1 hour before deadline
 */
export const shouldNotifyOneHourBefore = (deadline: string): boolean => {
  const { days, hours, minutes } = getTimeUntilDeadline(deadline);
  return days === 0 && hours === 1 && minutes >= 0 && minutes < 60;
};

/**
 * Get user data helper
 */
export const getUserData = async (userId: string) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
};
