import { create } from 'zustand'
import * as Crypto from 'expo-crypto'
import { format } from 'date-fns'

// 生成 UUID 的函数
const generateUUID = () => Crypto.randomUUID()
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Task, TimeSlot, Project, Habit, ThemeColor, UserProfile } from '../types'

interface AppState {
  // 数据
  tasks: Task[]
  timeSlots: TimeSlot[]
  projects: Project[]
  habits: Habit[]
  
  // UI 状态
  themeColor: ThemeColor
  
  // 用户
  user: UserProfile | null
  
  // Actions
  setThemeColor: (color: ThemeColor) => void
  setUser: (user: UserProfile | null) => void
  
  // Task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  
  // TimeSlot actions
  addTimeSlot: (slot: Omit<TimeSlot, 'id'>) => void
  updateTimeSlot: (id: string, updates: Partial<TimeSlot>) => void
  removeTimeSlot: (id: string) => void
  
  // Habit actions
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'records'>) => void
  toggleHabitDate: (habitId: string, date: string) => void
  deleteHabit: (id: string) => void
  
  // 数据持久化
  loadData: () => Promise<void>
  saveData: () => Promise<void>
}

// 示例数据
const createSampleTasks = (): Task[] => {
  const today = format(new Date(), 'yyyy-MM-dd')
  return [
    {
      id: generateUUID(),
      title: '完成项目报告',
      description: '准备季度报告的数据分析部分',
      dueDate: today,
      priority: 'high',
      tags: ['工作', '重要'],
      subtasks: [
        { id: generateUUID(), title: '收集数据', completed: true },
        { id: generateUUID(), title: '分析趋势', completed: false },
        { id: generateUUID(), title: '撰写报告', completed: false },
      ],
      status: 'in_progress',
      estimatedMinutes: 120,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      title: '健身锻炼',
      description: '去健身房进行力量训练',
      dueDate: today,
      priority: 'medium',
      tags: ['健康'],
      subtasks: [],
      status: 'pending',
      estimatedMinutes: 60,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      title: '学习 React Native',
      description: '完成移动端开发教程',
      dueDate: today,
      priority: 'medium',
      tags: ['学习', '技术'],
      subtasks: [
        { id: generateUUID(), title: '阅读文档', completed: true },
        { id: generateUUID(), title: '完成练习项目', completed: false },
      ],
      status: 'pending',
      estimatedMinutes: 90,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
}

const createSampleHabits = (): Habit[] => {
  return [
    {
      id: generateUUID(),
      name: '早起',
      icon: '🌅',
      color: '#F59E0B',
      frequency: 'daily',
      customDays: [],
      records: {},
      createdAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: '阅读',
      icon: '📚',
      color: '#8B5CF6',
      frequency: 'daily',
      customDays: [],
      records: {},
      createdAt: new Date().toISOString(),
    },
    {
      id: generateUUID(),
      name: '运动',
      icon: '🏃',
      color: '#10B981',
      frequency: 'daily',
      customDays: [],
      records: {},
      createdAt: new Date().toISOString(),
    },
  ]
}

const useStore = create<AppState>((set, get) => ({
  tasks: createSampleTasks(),
  timeSlots: [],
  projects: [],
  habits: createSampleHabits(),
  themeColor: 'ocean',
  user: null,

  setThemeColor: (themeColor) => {
    set({ themeColor })
    AsyncStorage.setItem('lucky-todo-theme', themeColor)
  },

  setUser: (user) => set({ user }),

  addTask: (taskData) => {
    const newTask: Task = {
      ...taskData,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set((state) => ({ tasks: [...state.tasks, newTask] }))
    get().saveData()
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? { ...task, ...updates, updatedAt: new Date().toISOString() }
          : task
      ),
    }))
    get().saveData()
  },

  deleteTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    }))
    get().saveData()
  },

  toggleSubtask: (taskId, subtaskId) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            subtasks: task.subtasks.map((st) =>
              st.id === subtaskId ? { ...st, completed: !st.completed } : st
            ),
            updatedAt: new Date().toISOString(),
          }
        }
        return task
      }),
    }))
    get().saveData()
  },

  addTimeSlot: (slotData) => {
    const newSlot: TimeSlot = { ...slotData, id: generateUUID() }
    set((state) => ({ timeSlots: [...state.timeSlots, newSlot] }))
    get().saveData()
  },

  updateTimeSlot: (id, updates) => {
    set((state) => ({
      timeSlots: state.timeSlots.map((slot) =>
        slot.id === id ? { ...slot, ...updates } : slot
      ),
    }))
    get().saveData()
  },

  removeTimeSlot: (id) => {
    set((state) => ({
      timeSlots: state.timeSlots.filter((slot) => slot.id !== id),
    }))
    get().saveData()
  },

  addHabit: (habitData) => {
    const newHabit: Habit = {
      ...habitData,
      id: generateUUID(),
      records: {},
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ habits: [...state.habits, newHabit] }))
    get().saveData()
  },

  toggleHabitDate: (habitId, date) => {
    set((state) => ({
      habits: state.habits.map((habit) => {
        if (habit.id === habitId) {
          const newRecords = { ...habit.records }
          newRecords[date] = !newRecords[date]
          return { ...habit, records: newRecords }
        }
        return habit
      }),
    }))
    get().saveData()
  },

  deleteHabit: (id) => {
    set((state) => ({
      habits: state.habits.filter((habit) => habit.id !== id),
    }))
    get().saveData()
  },

  loadData: async () => {
    try {
      const [tasksJson, timeSlotsJson, habitsJson, themeJson] = await Promise.all([
        AsyncStorage.getItem('lucky-todo-tasks'),
        AsyncStorage.getItem('lucky-todo-timeSlots'),
        AsyncStorage.getItem('lucky-todo-habits'),
        AsyncStorage.getItem('lucky-todo-theme'),
      ])

      const updates: Partial<AppState> = {}

      if (tasksJson) {
        updates.tasks = JSON.parse(tasksJson)
      }
      if (timeSlotsJson) {
        updates.timeSlots = JSON.parse(timeSlotsJson)
      }
      if (habitsJson) {
        updates.habits = JSON.parse(habitsJson)
      }
      if (themeJson) {
        updates.themeColor = themeJson as ThemeColor
      }

      if (Object.keys(updates).length > 0) {
        set(updates)
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  },

  saveData: async () => {
    try {
      const state = get()
      await Promise.all([
        AsyncStorage.setItem('lucky-todo-tasks', JSON.stringify(state.tasks)),
        AsyncStorage.setItem('lucky-todo-timeSlots', JSON.stringify(state.timeSlots)),
        AsyncStorage.setItem('lucky-todo-habits', JSON.stringify(state.habits)),
      ])
    } catch (error) {
      console.error('保存数据失败:', error)
    }
  },
}))

export default useStore
