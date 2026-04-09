import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { collection, query, getDocs, where, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../src/Firebase/firebaseConfig";
import { getAuth } from "firebase/auth";

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
        borderColor: 'border-yellow-400',
        badgeBg: 'bg-yellow-100',
        badgeText: 'text-yellow-500'
      };
    case 'Low':
      return {
        borderColor: 'border-blue-400',
        badgeBg: 'bg-blue-100',
        badgeText: 'text-blue-500'
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
  const auth = getAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<'all' | 'todo' | 'completed'>('all');

  useEffect(() => {
    fetchAllTasks();
  }, []);

  const fetchAllTasks = async () => {
    try {
      setLoading(true);
      const tasksRef = collection(db, 'tasks');
      const tasksSnapshot = await getDocs(tasksRef);
      const fetchedTasks: Task[] = [];
      
      tasksSnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedTasks.push({
          id: doc.id,
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
      Alert.alert('Error', 'Failed to load tasks');
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
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      fetchAllTasks();
      Alert.alert('Success', 'Task deleted');
    } catch (error) {
      console.error('Error deleting task:', error);
      Alert.alert('Error', 'Failed to delete task');
    }
  };

  const getDateCategory = (deadline: string) => {
    const taskDate = new Date(deadline);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    if (taskDate.toDateString() === today.toDateString()) return 'Today';
    if (taskDate.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    if (taskDate <= nextWeek) return 'Next Week';
    return 'Later';
  };

  const statusCounts = {
    all: tasks.length,
    todo: tasks.filter(task => !task.completed).length,
    completed: tasks.filter(task => task.completed).length,
  };

  const getFilteredTasks = () => {
    let filtered = tasks;
    if (activeStatus === 'todo') {
      filtered = tasks.filter(task => !task.completed);
    } else if (activeStatus === 'completed') {
      filtered = tasks.filter(task => task.completed);
    }
    return filtered;
  };

  const filteredTasks = getFilteredTasks();
  const groupedTasks: { [key: string]: Task[] } = {};
  
  filteredTasks.forEach(task => {
    const category = getDateCategory(task.deadline);
    if (!groupedTasks[category]) {
      groupedTasks[category] = [];
    }
    groupedTasks[category].push(task);
  });

  const renderTaskSection = (title: string, sectionTasks: Task[]) => {
    if (sectionTasks.length === 0) return null;

    return (
      <View className="mb-6">
        <Text className="text-sm font-medium text-gray-400 mb-3">
          {title}
        </Text>
        
        {sectionTasks.map((task) => {
          const priorityStyles = getPriorityStyles(task.priority);
          
          return (
            <View
              key={task.id}
              className={`bg-white rounded-xl p-4 mb-3 border-l-4 ${priorityStyles.borderColor} flex-row justify-between items-center shadow`}
            >
              <View className="flex-row items-center flex-1">
                <TouchableOpacity onPress={() => toggleTaskComplete(task.id, task.completed)}>
                  <Ionicons
                    name={task.completed ? "checkbox" : "square-outline"}
                    size={20}
                    color={task.completed ? "#22C55E" : "#444"}
                  />
                </TouchableOpacity>
                <View className="ml-3 flex-1">
                  <Text className={`font-semibold text-base ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.title}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Due: {new Date(task.deadline).toLocaleDateString()}
                    {task.description ? ` • ${task.description}` : ''}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2">
                <View className={`${priorityStyles.badgeBg} px-3 py-1 rounded-full`}>
                  <Text className={`text-xs ${priorityStyles.badgeText}`}>
                    {task.priority}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Delete Task', 'Are you sure?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => deleteTask(task.id),
                      },
                    ]);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-100 items-center justify-center">
        <ActivityIndicator size="large" color="#EAB308" />
      </View>
    );
  }

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

          {/* TODO STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('todo')}
            className={`px-6 py-3 rounded-xl mr-3 ${
              activeStatus === 'todo' ? 'bg-blue-500' : 'bg-white'
            } shadow`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'todo' ? 'text-white' : 'text-gray-700'
            }`}>
              To Do ({statusCounts.todo})
            </Text>
          </TouchableOpacity>

          {/* COMPLETED STATUS */}
          <TouchableOpacity 
            onPress={() => setActiveStatus('completed')}
            className={`px-6 py-3 rounded-xl ${
              activeStatus === 'completed' ? 'bg-green-500' : 'bg-white'
            } shadow`}
          >
            <Text className={`font-semibold ${
              activeStatus === 'completed' ? 'text-white' : 'text-gray-700'
            }`}>
              Done ({statusCounts.completed})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* TASKS */}
      {filteredTasks.length === 0 ? (
        <View className="bg-white rounded-xl p-8 items-center mt-10">
          <Ionicons name="clipboard-outline" size={40} color="#D1D5DB" />
          <Text className="text-gray-500 mt-3 text-center">No tasks yet</Text>
        </View>
      ) : (
        <>
          {['Today', 'Tomorrow', 'Next Week', 'Later'].map((category) =>
            renderTaskSection(category, groupedTasks[category] || [])
          )}
        </>
      )}
    </ScrollView>
  );
}