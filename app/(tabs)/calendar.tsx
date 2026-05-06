import { View, Text, ScrollView, TouchableOpacity, Modal, FlatList, ActivityIndicator } from "react-native";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../src/Firebase/firebaseConfig';
import { useAppTheme } from "../../src/theme/AppThemeContext";

// Type definitions
type ViewType = 'Day' | 'Week' | 'Month';

interface Event {
  title: string;
  subtitle: string;
  color: string;
  textColor: string;
  subColor: string;
  taskId?: string;
}

interface ScheduleItem {
  time: string;
  events: Event[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
  deadline: string;
  assignedTo: string[];
  completed: boolean;
  createdBy: string;
  groupId: string;
  createdAt: any;
  completedBy?: string[];
  archived?: boolean;
}

interface Group {
  id: string;
  name: string;
  members: string[];
}

const FIRESTORE_IN_QUERY_LIMIT = 10;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

// Group color mapping
const groupColors = [
  { bg: 'bg-red-100', text: 'text-red-800', sub: 'text-red-600', border: 'border-red-300' },
  { bg: 'bg-blue-100', text: 'text-blue-800', sub: 'text-blue-600', border: 'border-blue-300' },
  { bg: 'bg-green-100', text: 'text-green-800', sub: 'text-green-600', border: 'border-green-300' },
  { bg: 'bg-purple-100', text: 'text-purple-800', sub: 'text-purple-600', border: 'border-purple-300' },
  { bg: 'bg-pink-100', text: 'text-pink-800', sub: 'text-pink-600', border: 'border-pink-300' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', sub: 'text-indigo-600', border: 'border-indigo-300' },
];

export default function CalendarScreen() {
  const router = useRouter();
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const { isDark, colors } = useAppTheme();
  const hasLoadedOnceRef = useRef(false);
  const isLoadingRef = useRef(false);
  
  const [selectedView, setSelectedView] = useState<ViewType>('Day');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const currentDateRef = useRef(currentDate);
  const selectedDateRef = useRef<number | null>(selectedDate);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [pickerType, setPickerType] = useState<'month' | 'year'>('month');
  
  // Database states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDateTasks, setSelectedDateTasks] = useState<Task[]>([]);
  
  // Group filter state
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  
  // Notification state
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchUnreadNotifications = useCallback(async () => {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return;

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid),
        where('read', '==', false)
      );

      const snapshot = await getDocs(notificationsQuery);
      setUnreadNotificationsCount(snapshot.size);
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
    }
  }, []);

  const isTaskCompleted = useCallback((task: Task) => {
    return task.completed || Boolean(task.completedBy && task.completedBy.length > 0);
  }, []);

  const isSameDate = useCallback((firstDate: Date, secondDate: Date) => {
    return (
      firstDate.getDate() === secondDate.getDate() &&
      firstDate.getMonth() === secondDate.getMonth() &&
      firstDate.getFullYear() === secondDate.getFullYear()
    );
  }, []);

  const isDateInSameWeek = useCallback((date: Date, referenceDate: Date) => {
    const startOfWeek = new Date(referenceDate);
    startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return date >= startOfWeek && date <= endOfWeek;
  }, []);

  const getTasksForDate = useCallback((date: Date): Task[] => {
    return tasks.filter((task) => {
      if (!task.deadline) return false;
      const taskDate = new Date(task.deadline);
      const isDateMatch = isSameDate(taskDate, date);

      if (selectedGroupId !== 'all') {
        return isDateMatch && task.groupId === selectedGroupId;
      }

      return isDateMatch;
    });
  }, [isSameDate, selectedGroupId, tasks]);

  const updateTasksForSelectedDate = useCallback((day: number, baseDate: Date, sourceTasks: Task[]) => {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
    const tasksForDate = sourceTasks.filter((task) => {
      if (!task.deadline) return false;
      const taskDate = new Date(task.deadline);
      const isDateMatch = isSameDate(taskDate, date);

      if (selectedGroupId !== 'all') {
        return isDateMatch && task.groupId === selectedGroupId;
      }

      return isDateMatch;
    });
    setSelectedDateTasks(tasksForDate);
  }, [isSameDate, selectedGroupId]);

  const fetchUserTasks = useCallback(async ({
    showSpinner = true,
    baseDate = currentDateRef.current,
    selectedDay = selectedDateRef.current,
  }: {
    showSpinner?: boolean;
    baseDate?: Date;
    selectedDay?: number | null;
  } = {}) => {
    if (!currentUser?.uid) {
      setTasks([]);
      setUserGroups([]);
      setSelectedDateTasks([]);
      setIsLoading(false);
      return;
    }

    if (isLoadingRef.current) {
      return;
    }

    try {
      isLoadingRef.current = true;
      if (showSpinner) {
        setIsLoading(true);
      }

      const groupsRef = collection(db, 'groups');
      const groupsQuery = query(groupsRef, where('members', 'array-contains', currentUser.uid));
      const groupsSnapshot = await getDocs(groupsQuery);

      const groupsData: Group[] = groupsSnapshot.docs.map((groupDoc) => ({
        id: groupDoc.id,
        ...(groupDoc.data() as Omit<Group, 'id'>),
      }));

      setUserGroups(groupsData);

      const groupIds = groupsData.map((group) => group.id);

      if (groupIds.length === 0) {
        setTasks([]);
        setSelectedDateTasks([]);
        return;
      }

      const tasksRef = collection(db, 'tasks');
      const taskSnapshots = await Promise.all(
        chunkArray(groupIds, FIRESTORE_IN_QUERY_LIMIT).map((groupIdChunk) =>
          getDocs(query(tasksRef, where('groupId', 'in', groupIdChunk)))
        )
      );

      const allTasks: Task[] = taskSnapshots.flatMap((snapshot) =>
        snapshot.docs.map((taskDoc) => {
          const taskData = taskDoc.data();

          return {
            id: taskDoc.id,
            title: taskData.title || '',
            description: taskData.description || '',
            priority: taskData.priority || 'Medium',
            deadline: taskData.deadline || '',
            assignedTo: taskData.assignedTo || [],
            completed: Boolean(taskData.completed),
            createdBy: taskData.createdBy || '',
            groupId: taskData.groupId || '',
            createdAt: taskData.createdAt,
            completedBy: taskData.completedBy || [],
            archived: Boolean(taskData.archived),
          };
        })
      );

      setTasks(allTasks.filter((task) => !task.archived));

      if (selectedDay) {
        updateTasksForSelectedDate(selectedDay, baseDate, allTasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [currentUser?.uid, updateTasksForSelectedDate]);

  const loadAllData = useCallback(async ({ resetDate = false, showSpinner = true } = {}) => {
    const baseDate = resetDate ? new Date() : currentDateRef.current;
    const selectedDay = resetDate ? baseDate.getDate() : selectedDateRef.current;

    if (resetDate) {
      setCurrentDate(baseDate);
      currentDateRef.current = baseDate;
      setSelectedDate(selectedDay);
      selectedDateRef.current = selectedDay;
    }

    await Promise.all([
      fetchUserTasks({ showSpinner, baseDate, selectedDay }),
      fetchUnreadNotifications(),
    ]);
  }, [fetchUnreadNotifications, fetchUserTasks]);

  useEffect(() => {
    loadAllData({ resetDate: true });
  }, [loadAllData]);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser || !hasLoadedOnceRef.current) {
        return;
      }

      loadAllData({ showSpinner: false });
    }, [currentUser, loadAllData])
  );

  // Get month name and year from real date
  const monthNames: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonthNames: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonth: string = monthNames[currentDate.getMonth()];
  const currentYear: number = currentDate.getFullYear();
  const today: Date = new Date();
  
  const isToday = (day: number | null): boolean => {
    if (!day) return false;
    return today.getDate() === day && 
           today.getMonth() === currentDate.getMonth() && 
           today.getFullYear() === currentDate.getFullYear();
  };

  // Check if a date has tasks
  const hasTasksOnDate = (day: number): boolean => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return getTasksForDate(date).length > 0;
  };

  // Get priority color for indicator
  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'High': return 'bg-red-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  // Get highest priority for a date (for the indicator dot)
  const getHighestPriorityForDate = (day: number): string | null => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const tasksForDate = getTasksForDate(date);
    
    if (tasksForDate.length === 0) return null;
    
    const priorities = tasksForDate.map(t => t.priority);
    if (priorities.includes('High')) return 'High';
    if (priorities.includes('Medium')) return 'Medium';
    return 'Low';
  };

  // Navigation functions for month
  const goToPreviousMonth = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
    setSelectedDateTasks([]);
  };

  const goToNextMonth = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
    setSelectedDateTasks([]);
  };

  // Navigation functions for year
  const goToPreviousYear = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1));
    setSelectedDate(null);
    setSelectedDateTasks([]);
  };

  const goToNextYear = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1));
    setSelectedDate(null);
    setSelectedDateTasks([]);
  };

  // Picker functions
  const openMonthPicker = (): void => {
    setPickerType('month');
    setShowPicker(true);
  };

  const openYearPicker = (): void => {
    setPickerType('year');
    setShowPicker(true);
  };

  const selectMonth = (monthIndex: number): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), monthIndex, 1));
    setShowPicker(false);
    setSelectedDate(null);
    setSelectedDateTasks([]);
  };

  const selectYear = (year: number): void => {
    setCurrentDate(new Date(year, currentDate.getMonth(), 1));
    setShowPicker(false);
    setSelectedDate(null);
    setSelectedDateTasks([]);
  };

  // Generate years for picker (current year - 50 to current year + 50)
  const generateYears = (): number[] => {
    const years: number[] = [];
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 50; i <= currentYear + 50; i++) {
      years.push(i);
    }
    return years;
  };

  // Get days in current month
  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Get color index for a group
  const getGroupColorIndex = useCallback((groupId: string): number => {
    const groupIndex = userGroups.findIndex(g => g.id === groupId);
    return groupIndex >= 0 ? groupIndex % groupColors.length : 0;
  }, [userGroups]);

  // Convert task to calendar event
  const taskToEvent = useCallback((task: Task): Event => {
    let color = 'bg-blue-100';
    let textColor = 'text-blue-800';
    let subColor = 'text-blue-600';
    
    // Use group color if "All Groups" is selected, otherwise use priority color
    if (selectedGroupId === 'all') {
      const colorIndex = getGroupColorIndex(task.groupId);
      const groupColor = groupColors[colorIndex];
      color = groupColor.bg;
      textColor = groupColor.text;
      subColor = groupColor.sub;
    } else {
      switch (task.priority) {
        case 'High':
          color = 'bg-red-100';
          textColor = 'text-red-800';
          subColor = 'text-red-600';
          break;
        case 'Medium':
          color = 'bg-yellow-100';
          textColor = 'text-yellow-800';
          subColor = 'text-yellow-600';
          break;
        case 'Low':
          color = 'bg-green-100';
          textColor = 'text-green-800';
          subColor = 'text-green-600';
          break;
      }
    }
    
    const taskDate = new Date(task.deadline);
    const timeString = taskDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    const groupName = userGroups.find(g => g.id === task.groupId)?.name || 'Unknown';
    const subtitleText = selectedGroupId === 'all'
      ? `${timeString} - ${groupName} - ${isTaskCompleted(task) ? 'Completed' : 'Pending'}`
      : `${timeString} - ${isTaskCompleted(task) ? 'Completed' : 'Pending'} - ${task.priority} Priority`;
    
    return {
      title: task.title,
      subtitle: subtitleText,
      color: color,
      textColor: textColor,
      subColor: subColor,
      taskId: task.id,
    };
  }, [getGroupColorIndex, isTaskCompleted, selectedGroupId, userGroups]);

  // Generate schedule from tasks for selected date
  const weeks: (number | null)[][] = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentDate);
    const nextWeeks: (number | null)[][] = [];
    let week: (number | null)[] = Array(7).fill(null);

    for (let i = 1; i <= daysInMonth; i++) {
      const dayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).getDay();
      week[dayOfWeek] = i;

      if (dayOfWeek === 6 || i === daysInMonth) {
        nextWeeks.push([...week]);
        week = Array(7).fill(null);
      }
    }

    return nextWeeks;
  }, [currentDate]);
  const dayLabels: string[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const years: number[] = useMemo(() => generateYears(), []);
  const referenceDate = useMemo(() => {
    if (selectedDate) {
      return new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDate);
    }

    const fallbackDay =
      today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()
        ? today.getDate()
        : 1;

    return new Date(currentDate.getFullYear(), currentDate.getMonth(), fallbackDay);
  }, [currentDate, selectedDate, today]);
  
  // Generate schedule from tasks
  const schedule: ScheduleItem[] = useMemo(() => {
    const timeSlots: ScheduleItem[] = [];

    for (let hour = 8; hour <= 20; hour++) {
      const displayHour = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';

      timeSlots.push({
        time: `${displayHour} ${ampm}`,
        events: [],
      });
    }

    selectedDateTasks.forEach((task) => {
      const taskDate = new Date(task.deadline);
      const taskHour = taskDate.getHours();

      if (taskHour >= 8 && taskHour <= 20) {
        const slotIndex = taskHour - 8;
        if (slotIndex >= 0 && slotIndex < timeSlots.length) {
          timeSlots[slotIndex].events.push(taskToEvent(task));
        }
      }
    });

    return timeSlots;
  }, [selectedDateTasks, taskToEvent]);

  const viewFilteredTasks = useMemo(() => {
    const baseTasks =
      selectedGroupId === 'all'
        ? tasks
        : tasks.filter((task) => task.groupId === selectedGroupId);

    switch (selectedView) {
      case 'Day':
        return selectedDateTasks
          .slice()
          .sort((firstTask, secondTask) => new Date(firstTask.deadline).getTime() - new Date(secondTask.deadline).getTime());
      case 'Week':
        return baseTasks
          .filter((task) => task.deadline && isDateInSameWeek(new Date(task.deadline), referenceDate))
          .sort((firstTask, secondTask) => new Date(firstTask.deadline).getTime() - new Date(secondTask.deadline).getTime());
      case 'Month':
        return baseTasks
          .filter((task) => {
            if (!task.deadline) return false;
            const taskDate = new Date(task.deadline);
            return (
              taskDate.getMonth() === currentDate.getMonth() &&
              taskDate.getFullYear() === currentDate.getFullYear()
            );
          })
          .sort((firstTask, secondTask) => new Date(firstTask.deadline).getTime() - new Date(secondTask.deadline).getTime());
      default:
        return [];
    }
  }, [currentDate, isDateInSameWeek, referenceDate, selectedDateTasks, selectedGroupId, selectedView, tasks]);

  const groupedRangeTasks = useMemo(() => {
    if (selectedView === 'Day') {
      return [];
    }

    const groupedTasksMap = new Map<string, Task[]>();

    viewFilteredTasks.forEach((task) => {
      const taskDate = new Date(task.deadline);
      const groupKey = taskDate.toDateString();
      const currentGroup = groupedTasksMap.get(groupKey) || [];
      currentGroup.push(task);
      groupedTasksMap.set(groupKey, currentGroup);
    });

    return Array.from(groupedTasksMap.entries()).map(([groupKey, groupedTasks]) => ({
      key: groupKey,
      label: new Date(groupKey).toLocaleDateString('en-US', {
        weekday: selectedView === 'Week' ? 'short' : undefined,
        month: 'short',
        day: 'numeric',
        year: selectedView === 'Month' ? 'numeric' : undefined,
      }),
      tasks: groupedTasks.sort(
        (firstTask, secondTask) => new Date(firstTask.deadline).getTime() - new Date(secondTask.deadline).getTime()
      ),
    }));
  }, [selectedView, viewFilteredTasks]);

  useEffect(() => {
    hasLoadedOnceRef.current = true;
  }, [tasks]);

  useEffect(() => {
    currentDateRef.current = currentDate;
  }, [currentDate]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate) {
      updateTasksForSelectedDate(selectedDate, currentDate, tasks);
    } else {
      setSelectedDateTasks([]);
    }
  }, [selectedDate, currentDate, selectedGroupId, tasks, updateTasksForSelectedDate]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-4 pt-12 pb-2 flex-row justify-between items-center">
        <Text className="text-3xl font-bold" style={{ color: colors.text }}>Calendar</Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => loadAllData({ showSpinner: false })} className="p-2">
            <Ionicons name="refresh-outline" size={24} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/notifications' as any)}
            className="relative p-2"
          >
            <Ionicons name="notifications-outline" size={24} color={colors.icon} />
            {unreadNotificationsCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Group Filter Dropdown */}
        <View className="px-4 pt-4 pb-2">
          <TouchableOpacity 
            onPress={() => setShowGroupPicker(true)}
            className="flex-row items-center justify-between rounded-lg p-3 border"
            style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border }}
          >
            <View className="flex-row items-center flex-1">
              <Ionicons name="filter" size={18} color={colors.icon} />
              <Text className="ml-2 font-medium" style={{ color: colors.text }}>
                {selectedGroupId === 'all' ? 'All Groups' : userGroups.find(g => g.id === selectedGroupId)?.name || 'Select Group'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.textSoft} />
          </TouchableOpacity>
        </View>

        {/* Group Color Legend - Show only when "All Groups" selected */}
        {selectedGroupId === 'all' && userGroups.length > 0 && (
          <View className="px-4 pb-3">
            <Text className="text-xs mb-2" style={{ color: colors.textMuted }}>Group Colors:</Text>
            <View className="flex-row flex-wrap gap-2">
              {userGroups.map((group, index) => {
                const colorIndex = index % groupColors.length;
                const color = groupColors[colorIndex];
                return (
                  <View key={group.id} className={`flex-row items-center rounded-full px-2 py-1 ${color.bg}`}>
                    <View className={`w-2 h-2 rounded-full mr-1 ${color.text.replace('text', 'bg')}`} />
                    <Text className={`text-xs ${color.text}`}>{group.name}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Month and Year Navigation */}
        <View className="px-4 mb-4">
          {/* Month Row */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-medium w-16" style={{ color: colors.textMuted }}>Month</Text>
            <View className="flex-row items-center flex-1 justify-center">
              <TouchableOpacity onPress={goToPreviousMonth} className="p-2">
                <Ionicons name="chevron-back" size={22} color={colors.accent} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={openMonthPicker} className="flex-row items-center mx-4">
                <Text className="text-xl font-bold" style={{ color: colors.accent }}>{currentMonth}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.accent} className="ml-1" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={goToNextMonth} className="p-2">
                <Ionicons name="chevron-forward" size={22} color={colors.accent} />
              </TouchableOpacity>
            </View>
            <View className="w-16" />
          </View>

          {/* Year Row */}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium w-16" style={{ color: colors.textMuted }}>Year</Text>
            <View className="flex-row items-center flex-1 justify-center">
              <TouchableOpacity onPress={goToPreviousYear} className="p-2">
                <Ionicons name="chevron-back" size={22} color={colors.textSoft} />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={openYearPicker} className="flex-row items-center mx-4">
                <Text className="text-xl font-bold" style={{ color: colors.text }}>{currentYear}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSoft} className="ml-1" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={goToNextYear} className="p-2">
                <Ionicons name="chevron-forward" size={22} color={colors.textSoft} />
              </TouchableOpacity>
            </View>
            <View className="w-16" />
          </View>
        </View>

        {/* Week Days */}
        <View className="flex-row justify-between px-4 mb-1">
          {dayLabels.map((day: string, index: number) => (
            <Text key={index} className="text-xs font-medium w-8 text-center" style={{ color: colors.textSoft }}>
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar Dates */}
        <View className="px-4 mb-4">
          {weeks.map((week: (number | null)[], weekIndex: number) => (
            <View key={weekIndex} className="flex-row justify-between mb-1">
              {week.map((date: number | null, dateIndex: number) => {
                const isSelected = date === selectedDate;
                const isTodayDate = isToday(date);
                const hasTasks = date ? hasTasksOnDate(date) : false;
                const priorityColor = date ? getHighestPriorityForDate(date) : null;
                
                return (
                  <TouchableOpacity 
                    key={dateIndex} 
                    className="w-8 h-8 items-center justify-center relative"
                    onPress={() => {
                      if (date) {
                        setSelectedDate(date);
                        updateTasksForSelectedDate(date, currentDate, tasks);
                      }
                    }}
                    disabled={!date}
                  >
                    {date ? (
                      <View className={`w-7 h-7 rounded-full items-center justify-center relative
                        ${isSelected ? 'bg-blue-500' : ''}
                        ${isTodayDate && !isSelected ? 'border-2' : ''}
                      `}
                      style={isTodayDate && !isSelected ? { borderColor: colors.accent } : undefined}>
                        <Text
                          className={`text-sm ${isSelected || isTodayDate ? 'font-medium' : ''}`}
                          style={{
                            color: isSelected ? '#FFFFFF' : isTodayDate ? colors.accent : colors.text,
                          }}
                        >
                          {date}
                        </Text>
                        
                        {/* Task indicator dot - shows if there are tasks on this date */}
                        {hasTasks && !isSelected && (
                          <View className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${getPriorityColor(priorityColor || 'Low')}`} />
                        )}
                        
                        {/* For selected date with tasks, show a white dot */}
                        {hasTasks && isSelected && (
                          <View className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white" />
                        )}
                      </View>
                    ) : (
                      <View className="w-7 h-7" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Task count summary */}
        {selectedView === 'Day' && selectedDate && selectedDateTasks.length > 0 && (
          <View className="px-4 mb-2">
            <Text className="text-xs" style={{ color: colors.textMuted }}>
              {selectedDateTasks.length} task{selectedDateTasks.length !== 1 ? 's' : ''} on this day
            </Text>
          </View>
        )}

        {/* Divider */}
        <View className="h-px mx-4 mb-3" style={{ backgroundColor: colors.border }} />

        {/* Priority Tags */}
        <View className="flex-row px-4 mb-3">
          <View className="flex-row items-center mr-4">
            <View className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" />
            <Text className="text-xs" style={{ color: colors.textMuted }}>High</Text>
          </View>
          <View className="flex-row items-center mr-4">
            <View className="w-2.5 h-2.5 rounded-full bg-yellow-500 mr-1.5" />
            <Text className="text-xs" style={{ color: colors.textMuted }}>Medium</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5" />
            <Text className="text-xs" style={{ color: colors.textMuted }}>Low</Text>
          </View>
        </View>

        {/* View Options */}
        <View className="flex-row px-4 mb-4">
          {(['Day', 'Week', 'Month'] as ViewType[]).map((view: ViewType) => (
            <TouchableOpacity 
              key={view} 
              onPress={() => setSelectedView(view)}
              className="mr-4"
            >
              <Text
                className={`text-base ${selectedView === view ? 'font-medium' : ''}`}
                style={{ color: selectedView === view ? colors.accent : colors.textSoft }}
              >
                {view}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Schedule - Shows tasks for selected date */}
        <View className="px-4 pb-20">
          {selectedView === 'Day' ? (
            selectedDate ? (
              schedule.length > 0 && schedule.some(slot => slot.events.length > 0) ? (
                schedule.map((item: ScheduleItem, index: number) => (
                  <View key={index} className="flex-row py-2.5 border-b" style={{ borderBottomColor: colors.border }}>
                    <Text className="w-14 text-sm font-medium" style={{ color: colors.textSoft }}>{item.time}</Text>
                    <View className="flex-1 gap-2">
                      {item.events.map((event: Event, eventIndex: number) => (
                        <TouchableOpacity
                          key={eventIndex}
                          className={`${event.color} rounded px-3 py-1.5`}
                          style={isDark ? { borderWidth: 1, borderColor: colors.border } : undefined}
                          onPress={() => {
                            if (event.taskId) {
                              router.push(`/task/${event.taskId}`);
                            }
                          }}
                        >
                          <Text className={`${event.textColor} font-medium text-sm`}>{event.title}</Text>
                          <Text className={`${event.subColor} text-xs`}>{event.subtitle}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <View className="py-8 items-center">
                  <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
                  <Text className="text-center mt-2" style={{ color: colors.textSoft }}>
                    No tasks scheduled for this date
                  </Text>
                </View>
              )
            ) : (
              <View className="py-8 items-center">
                <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
                <Text className="text-center mt-2" style={{ color: colors.textSoft }}>
                  Select a date to view tasks
                </Text>
              </View>
            )
          ) : (
            viewFilteredTasks.length > 0 ? (
              groupedRangeTasks.map((group) => (
                <View key={group.key} className="mb-5">
                  <Text className="text-sm font-semibold mb-3" style={{ color: colors.textMuted }}>
                    {group.label} - {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
                  </Text>
                  {group.tasks.map((task) => {
                    const taskDate = new Date(task.deadline);
                    const timeLabel = taskDate.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    });
                    const groupName = userGroups.find((groupItem) => groupItem.id === task.groupId)?.name || 'Unknown';
                    const completed = isTaskCompleted(task);

                    return (
                      <TouchableOpacity
                        key={task.id}
                        onPress={() => router.push(`/task/${task.id}`)}
                        className="rounded-2xl p-4 mb-3 border"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1 pr-3">
                            <Text
                              className={`text-base font-semibold ${completed ? 'line-through' : ''}`}
                              style={{ color: completed ? colors.textSoft : colors.text }}
                            >
                              {task.title}
                            </Text>
                            <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
                              {timeLabel} - {groupName}
                            </Text>
                            <Text className="text-xs mt-1" style={{ color: colors.textSoft }}>
                              {completed ? 'Completed' : `${task.priority} Priority`}
                            </Text>
                          </View>
                          <View
                            className="rounded-full px-3 py-1"
                            style={{ backgroundColor: isDark ? colors.surfaceMuted : colors.accentSoft }}
                          >
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: isDark ? colors.textMuted : colors.accent }}
                            >
                              {task.priority}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            ) : (
              <View className="py-8 items-center">
                <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
                <Text className="text-center mt-2" style={{ color: colors.textSoft }}>
                  {selectedView === 'Week' ? 'No tasks found for this week' : 'No tasks found for this month'}
                </Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      {/* Picker Modal */}
      <Modal
        visible={showPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity 
          className="flex-1"
          style={{ backgroundColor: colors.overlay }}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View className="flex-1 justify-end">
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
              className="rounded-t-3xl"
              style={{ backgroundColor: colors.surface }}
            >
              {/* Picker Header */}
              <View className="flex-row justify-between items-center p-4 border-b" style={{ borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text className="text-lg" style={{ color: colors.accent }}>Cancel</Text>
                </TouchableOpacity>
                <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                  Select {pickerType === 'month' ? 'Month' : 'Year'}
                </Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text className="text-lg" style={{ color: colors.accent }}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* Picker Content */}
              {pickerType === 'month' ? (
                <View className="p-4">
                  <View className="flex-row flex-wrap">
                    {fullMonthNames.map((month, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => selectMonth(index)}
                        className="w-1/3 p-3 items-center rounded-lg"
                        style={currentDate.getMonth() === index ? { backgroundColor: colors.accentSoft } : undefined}
                      >
                        <Text
                          className={`text-base ${currentDate.getMonth() === index ? 'font-semibold' : ''}`}
                          style={{ color: currentDate.getMonth() === index ? colors.accent : colors.text }}
                        >
                          {month}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <FlatList
                  data={years}
                  keyExtractor={(item) => item.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => selectYear(item)}
                      className="p-4 border-b"
                      style={{
                        borderBottomColor: colors.border,
                        backgroundColor: currentYear === item ? colors.accentSoft : colors.surface,
                      }}
                    >
                      <Text
                        className={`text-center text-lg ${currentYear === item ? 'font-semibold' : ''}`}
                        style={{ color: currentYear === item ? colors.accent : colors.text }}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  className="max-h-96"
                />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Group Filter Modal */}
      <Modal
        visible={showGroupPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGroupPicker(false)}
      >
        <TouchableOpacity 
          className="flex-1"
          style={{ backgroundColor: colors.overlay }}
          activeOpacity={1}
          onPress={() => setShowGroupPicker(false)}
        >
          <View className="flex-1 justify-end">
            <TouchableOpacity 
              activeOpacity={1}
              className="rounded-t-3xl p-4"
              style={{ backgroundColor: colors.surface }}
            >
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-bold" style={{ color: colors.text }}>Select Group</Text>
                <TouchableOpacity onPress={() => setShowGroupPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.icon} />
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={[{ id: 'all', name: 'All Groups' }, ...userGroups]}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedGroupId(item.id);
                      setShowGroupPicker(false);
                      setSelectedDate(null);
                      setSelectedDateTasks([]);
                    }}
                    className="p-4 border-b flex-row items-center"
                    style={{
                      borderBottomColor: colors.border,
                      backgroundColor: selectedGroupId === item.id ? colors.accentSoft : colors.surface,
                    }}
                  >
                    {item.id !== 'all' && (
                      <View 
                        className={`w-4 h-4 rounded mr-3 ${groupColors[index % groupColors.length].bg}`}
                      />
                    )}
                    <Text
                      className={`text-base ${selectedGroupId === item.id ? 'font-semibold' : ''}`}
                      style={{ color: selectedGroupId === item.id ? colors.accent : colors.text }}
                    >
                      {item.name}
                    </Text>
                    {selectedGroupId === item.id && (
                      <Ionicons name="checkmark" size={20} color={colors.accent} className="ml-auto" />
                    )}
                  </TouchableOpacity>
                )}
                scrollEnabled={true}
                className="max-h-96"
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
