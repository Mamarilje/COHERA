import { db } from '../Firebase/firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import {
  notifyAdminDeadlineOneDay,
  notifyAdminDeadlineOneHour,
  notifyMemberDeadlineOneDay,
  notifyMemberDeadlineOneHour,
  shouldNotifyOneDayBefore,
  shouldNotifyOneHourBefore,
} from './notificationHelper';

const DEADLINE_CHECK_COOLDOWN_MS = 10 * 60 * 1000;

let lastDeadlineCheckAt = 0;
let deadlineCheckInFlight: Promise<void> | null = null;

/**
 * Check all tasks for upcoming deadlines and send notifications
 * This should be called periodically (e.g., when app loads or every few hours)
 */
export const checkAndNotifyDeadlines = async () => {
  const now = Date.now();

  if (deadlineCheckInFlight) {
    return deadlineCheckInFlight;
  }

  if (now - lastDeadlineCheckAt < DEADLINE_CHECK_COOLDOWN_MS) {
    return;
  }

  deadlineCheckInFlight = (async () => {
  try {
    console.log('Checking for upcoming task deadlines...');

    // Get all incomplete tasks
    const tasksRef = collection(db, 'tasks');
    const tasksQuery = query(tasksRef, where('completed', '==', false));
    const tasksSnapshot = await getDocs(tasksQuery);

    for (const taskDoc of tasksSnapshot.docs) {
      const task = taskDoc.data();
      const taskId = taskDoc.id;

      if (!task.deadline) continue;

      // Check 1 day before deadline
      if (shouldNotifyOneDayBefore(task.deadline)) {
        // Notify admin
        if (task.createdBy) {
          await notifyAdminDeadlineOneDay(
            task.createdBy,
            task.title,
            taskId,
            task.groupId || ''
          );
        }

        // Notify assigned members
        if (task.assignedTo && Array.isArray(task.assignedTo)) {
          for (const memberId of task.assignedTo) {
            await notifyMemberDeadlineOneDay(
              memberId,
              task.title,
              taskId,
              task.groupId || ''
            );
          }
        }
      }

      // Check 1 hour before deadline
      if (shouldNotifyOneHourBefore(task.deadline)) {
        // Notify admin
        if (task.createdBy) {
          await notifyAdminDeadlineOneHour(
            task.createdBy,
            task.title,
            taskId,
            task.groupId || ''
          );
        }

        // Notify assigned members
        if (task.assignedTo && Array.isArray(task.assignedTo)) {
          for (const memberId of task.assignedTo) {
            await notifyMemberDeadlineOneHour(
              memberId,
              task.title,
              taskId,
              task.groupId || ''
            );
          }
        }
      }
    }

    console.log('Deadline notification check completed');
    lastDeadlineCheckAt = Date.now();
  } catch (error) {
    console.error('Error checking deadline notifications:', error);
  } finally {
    deadlineCheckInFlight = null;
  }
  })();

  return deadlineCheckInFlight;
};
