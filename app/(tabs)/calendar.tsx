import { View, Text, ScrollView, TouchableOpacity, Modal, FlatList, ActivityIndicator, Alert } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../src/Firebase/firebaseConfig";

type ViewType = 'Month';

interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  completed: boolean;
  groupId: string;
  createdBy: string;
  createdAt: any;
}

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedView, setSelectedView] = useState<ViewType>('Month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [pickerType, setPickerType] = useState<'month' | 'year'>('month');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.getDate());
    fetchAllTasks();
  }, []);

  const fetchAllTasks = async () => {
    try {
      setLoading(true);
      const tasksRef = collection(db, 'tasks');
      const tasksSnapshot = await getDocs(tasksRef);
      const fetchedTasks: Task[] = [];
      
      tasksSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedTasks.push({
          id: docSnap.id,
          title: data.title || '',
          description: data.description || '',
          deadline: data.deadline || '',
          priority: data.priority || 'Medium',
          completed: data.completed || false,
          groupId: data.groupId || '',
          createdBy: data.createdBy || '',
          createdAt: data.createdAt,
        });
      });
      
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskComplete = async (taskId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        completed: !currentStatus,
      });
      fetchAllTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      fetchAllTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

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

  const hasTasksOnDate = (day: number | null): boolean => {
    if (!day) return false;
    const dateToCheck = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return tasks.some((task) => {
      const taskDate = new Date(task.deadline);
      return taskDate.toDateString() === dateToCheck.toDateString();
    });
  };

  const getTasksForDate = (day: number | null): Task[] => {
    if (!day) return [];
    const dateToCheck = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return tasks.filter((task) => {
      const taskDate = new Date(task.deadline);
      return taskDate.toDateString() === dateToCheck.toDateString();
    });
  };

  const goToPreviousMonth = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const goToPreviousYear = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1));
    setSelectedDate(null);
  };

  const goToNextYear = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1));
    setSelectedDate(null);
  };

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
  };

  const selectYear = (year: number): void => {
    setCurrentDate(new Date(year, currentDate.getMonth(), 1));
    setShowPicker(false);
    setSelectedDate(null);
  };

  const generateYears = (): number[] => {
    const years: number[] = [];
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 50; i <= currentYear + 50; i++) {
      years.push(i);
    }
    return years;
  };

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const generateWeeks = (): (number | null)[][] => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = Array(7).fill(null);
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).getDay();
      week[dayOfWeek] = i;
      
      if (dayOfWeek === 6 || i === daysInMonth) {
        weeks.push([...week]);
        week = Array(7).fill(null);
      }
    }
    
    return weeks;
  };

  const weeks: (number | null)[][] = generateWeeks();
  const dayLabels: string[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const years: number[] = generateYears();

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

  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#EAB308" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 px-4 pt-6">
      {/* Your existing calendar UI here... */}
      {/* (Keep the return statement from the first version) */}
    </ScrollView>
  );
}