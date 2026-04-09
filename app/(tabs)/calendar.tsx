import { View, Text, ScrollView, TouchableOpacity, Modal, FlatList, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../src/Firebase/firebaseConfig';

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
}

interface Group {
  id: string;
  name: string;
  members: string[];
}

export default function CalendarScreen() {
  const router = useRouter();
  const auth = getAuth();
  const currentUser = auth.currentUser;
  
  const [selectedView, setSelectedView] = useState<ViewType>('Day');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [pickerType, setPickerType] = useState<'month' | 'year'>('month');
  
  // Database states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDateTasks, setSelectedDateTasks] = useState<Task[]>([]);
  
  // Get real current date on component mount
  useEffect(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.getDate()); // Auto-select today's date
    fetchUserTasks();
  }, []);

  // Fetch user's groups and their tasks
  const fetchUserTasks = async () => {
    if (!currentUser?.uid) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // First, get all groups the user is a member of
      const groupsRef = collection(db, 'groups');
      const groupsQuery = query(groupsRef, where('members', 'array-contains', currentUser.uid));
      const groupsSnapshot = await getDocs(groupsQuery);
      
      const userGroupIds: string[] = [];
      const groupsData: Group[] = [];
      
      groupsSnapshot.forEach((doc) => {
        const groupData = { id: doc.id, ...doc.data() } as Group;
        userGroupIds.push(doc.id);
        groupsData.push(groupData);
      });
      
      setUserGroups(groupsData);
      
      if (userGroupIds.length === 0) {
        setTasks([]);
        setIsLoading(false);
        return;
      }
      
      // Fetch tasks from all user's groups
      const tasksRef = collection(db, 'tasks');
      const allTasks: Task[] = [];
      
      // Query tasks for each group (Firestore doesn't support 'in' with complex conditions)
      for (const groupId of userGroupIds) {
        const tasksQuery = query(tasksRef, where('groupId', '==', groupId));
        const tasksSnapshot = await getDocs(tasksQuery);
        
        tasksSnapshot.forEach((doc) => {
          const taskData = doc.data();
          allTasks.push({
            id: doc.id,
            title: taskData.title || '',
            description: taskData.description || '',
            priority: taskData.priority || 'Medium',
            deadline: taskData.deadline || '',
            assignedTo: taskData.assignedTo || [],
            completed: taskData.completed || false,
            createdBy: taskData.createdBy || '',
            groupId: taskData.groupId || '',
            createdAt: taskData.createdAt,
          });
        });
      }
      
      setTasks(allTasks);
      
      // Update tasks for selected date
      if (selectedDate) {
        updateTasksForSelectedDate(selectedDate);
      }
      
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update tasks for the selected date
  const updateTasksForSelectedDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const tasksForDate = getTasksForDate(date);
    setSelectedDateTasks(tasksForDate);
  };

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

  // Get tasks for a specific date
  const getTasksForDate = (date: Date): Task[] => {
    return tasks.filter((task) => {
      if (!task.deadline) return false;
      const taskDate = new Date(task.deadline);
      return (
        taskDate.getDate() === date.getDate() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Convert task to calendar event
  const taskToEvent = (task: Task): Event => {
    let color = 'bg-blue-100';
    let textColor = 'text-blue-800';
    let subColor = 'text-blue-600';
    
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
    
    const taskDate = new Date(task.deadline);
    const timeString = taskDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return {
      title: task.title,
      subtitle: `${timeString} - ${task.completed ? '✓ Completed' : 'Pending'} • ${task.priority} Priority`,
      color: color,
      textColor: textColor,
      subColor: subColor,
      taskId: task.id,
    };
  };

  // Generate schedule from tasks for selected date
  const generateScheduleFromTasks = (): ScheduleItem[] => {
    const timeSlots: ScheduleItem[] = [];
    
    // Create time slots from 8 AM to 8 PM
    for (let hour = 8; hour <= 20; hour++) {
      const displayHour = hour > 12 ? hour - 12 : hour;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const timeString = `${displayHour} ${ampm}`;
      
      timeSlots.push({
        time: timeString,
        events: [],
      });
    }
    
    // Add tasks to their respective time slots
    selectedDateTasks.forEach((task) => {
      const taskDate = new Date(task.deadline);
      const taskHour = taskDate.getHours();
      
      // Find the matching time slot (8-20 range)
      if (taskHour >= 8 && taskHour <= 20) {
        const slotIndex = taskHour - 8;
        if (slotIndex >= 0 && slotIndex < timeSlots.length) {
          timeSlots[slotIndex].events.push(taskToEvent(task));
        }
      }
    });
    
    return timeSlots;
  };

  // Generate weeks array for current month
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
  
  // Generate schedule from tasks
  const schedule: ScheduleItem[] = generateScheduleFromTasks();

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-12 pb-2 flex-row justify-between items-center">
        <Text className="text-3xl font-bold">Calendar</Text>
        <TouchableOpacity onPress={fetchUserTasks} className="p-2">
          <Ionicons name="refresh-outline" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Month and Year Navigation */}
        <View className="px-4 mb-4">
          {/* Month Row */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-medium text-gray-500 w-16">Month</Text>
            <View className="flex-row items-center flex-1 justify-center">
              <TouchableOpacity onPress={goToPreviousMonth} className="p-2">
                <Ionicons name="chevron-back" size={22} color="#3B82F6" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={openMonthPicker} className="flex-row items-center mx-4">
                <Text className="text-xl font-bold text-blue-500">{currentMonth}</Text>
                <Ionicons name="chevron-down" size={18} color="#3B82F6" className="ml-1" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={goToNextMonth} className="p-2">
                <Ionicons name="chevron-forward" size={22} color="#3B82F6" />
              </TouchableOpacity>
            </View>
            <View className="w-16" />
          </View>

          {/* Year Row */}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-gray-500 w-16">Year</Text>
            <View className="flex-row items-center flex-1 justify-center">
              <TouchableOpacity onPress={goToPreviousYear} className="p-2">
                <Ionicons name="chevron-back" size={22} color="#9CA3AF" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={openYearPicker} className="flex-row items-center mx-4">
                <Text className="text-xl font-bold text-gray-700">{currentYear}</Text>
                <Ionicons name="chevron-down" size={18} color="#9CA3AF" className="ml-1" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={goToNextYear} className="p-2">
                <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View className="w-16" />
          </View>
        </View>

        {/* Week Days */}
        <View className="flex-row justify-between px-4 mb-1">
          {dayLabels.map((day: string, index: number) => (
            <Text key={index} className="text-xs font-medium text-gray-400 w-8 text-center">
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
                        updateTasksForSelectedDate(date);
                      }
                    }}
                    disabled={!date}
                  >
                    {date ? (
                      <View className={`w-7 h-7 rounded-full items-center justify-center relative
                        ${isSelected ? 'bg-blue-500' : ''}
                        ${isTodayDate && !isSelected ? 'border-2 border-blue-500' : ''}
                      `}>
                        <Text className={`text-sm 
                          ${isSelected ? 'text-white font-medium' : 
                            isTodayDate ? 'text-blue-500 font-medium' : 'text-gray-700'}
                        `}>
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
        {selectedDate && selectedDateTasks.length > 0 && (
          <View className="px-4 mb-2">
            <Text className="text-xs text-gray-500">
              {selectedDateTasks.length} task{selectedDateTasks.length !== 1 ? 's' : ''} on this day
            </Text>
          </View>
        )}

        {/* Divider */}
        <View className="h-px bg-gray-200 mx-4 mb-3" />

        {/* Priority Tags */}
        <View className="flex-row px-4 mb-3">
          <View className="flex-row items-center mr-4">
            <View className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5" />
            <Text className="text-xs text-gray-500">High</Text>
          </View>
          <View className="flex-row items-center mr-4">
            <View className="w-2.5 h-2.5 rounded-full bg-yellow-500 mr-1.5" />
            <Text className="text-xs text-gray-500">Medium</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5" />
            <Text className="text-xs text-gray-500">Low</Text>
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
              <Text className={`text-base ${selectedView === view ? 'text-blue-500 font-medium' : 'text-gray-300'}`}>
                {view}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Schedule - Shows tasks for selected date */}
        <View className="px-4 pb-20">
          {selectedDate ? (
            schedule.length > 0 && schedule.some(slot => slot.events.length > 0) ? (
              schedule.map((item: ScheduleItem, index: number) => (
                <View key={index} className="flex-row py-2.5 border-b border-gray-100">
                  <Text className="w-14 text-sm text-gray-400 font-medium">{item.time}</Text>
                  <View className="flex-1 gap-2">
                    {item.events.map((event: Event, eventIndex: number) => (
                      <TouchableOpacity 
                        key={eventIndex} 
                        className={`${event.color} rounded px-3 py-1.5`}
                        onPress={() => {
                          // Navigate to task details if needed
                          if (event.taskId) {
                            // router.push(`/task/${event.taskId}`);
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
                <Text className="text-gray-400 text-center mt-2">
                  No tasks scheduled for this date
                </Text>
              </View>
            )
          ) : (
            <View className="py-8 items-center">
              <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
              <Text className="text-gray-400 text-center mt-2">
                Select a date to view tasks
              </Text>
            </View>
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
          className="flex-1 bg-black/50"
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View className="flex-1 justify-end">
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl"
            >
              {/* Picker Header */}
              <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text className="text-blue-500 text-lg">Cancel</Text>
                </TouchableOpacity>
                <Text className="text-lg font-semibold">
                  Select {pickerType === 'month' ? 'Month' : 'Year'}
                </Text>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text className="text-blue-500 text-lg">Done</Text>
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
                        className={`w-1/3 p-3 items-center rounded-lg ${
                          currentDate.getMonth() === index ? 'bg-blue-50' : ''
                        }`}
                      >
                        <Text className={`text-base ${
                          currentDate.getMonth() === index ? 'text-blue-500 font-semibold' : 'text-gray-700'
                        }`}>
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
                      className={`p-4 border-b border-gray-100 ${
                        currentYear === item ? 'bg-blue-50' : ''
                      }`}
                    >
                      <Text className={`text-center text-lg ${
                        currentYear === item ? 'text-blue-500 font-semibold' : 'text-gray-700'
                      }`}>
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
    </View>
  );
}