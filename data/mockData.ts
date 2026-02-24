export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  priority: 'High' | 'Medium' | 'Low';
  groupId: string;
  completed: boolean;
  createdAt: Date;
}

export interface Group {
  id: string;
  name: string;
  icon: string; // emoji or icon name
  color: string;
  taskCount: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export const mockUser: User = {
  id: '1',
  name: 'Mark',
  email: 'mark@example.com',
  avatar: '👤',
};

export const mockGroups: Group[] = [
  {
    id: '1',
    name: 'School',
    icon: '🎓',
    color: '#FF6B6B',
    taskCount: 5,
  },
  {
    id: '2',
    name: 'Work',
    icon: '💼',
    color: '#4ECDC4',
    taskCount: 8,
  },
  {
    id: '3',
    name: 'Family',
    icon: '👨‍👩‍👧',
    color: '#45B7D1',
    taskCount: 3,
  },
];

export const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Complete math homework',
    description: 'Chapter 5 exercises',
    dueDate: new Date(2024, 0, 15, 17, 0), // Jan 15, 5 PM
    priority: 'High',
    groupId: '1',
    completed: false,
    createdAt: new Date(2024, 0, 10),
  },
  {
    id: '2',
    title: 'Prepare presentation',
    description: 'Q1 sales report',
    dueDate: new Date(2024, 0, 16, 9, 0),
    priority: 'Medium',
    groupId: '2',
    completed: false,
    createdAt: new Date(2024, 0, 12),
  },
  {
    id: '3',
    title: 'Buy groceries',
    description: 'Weekly shopping list',
    dueDate: new Date(2024, 0, 14, 18, 0),
    priority: 'Low',
    groupId: '3',
    completed: true,
    createdAt: new Date(2024, 0, 13),
  },
  {
    id: '4',
    title: 'Review code changes',
    description: 'Pull request #123',
    dueDate: new Date(2024, 0, 17, 14, 0),
    priority: 'High',
    groupId: '2',
    completed: false,
    createdAt: new Date(2024, 0, 14),
  },
  {
    id: '5',
    title: 'Call mom',
    description: 'Weekly check-in',
    dueDate: new Date(2024, 0, 15, 19, 0),
    priority: 'Medium',
    groupId: '3',
    completed: false,
    createdAt: new Date(2024, 0, 13),
  },
];

export const getTasksByStatus = (status: 'To Do' | 'In Progress' | 'Completed') => {
  switch (status) {
    case 'To Do':
      return mockTasks.filter(task => !task.completed);
    case 'In Progress':
      return mockTasks.filter(task => !task.completed); // For now, all incomplete are in progress
    case 'Completed':
      return mockTasks.filter(task => task.completed);
    default:
      return mockTasks;
  }
};

export const getTasksCount = () => {
  const toDo = mockTasks.filter(task => !task.completed).length;
  const inProgress = toDo; // Simplified
  const completed = mockTasks.filter(task => task.completed).length;
  return { toDo, inProgress, completed };
};

export const getGroupById = (id: string) => mockGroups.find(group => group.id === id);

export const getTasksByGroup = (groupId: string) => mockTasks.filter(task => task.groupId === groupId);
