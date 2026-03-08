import { create } from 'zustand'
import * as Crypto from 'expo-crypto'
import { format } from 'date-fns'

// 生成 UUID 的函数
const generateUUID = () => Crypto.randomUUID()
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Task, TimeSlot, Project, ProjectPhase, Habit, CourseSlot, ThemeColor, UserProfile } from '../types'
import { deleteCloudHabit, deleteCloudHabitByName } from '../lib/cloudSync'

interface AppState {
  // 数据
  tasks: Task[]
  timeSlots: TimeSlot[]
  projects: Project[]
  habits: Habit[]
  courses: CourseSlot[]
  semesterStart: string | null
  courseGoals: Record<string, { taskId: string; taskTitle: string }[]>
  
  // UI 状态
  themeColor: ThemeColor
  darkMode: boolean
  
  // 用户
  user: UserProfile | null
  
  // Actions
  setThemeColor: (color: ThemeColor) => void
  setDarkMode: (dark: boolean) => void
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
  
  // Project actions
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  addProjectPhase: (projectId: string, phase: Omit<ProjectPhase, 'id' | 'order'>) => void
  updateProjectPhase: (projectId: string, phaseId: string, updates: Partial<ProjectPhase>) => void
  deleteProjectPhase: (projectId: string, phaseId: string) => void
  toggleProjectTask: (projectId: string, phaseId: string, taskId: string) => void
  
  // Habit actions
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'records'>) => void
  toggleHabitDate: (habitId: string, date: string) => void
  deleteHabit: (id: string) => void
  
  // Course actions
  setCourses: (courses: CourseSlot[]) => void
  clearCourses: () => void
  setSemesterStart: (date: string) => void
  addCourseGoal: (courseId: string, date: string, taskId: string, taskTitle: string) => void
  removeCourseGoal: (courseId: string, date: string, goalIndex: number) => void
  
  // 数据持久化
  loadData: () => Promise<void>
  saveData: () => Promise<void>
  setSyncData: (data: { tasks: Task[]; timeSlots: TimeSlot[]; projects: Project[]; habits: Habit[] }) => void
}


const useStore = create<AppState>((set, get) => ({
  tasks: [],
  timeSlots: [],
  projects: [],
  habits: [],
  courses: [],
  semesterStart: null,
  courseGoals: {},
  themeColor: 'ocean',
  darkMode: false,
  user: null,

  setThemeColor: (themeColor) => {
    set({ themeColor })
    AsyncStorage.setItem('lucky-todo-theme', themeColor)
  },

  setDarkMode: (darkMode) => {
    set({ darkMode })
    AsyncStorage.setItem('lucky-todo-dark-mode', JSON.stringify(darkMode))
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
      tasks: state.tasks.map((task) => {
        if (task.id !== id) return task
        
        const updatedTask = { ...task, ...updates, updatedAt: new Date().toISOString() }
        
        // 如果主任务标记为完成，自动将所有子任务也标记为完成
        if (updates.status === 'completed' && task.subtasks.length > 0) {
          updatedTask.subtasks = task.subtasks.map(st => ({ ...st, completed: true }))
        }
        // 如果主任务标记为未完成，保持子任务状态不变（用户可能只想重新开始部分子任务）
        
        return updatedTask
      }),
    }))
    get().saveData()
  },

  deleteTask: (id) => {
    const deletedAt = new Date().toISOString()
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id
          ? { ...task, status: 'cancelled', deletedAt, updatedAt: deletedAt }
          : task
      ),
      // 任务删除后，同步移除相关时间块，避免悬挂数据
      timeSlots: state.timeSlots.filter((slot) => slot.taskId !== id),
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
    const newSlot: TimeSlot = { ...slotData, id: generateUUID(), updatedAt: new Date().toISOString() }
    set((state) => ({ timeSlots: [...state.timeSlots, newSlot] }))
    get().saveData()
  },

  updateTimeSlot: (id, updates) => {
    set((state) => ({
      timeSlots: state.timeSlots.map((slot) =>
        slot.id === id ? { ...slot, ...updates, updatedAt: new Date().toISOString() } : slot
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

  addProject: (projectData) => {
    const newProject: Project = {
      ...projectData,
      id: generateUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set((state) => ({ projects: [...state.projects, newProject] }))
    get().saveData()
  },

  updateProject: (id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    }))
    get().saveData()
  },

  deleteProject: (id) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }))
    get().saveData()
  },

  addProjectPhase: (projectId, phaseData) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p
        const newPhase: ProjectPhase = {
          ...phaseData,
          id: generateUUID(),
          order: p.phases.length,
        }
        return { ...p, phases: [...p.phases, newPhase], updatedAt: new Date().toISOString() }
      }),
    }))
    get().saveData()
  },

  updateProjectPhase: (projectId, phaseId, updates) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p
        return {
          ...p,
          phases: p.phases.map((ph) => (ph.id === phaseId ? { ...ph, ...updates } : ph)),
          updatedAt: new Date().toISOString(),
        }
      }),
    }))
    get().saveData()
  },

  deleteProjectPhase: (projectId, phaseId) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p
        return {
          ...p,
          phases: p.phases.filter((ph) => ph.id !== phaseId),
          updatedAt: new Date().toISOString(),
        }
      }),
    }))
    get().saveData()
  },

  toggleProjectTask: (projectId, phaseId, taskId) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p
        return {
          ...p,
          phases: p.phases.map((ph) => {
            if (ph.id !== phaseId) return ph
            return {
              ...ph,
              tasks: ph.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)),
            }
          }),
          updatedAt: new Date().toISOString(),
        }
      }),
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
    const today = new Date().toISOString().split('T')[0]
    if (date > today) return

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
    const state = get()
    const habitToDelete = state.habits.find((habit) => habit.id === id)
    
    set((state) => ({
      habits: state.habits.filter((habit) => habit.id !== id),
    }))
    get().saveData()
    
    // 同步删除云端数据
    if (state.user?.id && habitToDelete) {
      // 尝试通过 ID 删除
      deleteCloudHabit(state.user.id, id).catch((err) => {
        console.log('[Sync] 通过ID删除失败，尝试通过名称删除...')
        // 如果通过 ID 删除失败，尝试通过名称删除
        deleteCloudHabitByName(state.user!.id, habitToDelete.name).catch((err2) => {
          console.error('[Sync] 删除云端习惯失败:', err2)
        })
      })
    }
  },

  setCourses: (courses) => {
    set({ courses })
    AsyncStorage.setItem('lucky-todo-courses', JSON.stringify(courses))
  },

  clearCourses: () => {
    set({ courses: [], semesterStart: null })
    AsyncStorage.removeItem('lucky-todo-courses')
    AsyncStorage.removeItem('lucky-todo-semester-start')
  },

  setSemesterStart: (date) => {
    set({ semesterStart: date })
    AsyncStorage.setItem('lucky-todo-semester-start', date)
  },

  addCourseGoal: (courseId, date, taskId, taskTitle) => {
    const key = `${courseId}_${date}`
    set((state) => {
      const existing = state.courseGoals[key] || []
      if (existing.some((g) => g.taskId === taskId)) return state
      const updated = { ...state.courseGoals, [key]: [...existing, { taskId, taskTitle }] }
      AsyncStorage.setItem('lucky-todo-course-goals', JSON.stringify(updated))
      return { courseGoals: updated }
    })
  },

  removeCourseGoal: (courseId, date, goalIndex) => {
    const key = `${courseId}_${date}`
    set((state) => {
      const existing = state.courseGoals[key] || []
      const updated = { ...state.courseGoals, [key]: existing.filter((_, i) => i !== goalIndex) }
      if (updated[key].length === 0) delete updated[key]
      AsyncStorage.setItem('lucky-todo-course-goals', JSON.stringify(updated))
      return { courseGoals: updated }
    })
  },

  loadData: async () => {
    try {
      const [tasksJson, timeSlotsJson, projectsJson, habitsJson, themeJson, darkModeJson, coursesJson, semesterStartJson, courseGoalsJson] = await Promise.all([
        AsyncStorage.getItem('lucky-todo-tasks'),
        AsyncStorage.getItem('lucky-todo-timeSlots'),
        AsyncStorage.getItem('lucky-todo-projects'),
        AsyncStorage.getItem('lucky-todo-habits'),
        AsyncStorage.getItem('lucky-todo-theme'),
        AsyncStorage.getItem('lucky-todo-dark-mode'),
        AsyncStorage.getItem('lucky-todo-courses'),
        AsyncStorage.getItem('lucky-todo-semester-start'),
        AsyncStorage.getItem('lucky-todo-course-goals'),
      ])

      const updates: Partial<AppState> = {}
      let hasOverdueTasks = false
      const today = format(new Date(), 'yyyy-MM-dd')

      if (tasksJson) {
        let tasks: Task[] = JSON.parse(tasksJson)
        
        // 将过期未完成的任务延续到今天
        // 注意：不更新 updatedAt，因为这不是用户主动修改，避免干扰云同步的时间戳比较
        tasks = tasks.map(task => {
          if (task.status !== 'completed' && task.status !== 'cancelled' && task.dueDate < today) {
            hasOverdueTasks = true
            console.log(`[任务延续] 将过期任务「${task.title}」从 ${task.dueDate} 延续到 ${today}`)
            return {
              ...task,
              dueDate: today,
              originalDueDate: task.originalDueDate || task.dueDate,
              postponeCount: (task.postponeCount || 0) + 1,
            }
          }
          return task
        })
        
        updates.tasks = tasks
      }
      if (timeSlotsJson) {
        updates.timeSlots = JSON.parse(timeSlotsJson)
      }
      if (projectsJson) {
        updates.projects = JSON.parse(projectsJson)
      }
      if (habitsJson) {
        updates.habits = JSON.parse(habitsJson)
      }
      if (themeJson) {
        updates.themeColor = themeJson as ThemeColor
      }
      if (darkModeJson) {
        try { updates.darkMode = JSON.parse(darkModeJson) } catch { /* ignore */ }
      }
      if (coursesJson) {
        try { updates.courses = JSON.parse(coursesJson) } catch { /* ignore */ }
      }
      if (semesterStartJson) {
        updates.semesterStart = semesterStartJson
      }
      if (courseGoalsJson) {
        try { updates.courseGoals = JSON.parse(courseGoalsJson) } catch { /* ignore */ }
      }

      if (Object.keys(updates).length > 0) {
        set(updates)
        
        // 如果有过期任务被延续，保存更新
        if (hasOverdueTasks) {
          get().saveData()
        }
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
        AsyncStorage.setItem('lucky-todo-projects', JSON.stringify(state.projects)),
        AsyncStorage.setItem('lucky-todo-habits', JSON.stringify(state.habits)),
      ])
    } catch (error) {
      console.error('保存数据失败:', error)
    }
  },

  setSyncData: async (data) => {
    set({
      tasks: data.tasks,
      timeSlots: data.timeSlots,
      projects: data.projects,
      habits: data.habits,
    })
    try {
      await Promise.all([
        AsyncStorage.setItem('lucky-todo-tasks', JSON.stringify(data.tasks)),
        AsyncStorage.setItem('lucky-todo-timeSlots', JSON.stringify(data.timeSlots)),
        AsyncStorage.setItem('lucky-todo-projects', JSON.stringify(data.projects)),
        AsyncStorage.setItem('lucky-todo-habits', JSON.stringify(data.habits)),
      ])
    } catch (error) {
      console.error('保存同步数据失败:', error)
    }
  },
}))

export default useStore
