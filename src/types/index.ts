// 任务优先级
export type Priority = 'high' | 'medium' | 'low'

// 任务状态
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

// 子任务
export interface SubTask {
  id: string
  title: string
  completed: boolean
}

// 任务
export interface Task {
  id: string
  title: string
  description?: string
  dueDate: string // ISO date string
  priority: Priority
  tags: string[]
  subtasks: SubTask[]
  status: TaskStatus
  isProject?: boolean
  parentId?: string
  estimatedMinutes?: number
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

// 时间块
export interface TimeSlot {
  id: string
  taskId: string
  date: string
  startTime: number // Minutes from midnight
  duration: number // Duration in minutes
  updatedAt?: string
}

// 项目阶段
export interface ProjectPhase {
  id: string
  title: string
  description?: string
  status: TaskStatus
  tasks: SubTask[]
  order: number
}

// 项目
export interface Project {
  id: string
  title: string
  description?: string
  icon: string
  color: string
  phases: ProjectPhase[]
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

// 习惯
export interface Habit {
  id: string
  name: string
  icon: string
  color: string
  frequency: 'daily' | 'weekly' | 'custom'
  customDays: number[]
  records: Record<string, boolean> // date -> completed
  createdAt: string
  updatedAt?: string
}

// 用户信息
export interface UserProfile {
  id: string
  email: string | null
  avatar_url: string | null
  full_name: string | null
  provider: string
}

// 主题颜色
export type ThemeColor = 'ocean' | 'forest' | 'lavender' | 'sunset' | 'rose' | 'slate'

// 页面类型
export type ViewType = 'today' | 'tasks' | 'habits' | 'profile'
