import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

interface Task {
  id: number;
  title: string;
  category: string;
  dueDate?: string;
  dueTime: string;
  priority: 'High' | 'Medium';
  dateType: 'today' | 'tomorrow' | 'nextWeek';
  status: 'todo' | 'inProgress' | 'completed';
  done: boolean;
}

const taskList: Task[] = [
  { 
    id: 1, 
    title: "Complete Proposal", 
    category: "School",
    dueTime: "2:30PM",
    priority: "High",
    dateType: "today",
    status: "todo",
    done: false,
  },
  { 
    id: 2, 
    title: "Review Design", 
    category: "Work",
    dueTime: "5:00PM",
    priority: "Medium",
    dateType: "today",
    status: "inProgress",
    done: false,
  },
  { 
    id: 3, 
    title: "Manage Emails", 
    category: "Work",
    dueTime: "3:00PM",
    priority: "High",
    dateType: "tomorrow",
    status: "todo",
    done: false,
  },
  { 
    id: 4, 
    title: "Bill Payment", 
    category: "Work",
    dueDate: "02/11",
    dueTime: "6:00PM",
    priority: "High",
    dateType: "nextWeek",
    status: "todo",
    done: false,
  },
  { 
    id: 5, 
    title: "Team Meeting", 
    category: "Work",
    dueTime: "10:00AM",
    priority: "Medium",
    dateType: "today",
    status: "completed",
    done: true,
  },
];

const getPriorityStyles = (priority: string) => {
  switch (priority) {
    case 'High':
      return {
        borderColor: 'border-red-400',
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-500'
      };
    case 'Medium':
      return {
        borderColor: 'border-orange-400',
        badgeBg: 'bg-orange-100',
        badgeText: 'text-orange-500'
      };
    default:
      return {
        borderColor: 'border-gray-400',
        badgeBg: 'bg-gray-100',
        badgeText: 'text-gray-500'
      };
  }
};

export default function Tasks() {
  const [activeStatus, setActiveStatus] = useState<'all' | 'todo' | 'inProgress' | 'completed'>('all');

  const statusCounts = {
    all: taskList.length,
    todo: taskList.filter(task => task.status === 'todo').length,
    inProgress: taskList.filter(task => task.status === 'inProgress').length,
    completed: taskList.filter(task => task.status === 'completed').length,
  };

  const getFilteredTasks = () => {
    if (activeStatus === 'all') return taskList;
    return taskList.filter(task => task.status === activeStatus);
  };

  const filteredTasks = getFilteredTasks();

  const todayTasks = filteredTasks.filter(task => task.dateType === 'today');
  const tomorrowTasks = filteredTasks.filter(task => task.dateType === 'tomorrow');
  const nextWeekTasks = filteredTasks.filter(task => task.dateType === 'nextWeek');

  const renderTaskSection = (title: string, tasks: Task[]) => {
    if (tasks.length === 0) return null;

    return (
      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-400 mb-3">
          {title}
        </Text>
        
        {tasks.map((task) => {
          const priorityStyles = getPriorityStyles(task.priority);
          
          return (
            <View
              key={task.id}
              className={`bg-white rounded-xl p-4 mb-3 border-l-4 ${priorityStyles.borderColor} flex-row justify-between items-center shadow`}
            >
              <View className="flex-row items-center flex-1">
                <Ionicons
                  name={task.done ? "checkbox" : "square-outline"}
                  size={20}
                  color={task.done ? "green" : "#444"}
                />
                <View className="ml-3 flex-1">
                  <Text className="font-semibold text-base">
                    {task.title}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {task.category} • Due: {task.dueTime}
                    {task.dueDate ? ` • ${task.dueDate}` : ''}
                  </Text>
                </View>
              </View>

              <View className={`${priorityStyles.badgeBg} px-3 py-1 rounded-full ml-2`}>
                <Text className={`text-xs ${priorityStyles.badgeText}`}>
                  {task.priority}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView className="flex-1 bg-gray-100 px-5 pt-10">
      {/* HEADER */}
      <View className="flex-row justify-between items-center mb-6">
        <View className="flex-row items-center">
          <Text className="text-xl font-bold text-orange-500">
            COHERA
          </Text>
        </View>
        <Ionicons name="notifications-outline" size={22} color="#444" />
      </View>

      {/* PAGE TITLE */}
      <Text className="text-2xl font-bold text-gray-800 mb-6">
        Tasks
      </Text>

      {/* SEARCH PLACEHOLDER */}
      <Text className="text-sm text-gray-400 mb-4">
        Search tasks...
      </Text>

      {/* HORIZONTAL STATUS FILTER */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="mb-6"
      >
        <View className="flex-row space-x-3">
          {/* ALL STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('all')}
            className={`px-6 py-3 rounded-xl mr-3 ${
              activeStatus === 'all' ? 'bg-orange-500' : 'bg-white'
            } shadow`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'all' ? 'text-white' : 'text-gray-700'
            }`}>
              All ({statusCounts.all})
            </Text>
          </TouchableOpacity>

          {/* TO DO STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('todo')}
            className={`px-6 py-3 rounded-xl mr-3 ${
              activeStatus === 'todo' ? 'bg-orange-500' : 'bg-white'
            } shadow`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'todo' ? 'text-white' : 'text-gray-700'
            }`}>
              To Do ({statusCounts.todo})
            </Text>
          </TouchableOpacity>

          {/* IN PROGRESS STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('inProgress')}
            className={`px-6 py-3 rounded-xl mr-3 ${
              activeStatus === 'inProgress' ? 'bg-orange-500' : 'bg-white'
            } shadow`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'inProgress' ? 'text-white' : 'text-gray-700'
            }`}>
              In Progress ({statusCounts.inProgress})
            </Text>
          </TouchableOpacity>

          {/* COMPLETED STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('completed')}
            className={`px-6 py-3 rounded-xl ${
              activeStatus === 'completed' ? 'bg-orange-500' : 'bg-white'
            } shadow`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'completed' ? 'text-white' : 'text-gray-700'
            }`}>
              Completed ({statusCounts.completed})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* DIVIDER */}
      <View className="h-px bg-gray-200 mb-6" />

      {/* TASK SECTIONS */}
      {renderTaskSection("TODAY - February 05, 2026", todayTasks)}
      {renderTaskSection("TOMORROW - February 06, 2026", tomorrowTasks)}
      {renderTaskSection("NEXT WEEK", nextWeekTasks)}
      
      {filteredTasks.length === 0 && (
        <View className="items-center justify-center py-10">
          <Ionicons name="checkmark-circle-outline" size={50} color="#ccc" />
          <Text className="text-gray-400 mt-3">No tasks in this category</Text>
        </View>
      )}
    </ScrollView>
  );
}