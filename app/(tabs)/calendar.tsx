import { View, Text, ScrollView, TouchableOpacity, Modal, FlatList } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Type definitions
type ViewType = 'Day' | 'Week' | 'Month';

interface Event {
  title: string;
  subtitle: string;
  color: string;
  textColor: string;
  subColor: string;
}

interface ScheduleItem {
  time: string;
  events: Event[];
}

export default function CalendarScreen() {
  const router = useRouter();
  const [selectedView, setSelectedView] = useState<ViewType>('Day');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [pickerType, setPickerType] = useState<'month' | 'year'>('month');
  
  // Get real current date on component mount
  useEffect(() => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.getDate()); // Auto-select today's date
  }, []);

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

  // Navigation functions for month
  const goToPreviousMonth = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  // Navigation functions for year
  const goToPreviousYear = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1));
    setSelectedDate(null);
  };

  const goToNextYear = (): void => {
    setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1));
    setSelectedDate(null);
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
  };

  const selectYear = (year: number): void => {
    setCurrentDate(new Date(year, currentDate.getMonth(), 1));
    setShowPicker(false);
    setSelectedDate(null);
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

  // Schedule data
  const schedule: ScheduleItem[] = [
    { time: '8 AM', events: [] },
    { time: '9 AM', events: [] },
    { time: '10 AM', events: [{ 
      title: 'Team Meeting', 
      subtitle: '10 AM - Work', 
      color: 'bg-blue-100', 
      textColor: 'text-blue-800', 
      subColor: 'text-blue-600' 
    }] },
    { time: '11 AM', events: [] },
    { time: '12 PM', events: [] },
    { time: '1 PM', events: [] },
    { time: '2 PM', events: [{ 
      title: 'Complete Proposal', 
      subtitle: '2:30 PM - School', 
      color: 'bg-green-100', 
      textColor: 'text-green-800', 
      subColor: 'text-green-600' 
    }] },
    { time: '3 PM', events: [] },
    { time: '4 PM', events: [] },
    { time: '5 PM', events: [{ 
      title: 'Review Design', 
      subtitle: '5:00 PM - School', 
      color: 'bg-purple-100', 
      textColor: 'text-purple-800', 
      subColor: 'text-purple-600' 
    }] },
    { time: '6 PM', events: [] },
  ];

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="px-4 pt-12 pb-2">
        <Text className="text-3xl font-bold">Calendar</Text>
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
                
                return (
                  <TouchableOpacity 
                    key={dateIndex} 
                    className="w-8 h-8 items-center justify-center"
                    onPress={() => date && setSelectedDate(date)}
                    disabled={!date}
                  >
                    {date ? (
                      <View className={`w-7 h-7 rounded-full items-center justify-center 
                        ${isSelected ? 'bg-blue-500' : ''}
                        ${isTodayDate && !isSelected ? 'border-2 border-blue-500' : ''}
                      `}>
                        <Text className={`text-sm 
                          ${isSelected ? 'text-white font-medium' : 
                            isTodayDate ? 'text-blue-500 font-medium' : 'text-gray-700'}
                        `}>
                          {date}
                        </Text>
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

        {/* Schedule */}
        <View className="px-4 pb-20">
          {schedule.map((item: ScheduleItem, index: number) => (
            <View key={index} className="flex-row py-2.5 border-b border-gray-100">
              <Text className="w-14 text-sm text-gray-400 font-medium">{item.time}</Text>
              <View className="flex-1">
                {item.events.map((event: Event, eventIndex: number) => (
                  <View key={eventIndex} className={`${event.color} rounded px-3 py-1.5`}>
                    <Text className={`${event.textColor} font-medium text-sm`}>{event.title}</Text>
                    <Text className={`${event.subColor} text-xs`}>{event.subtitle}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
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