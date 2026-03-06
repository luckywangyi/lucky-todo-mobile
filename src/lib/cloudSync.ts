import { supabase } from './supabase'
import { Habit, Project, Task, TimeSlot } from '../types'
import * as Crypto from 'expo-crypto'

export type SyncData = {
  tasks: Task[]
  timeSlots: TimeSlot[]
  projects: Project[]
  habits: Habit[]
}

const normalizeHabitRecords = (row: any): Record<string, boolean> => {
  if (row?.records && typeof row.records === 'object') {
    return row.records
  }
  const completedDates = row?.completed_dates || row?.completedDates
  if (Array.isArray(completedDates)) {
    return completedDates.reduce((acc: Record<string, boolean>, date: string) => {
      acc[date] = true
      return acc
    }, {})
  }
  return {}
}

const dedupeById = <T extends { id: string }>(items: T[]) => {
  const map = new Map<string, T>()
  items.forEach((item) => {
    if (!map.has(item.id)) {
      map.set(item.id, item)
      return
    }
    const existing = map.get(item.id)!
    const existingUpdatedAt = (existing as any).updatedAt || (existing as any).createdAt
    const nextUpdatedAt = (item as any).updatedAt || (item as any).createdAt
    if (existingUpdatedAt && nextUpdatedAt) {
      map.set(item.id, nextUpdatedAt >= existingUpdatedAt ? item : existing)
    } else {
      map.set(item.id, item)
    }
  })
  return Array.from(map.values())
}

const isTaskDeleted = (task: Task): boolean => Boolean(task.deletedAt)

// 基于 title + dueDate 去重（与电脑端一致）
const dedupeBySignature = (tasks: Task[]) => {
  const map = new Map<string, Task>()
  tasks.forEach((task) => {
    const signature = getTaskSignature(task) // 使用相同的签名逻辑
    if (!map.has(signature)) {
      map.set(signature, task)
      return
    }
    const existing = map.get(signature)!
    const existingUpdatedAt = existing.updatedAt || existing.createdAt
    const nextUpdatedAt = task.updatedAt || task.createdAt
    // 保留更新时间最新的任务
    map.set(signature, nextUpdatedAt >= existingUpdatedAt ? task : existing)
  })
  return Array.from(map.values())
}

const mapTaskToRow = (task: Task, userId: string) => ({
  id: task.id,
  user_id: userId,
  title: task.title,
  description: task.description || null,
  due_date: task.dueDate,
  priority: task.priority,
  tags: task.tags,
  subtasks: task.subtasks,
  status: task.status,
  is_project: task.isProject || false,
  parent_id: task.parentId || null,
  estimated_minutes: task.estimatedMinutes || null,
  created_at: task.createdAt,
  updated_at: task.updatedAt,
  deleted_at: task.deletedAt || null,
})

const mapTimeSlotToRow = (slot: TimeSlot, userId: string) => ({
  id: slot.id,
  user_id: userId,
  task_id: slot.taskId,
  date: slot.date,
  start_time: slot.startTime,
  duration: slot.duration,
  updated_at: slot.updatedAt || new Date().toISOString(),
})

const mapProjectToRow = (project: Project, userId: string) => ({
  id: project.id,
  user_id: userId,
  title: project.title,
  description: project.description || null,
  icon: project.icon,
  color: project.color,
  phases: project.phases,
  status: project.status,
  created_at: project.createdAt,
  updated_at: project.updatedAt,
})

const mapHabitToRow = (habit: Habit, userId: string) => ({
  id: habit.id,
  user_id: userId,
  name: habit.name,
  icon: habit.icon,
  color: habit.color,
  frequency: habit.frequency,
  custom_days: habit.customDays,
  records: habit.records,
  created_at: habit.createdAt,
  updated_at: (habit as any).updatedAt || habit.createdAt,
})

const mapTaskFromRow = (row: any): Task => ({
  id: row.id,
  title: row.title,
  description: row.description || undefined,
  dueDate: row.due_date,
  priority: row.priority,
  tags: row.tags || [],
  subtasks: row.subtasks || [],
  status: row.status,
  isProject: row.is_project || false,
  parentId: row.parent_id || undefined,
  estimatedMinutes: row.estimated_minutes || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at || undefined,
})

const mapTimeSlotFromRow = (row: any): TimeSlot => ({
  id: row.id,
  taskId: row.task_id,
  date: row.date,
  startTime: row.start_time,
  duration: row.duration,
  updatedAt: row.updated_at || undefined,
})

const mapProjectFromRow = (row: any): Project => ({
  id: row.id,
  title: row.title,
  description: row.description || undefined,
  icon: row.icon,
  color: row.color,
  phases: row.phases || [],
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapHabitFromRow = (row: any): Habit => ({
  id: row.id,
  name: row.name || row.title,
  icon: row.icon || '✅',
  color: row.color || '#0EA5E9',
  frequency: row.frequency || 'daily',
  customDays: row.custom_days || row.customDays || [],
  records: normalizeHabitRecords(row),
  createdAt: row.created_at,
  updatedAt: row.updated_at || row.created_at,
})

export const uploadToCloud = async (userId: string, data: SyncData) => {
  if (!supabase) throw new Error('Supabase not configured')

  // 1. 先上传任务（time_slots 依赖 tasks）
  if (data.tasks.length > 0) {
    const rows = data.tasks.map((task) => mapTaskToRow(task, userId))
    const { error } = await supabase.from('tasks').upsert(rows, {
      onConflict: 'user_id,id',
    })
    if (error) throw error
  }

  // 2. 查询云端已有的任务 ID（确保 time_slots 的 task_id 有效）
  const { data: cloudTasks } = await supabase
    .from('tasks')
    .select('id,deleted_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
  const validTaskIds = new Set((cloudTasks || []).map((t: { id: string }) => t.id))

  // 3. 过滤掉引用无效任务的 time_slots
  const validTimeSlots = data.timeSlots.filter(slot => validTaskIds.has(slot.taskId))

  if (validTimeSlots.length > 0) {
    const rows = validTimeSlots.map((slot) => mapTimeSlotToRow(slot, userId))
    const { error } = await supabase.from('time_slots').upsert(rows, {
      onConflict: 'user_id,id',
    })
    if (error) throw error
  }

  if (data.projects.length > 0) {
    const rows = data.projects.map((project) => mapProjectToRow(project, userId))
    const { error } = await supabase.from('projects').upsert(rows, {
      onConflict: 'user_id,id',
    })
    if (error) throw error
  }

  if (data.habits.length > 0) {
    const rows = data.habits.map((habit) => mapHabitToRow(habit, userId))
    const { error } = await supabase.from('habits').upsert(rows, {
      onConflict: 'user_id,id',
    })
    if (error) throw error
  }
}

export const downloadFromCloud = async (userId: string): Promise<SyncData> => {
  if (!supabase) throw new Error('Supabase not configured')

  const [tasksResult, timeSlotsResult, projectsResult, habitsResult] =
    await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', userId),
      supabase.from('time_slots').select('*').eq('user_id', userId),
      supabase.from('projects').select('*').eq('user_id', userId),
      supabase.from('habits').select('*').eq('user_id', userId),
    ])

  if (tasksResult.error) throw tasksResult.error
  if (timeSlotsResult.error) throw timeSlotsResult.error
  if (projectsResult.error) throw projectsResult.error
  if (habitsResult.error) throw habitsResult.error

  return {
    tasks: dedupeBySignature(
      dedupeById((tasksResult.data || []).map(mapTaskFromRow))
    ),
    timeSlots: dedupeById((timeSlotsResult.data || []).map(mapTimeSlotFromRow)),
    projects: dedupeById((projectsResult.data || []).map(mapProjectFromRow)),
    habits: dedupeById((habitsResult.data || []).map(mapHabitFromRow)),
  }
}

// 检查是否为有效的UUID格式
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

// UUID v5 命名空间（与电脑端一致）
const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

// 将 UUID 字符串转换为字节数组
const uuidToBytes = (uuid: string): Uint8Array => {
  const hex = uuid.replace(/-/g, '')
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

// 将字节数组转换为 UUID 字符串（设置版本5和变体位）
const bytesToUUIDv5 = (bytes: Uint8Array): string => {
  // 设置版本位（第6字节的高4位为5）
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  // 设置变体位（第8字节的高2位为10）
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  return [
    hex.substr(0, 8),
    hex.substr(8, 4),
    hex.substr(12, 4),
    hex.substr(16, 4),
    hex.substr(20, 12),
  ].join('-')
}

// 生成 UUID v5（基于命名空间和名称，与电脑端一致）
const generateUUIDv5 = async (name: string): Promise<string> => {
  const namespaceBytes = uuidToBytes(UUID_NAMESPACE)
  const nameBytes = new TextEncoder().encode(name)
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length)
  combined.set(namespaceBytes)
  combined.set(nameBytes, namespaceBytes.length)
  
  // 将字节数组转换为字符串用于哈希
  const combinedStr = Array.from(combined)
    .map(b => String.fromCharCode(b))
    .join('')
  
  const hashHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA1,
    combinedStr,
    { encoding: Crypto.CryptoEncoding.HEX }
  )
  
  // 将十六进制字符串转换为字节数组
  const hashBytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    hashBytes[i] = parseInt(hashHex.substr(i * 2, 2), 16)
  }
  
  return bytesToUUIDv5(hashBytes)
}

// 生成UUID（如果需要，用于非任务场景）
const generateUUID = () => Crypto.randomUUID()

// 生成任务签名用于匹配（基于 title + dueDate，与电脑端一致）
const getTaskSignature = (task: Task): string => {
  // 主要基于 title + dueDate 去重（与电脑端 UUID v5 生成逻辑一致）
  return `${task.title}|${task.dueDate}`
}

// 智能合并任务：基于updatedAt时间戳，支持ID和签名匹配
// 返回合并后的任务列表和ID映射表（旧ID -> 新ID）
const mergeTasks = (localTasks: Task[], cloudTasks: Task[]): { tasks: Task[], idMapping: Map<string, string> } => {
  const taskMapById = new Map<string, Task>()
  const taskMapBySignature = new Map<string, Task>()
  const idMapping = new Map<string, string>() // 旧ID -> 新ID的映射
  
  // 先添加本地任务
  localTasks.forEach(task => {
    taskMapById.set(task.id, task)
    const signature = getTaskSignature(task)
    if (!taskMapBySignature.has(signature)) {
      taskMapBySignature.set(signature, task)
    }
  })
  
  // 合并云端任务
  cloudTasks.forEach(cloudTask => {
    const localTaskById = taskMapById.get(cloudTask.id)
    const cloudSignature = getTaskSignature(cloudTask)
    const localTaskBySignature = taskMapBySignature.get(cloudSignature)
    
    if (localTaskById) {
      // ID匹配：比较更新时间
      const localUpdatedAt = new Date(localTaskById.updatedAt || localTaskById.createdAt).getTime()
      const cloudUpdatedAt = new Date(cloudTask.updatedAt || cloudTask.createdAt).getTime()
      const localDeleted = isTaskDeleted(localTaskById)
      const cloudDeleted = isTaskDeleted(cloudTask)

      // 删除墓碑优先：删除记录不旧于另一侧时，优先保留删除状态
      if (cloudDeleted && !localDeleted && cloudUpdatedAt >= localUpdatedAt) {
        taskMapById.set(cloudTask.id, cloudTask)
        taskMapBySignature.set(cloudSignature, cloudTask)
        return
      }
      if (localDeleted && !cloudDeleted && localUpdatedAt >= cloudUpdatedAt) {
        return
      }
      
      if (cloudUpdatedAt > localUpdatedAt) {
        // 云端版本更新，使用云端数据（包含最新的完成状态）
        taskMapById.set(cloudTask.id, cloudTask)
        taskMapBySignature.set(cloudSignature, cloudTask)
      } else if (cloudUpdatedAt === localUpdatedAt) {
        if (cloudDeleted || localDeleted) {
          const winner = cloudDeleted ? cloudTask : localTaskById
          taskMapById.set(cloudTask.id, winner)
          taskMapBySignature.set(cloudSignature, winner)
          return
        }
        // 时间相同，智能合并：保留最新的状态和子任务完成状态
        const mergedTask = { ...localTaskById }
        
        // 优先使用云端的任务状态（假设云端是最新的）
        if (cloudTask.status !== localTaskById.status) {
          mergedTask.status = cloudTask.status
        }
        
        // 合并子任务：保留所有子任务，优先使用云端的完成状态
        if (cloudTask.subtasks && cloudTask.subtasks.length > 0) {
          const subtaskMap = new Map<string, typeof cloudTask.subtasks[0]>()
          
          // 先添加本地子任务
          localTaskById.subtasks.forEach(st => {
            subtaskMap.set(st.id, st)
          })
          
          // 合并云端子任务：如果ID相同，优先使用云端的完成状态
          cloudTask.subtasks.forEach(cloudSt => {
            const localSt = subtaskMap.get(cloudSt.id)
            if (!localSt) {
              // 云端有新的子任务
              subtaskMap.set(cloudSt.id, cloudSt)
            } else {
              // 子任务ID相同，优先使用云端的完成状态
              subtaskMap.set(cloudSt.id, cloudSt)
            }
          })
          
          mergedTask.subtasks = Array.from(subtaskMap.values())
        } else if (localTaskById.subtasks && localTaskById.subtasks.length > 0) {
          // 云端没有子任务，保留本地的
          mergedTask.subtasks = localTaskById.subtasks
        }
        
        taskMapById.set(cloudTask.id, mergedTask)
        taskMapBySignature.set(cloudSignature, mergedTask)
      } else {
        // 本地版本更新，但也要检查是否有新的完成状态需要合并
        const mergedTask = { ...localTaskById }
        
        // 如果云端任务状态是已完成，而本地不是，使用云端状态（保留完成记录）
        // 如果本地已完成，保持本地状态
        if (cloudTask.status === 'completed' && localTaskById.status !== 'completed') {
          mergedTask.status = cloudTask.status
        }
        
        // 合并子任务完成状态：保留所有子任务，优先使用已完成的子任务状态
        if (cloudTask.subtasks && cloudTask.subtasks.length > 0) {
          const subtaskMap = new Map<string, typeof cloudTask.subtasks[0]>()
          
          // 先添加本地子任务
          localTaskById.subtasks.forEach(st => {
            subtaskMap.set(st.id, st)
          })
          
          // 合并云端子任务：如果云端的子任务已完成，使用云端状态
          cloudTask.subtasks.forEach(cloudSt => {
            const localSt = subtaskMap.get(cloudSt.id)
            if (!localSt) {
              // 云端有新的子任务
              subtaskMap.set(cloudSt.id, cloudSt)
            } else {
              // 如果云端的子任务已完成，使用云端状态（保留完成记录）
              if (cloudSt.completed && !localSt.completed) {
                subtaskMap.set(cloudSt.id, cloudSt)
              }
              // 如果本地已完成，保持本地状态
            }
          })
          
          mergedTask.subtasks = Array.from(subtaskMap.values())
        } else if (localTaskById.subtasks && localTaskById.subtasks.length > 0) {
          // 云端没有子任务，保留本地的
          mergedTask.subtasks = localTaskById.subtasks
        }
        
        taskMapById.set(cloudTask.id, mergedTask)
        taskMapBySignature.set(cloudSignature, mergedTask)
      }
    } else if (localTaskBySignature && localTaskBySignature.id !== cloudTask.id) {
      // 签名匹配但ID不同：这是相同任务但ID不一致的情况
      // 优先使用UUID格式的ID，统一ID
      const localUpdatedAt = new Date(localTaskBySignature.updatedAt || localTaskBySignature.createdAt).getTime()
      const cloudUpdatedAt = new Date(cloudTask.updatedAt || cloudTask.createdAt).getTime()
      
      const preferredId = isValidUUID(cloudTask.id) ? cloudTask.id : 
                         (isValidUUID(localTaskBySignature.id) ? localTaskBySignature.id : cloudTask.id)
      
      // 记录ID映射
      if (localTaskBySignature.id !== preferredId) {
        idMapping.set(localTaskBySignature.id, preferredId)
      }
      if (cloudTask.id !== preferredId) {
        idMapping.set(cloudTask.id, preferredId)
      }
      
      // 移除旧的本地任务
      taskMapById.delete(localTaskBySignature.id)
      
      if (cloudUpdatedAt > localUpdatedAt) {
        // 使用云端数据（包含最新的完成状态），但统一ID
        const unifiedTask = { ...cloudTask, id: preferredId }
        taskMapById.set(preferredId, unifiedTask)
        taskMapBySignature.set(cloudSignature, unifiedTask)
      } else {
        // 使用本地数据，但统一ID，并合并云端的完成状态
        const unifiedTask = { ...localTaskBySignature, id: preferredId }
        
        // 如果云端任务状态是已完成，使用云端状态
        if (cloudTask.status === 'completed' && localTaskBySignature.status !== 'completed') {
          unifiedTask.status = cloudTask.status
        }
        
        // 合并子任务状态：保留所有子任务，优先使用云端的完成状态
        if (cloudTask.subtasks && cloudTask.subtasks.length > 0) {
          const subtaskMap = new Map<string, typeof cloudTask.subtasks[0]>()
          
          localTaskBySignature.subtasks.forEach(st => {
            subtaskMap.set(st.id, st)
          })
          
          cloudTask.subtasks.forEach(cloudSt => {
            const localSt = subtaskMap.get(cloudSt.id)
            if (!localSt) {
              subtaskMap.set(cloudSt.id, cloudSt)
            } else {
              // 如果云端的子任务已完成，使用云端状态
              if (cloudSt.completed && !localSt.completed) {
                subtaskMap.set(cloudSt.id, cloudSt)
              }
            }
          })
          
          unifiedTask.subtasks = Array.from(subtaskMap.values())
        }
        
        taskMapById.set(preferredId, unifiedTask)
        taskMapBySignature.set(cloudSignature, unifiedTask)
      }
    } else {
      // 全新的云端任务
      taskMapById.set(cloudTask.id, cloudTask)
      if (!taskMapBySignature.has(cloudSignature)) {
        taskMapBySignature.set(cloudSignature, cloudTask)
      }
    }
  })
  
  return { tasks: Array.from(taskMapById.values()), idMapping }
}

// 智能合并时间块：基于 ID + updatedAt 时间戳
const mergeTimeSlots = (localSlots: TimeSlot[], cloudSlots: TimeSlot[]): TimeSlot[] => {
  const slotMap = new Map<string, TimeSlot>()
  
  localSlots.forEach(slot => {
    slotMap.set(slot.id, slot)
  })
  
  cloudSlots.forEach(cloudSlot => {
    const localSlot = slotMap.get(cloudSlot.id)
    if (!localSlot) {
      slotMap.set(cloudSlot.id, cloudSlot)
    } else {
      const localTime = new Date(localSlot.updatedAt || '').getTime() || 0
      const cloudTime = new Date(cloudSlot.updatedAt || '').getTime() || 0
      if (cloudTime > localTime) {
        slotMap.set(cloudSlot.id, cloudSlot)
      }
    }
  })
  
  return Array.from(slotMap.values())
}

// 智能合并项目
const mergeProjects = (localProjects: Project[], cloudProjects: Project[]): Project[] => {
  const projectMap = new Map<string, Project>()
  
  localProjects.forEach(project => {
    projectMap.set(project.id, project)
  })
  
  cloudProjects.forEach(cloudProject => {
    const localProject = projectMap.get(cloudProject.id)
    
    if (!localProject) {
      projectMap.set(cloudProject.id, cloudProject)
    } else {
      const localUpdatedAt = new Date(localProject.updatedAt || localProject.createdAt).getTime()
      const cloudUpdatedAt = new Date(cloudProject.updatedAt || cloudProject.createdAt).getTime()
      
      if (cloudUpdatedAt > localUpdatedAt) {
        projectMap.set(cloudProject.id, cloudProject)
      }
    }
  })
  
  return Array.from(projectMap.values())
}

// 智能合并习惯
// 生成习惯签名（基于 name）
const getHabitSignature = (habit: Habit): string => {
  return habit.name
}

// 智能合并习惯：支持 ID 匹配和签名匹配
// 判断是否是最近创建的（5分钟内）
const isRecentlyCreated = (createdAt: string) => {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  return (now - created) < 5 * 60 * 1000 // 5分钟
}

const mergeHabits = (localHabits: Habit[], cloudHabits: Habit[]): Habit[] => {
  const habitMapById = new Map<string, Habit>()
  const habitMapBySignature = new Map<string, Habit>()
  const cloudIdSet = new Set(cloudHabits.map(h => h.id))
  const cloudSignatureSet = new Set(cloudHabits.map(h => getHabitSignature(h)))
  
  // 先添加本地习惯（支持删除同步）
  localHabits.forEach(habit => {
    const signature = getHabitSignature(habit)
    
    // 如果云端没有这个习惯，且不是最近创建的，说明被其他设备删除了
    if (!cloudIdSet.has(habit.id) && !cloudSignatureSet.has(signature)) {
      if (!isRecentlyCreated(habit.createdAt)) {
        console.log(`[Sync] 习惯「${habit.name}」已被其他设备删除，跳过`)
        return // 不添加到合并结果中
      }
    }
    
    habitMapById.set(habit.id, habit)
    if (!habitMapBySignature.has(signature)) {
      habitMapBySignature.set(signature, habit)
    }
  })
  
  cloudHabits.forEach(cloudHabit => {
    const cloudSignature = getHabitSignature(cloudHabit)
    const localHabitById = habitMapById.get(cloudHabit.id)
    const localHabitBySignature = habitMapBySignature.get(cloudSignature)
    
    if (localHabitById) {
      // ID 匹配：合并记录
      const mergedRecords = { ...localHabitById.records }
      Object.keys(cloudHabit.records).forEach(date => {
        // 合并记录：如果任一端有打卡，就保留打卡状态
        if (cloudHabit.records[date]) {
          mergedRecords[date] = true
        }
      })
      
      const localUpdatedAt = (localHabitById as any).updatedAt || localHabitById.createdAt
      const cloudUpdatedAt = (cloudHabit as any).updatedAt || cloudHabit.createdAt
      
      const mergedHabit: Habit = {
        ...localHabitById,
        records: mergedRecords,
      }
      
      // 如果云端更新时间更新，使用云端的基本信息
      if (cloudUpdatedAt && new Date(cloudUpdatedAt).getTime() > new Date(localUpdatedAt).getTime()) {
        Object.assign(mergedHabit, {
          name: cloudHabit.name,
          icon: cloudHabit.icon,
          color: cloudHabit.color,
          frequency: cloudHabit.frequency,
          customDays: cloudHabit.customDays,
        })
      }
      
      habitMapById.set(cloudHabit.id, mergedHabit)
      habitMapBySignature.set(cloudSignature, mergedHabit)
    } else if (localHabitBySignature && localHabitBySignature.id !== cloudHabit.id) {
      // 签名匹配但 ID 不同：这是相同习惯但 ID 不一致的情况
      // 合并记录，使用云端 ID（假设云端 ID 更规范）
      const mergedRecords = { ...localHabitBySignature.records }
      Object.keys(cloudHabit.records).forEach(date => {
        if (cloudHabit.records[date]) {
          mergedRecords[date] = true
        }
      })
      
      const localUpdatedAt = (localHabitBySignature as any).updatedAt || localHabitBySignature.createdAt
      const cloudUpdatedAt = (cloudHabit as any).updatedAt || cloudHabit.createdAt
      
      // 移除旧的本地习惯
      habitMapById.delete(localHabitBySignature.id)
      
      const mergedHabit: Habit = {
        ...cloudHabit,
        records: mergedRecords,
      }
      
      // 如果本地更新时间更新，使用本地的基本信息
      if (localUpdatedAt && new Date(localUpdatedAt).getTime() > new Date(cloudUpdatedAt).getTime()) {
        Object.assign(mergedHabit, {
          icon: localHabitBySignature.icon,
          color: localHabitBySignature.color,
          frequency: localHabitBySignature.frequency,
          customDays: localHabitBySignature.customDays,
        })
      }
      
      habitMapById.set(cloudHabit.id, mergedHabit)
      habitMapBySignature.set(cloudSignature, mergedHabit)
    } else {
      // 全新的云端习惯
      habitMapById.set(cloudHabit.id, cloudHabit)
      if (!habitMapBySignature.has(cloudSignature)) {
        habitMapBySignature.set(cloudSignature, cloudHabit)
      }
    }
  })
  
  return Array.from(habitMapById.values())
}

// 确保任务ID为UUID格式，如果不是则基于 title + dueDate 生成 UUID v5（与电脑端一致）
const ensureTaskIdsAreUUIDs = async (tasks: Task[]): Promise<{ tasks: Task[], idMapping: Map<string, string> }> => {
  const idMapping = new Map<string, string>()
  const updatedTasks = await Promise.all(
    tasks.map(async (task) => {
      if (!isValidUUID(task.id)) {
        // 基于 title + dueDate 生成 UUID v5（与电脑端一致）
        const name = `${task.title}|${task.dueDate}`
        const newId = await generateUUIDv5(name)
        idMapping.set(task.id, newId)
        return { ...task, id: newId }
      }
      return task
    })
  )
  
  // 更新parentId引用
  const finalTasks = updatedTasks.map(task => {
    if (task.parentId && idMapping.has(task.parentId)) {
      return { ...task, parentId: idMapping.get(task.parentId)! }
    }
    return task
  })
  
  return { tasks: finalTasks, idMapping }
}

// 更新TimeSlot的taskId引用
const updateTimeSlotTaskIds = (timeSlots: TimeSlot[], idMapping: Map<string, string>): TimeSlot[] => {
  return timeSlots.map(slot => {
    if (idMapping.has(slot.taskId)) {
      return { ...slot, taskId: idMapping.get(slot.taskId)! }
    }
    return slot
  })
}

// 只下载云端数据（不上传本地数据）
export const downloadOnly = async (userId: string): Promise<SyncData> => {
  if (!supabase) throw new Error('Supabase not configured')
  const cloudData = await downloadFromCloud(userId)
  const activeTasks = cloudData.tasks.filter((task) => !isTaskDeleted(task))
  const activeTaskIds = new Set(activeTasks.map((task) => task.id))
  return {
    ...cloudData,
    tasks: activeTasks,
    timeSlots: cloudData.timeSlots.filter((slot) => activeTaskIds.has(slot.taskId)),
  }
}

// 删除云端的单个习惯
export const deleteCloudHabit = async (userId: string, habitId: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase not configured')
  
  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('user_id', userId)
    .eq('id', habitId)
  
  if (error) {
    console.error('[Sync] 删除云端习惯失败:', error)
    throw error
  }
  
  console.log('[Sync] 云端习惯已删除:', habitId)
}

// 根据习惯名称删除云端习惯（用于 ID 不一致的情况）
export const deleteCloudHabitByName = async (userId: string, habitName: string): Promise<void> => {
  if (!supabase) throw new Error('Supabase not configured')
  
  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('user_id', userId)
    .eq('name', habitName)
  
  if (error) {
    console.error('[Sync] 删除云端习惯失败:', error)
    throw error
  }
  
  console.log('[Sync] 云端习惯已删除 (by name):', habitName)
}

// 只上传本地数据到云端（先确保ID格式正确）
export const uploadOnly = async (userId: string, localData: SyncData): Promise<void> => {
  if (!supabase) throw new Error('Supabase not configured')
  
  const { tasks: normalizedTasks, idMapping: uuidMapping } = await ensureTaskIdsAreUUIDs(localData.tasks)
  const normalizedTimeSlots = updateTimeSlotTaskIds(localData.timeSlots, uuidMapping)
  
  const finalTasks = normalizedTasks.map(task => ({
    ...task,
    updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
  }))
  
  const validTaskIds = new Set(finalTasks.filter((task) => !isTaskDeleted(task)).map(t => t.id))
  const finalTimeSlots = normalizedTimeSlots.filter(slot => validTaskIds.has(slot.taskId))
  
  await uploadToCloud(userId, {
    tasks: finalTasks,
    timeSlots: finalTimeSlots,
    projects: localData.projects,
    habits: localData.habits,
  })
}

export const syncWithCloud = async (userId: string, localData: SyncData): Promise<SyncData> => {
  if (!supabase) throw new Error('Supabase not configured')
  
  // 1. 先下载云端数据
  const cloudData = await downloadFromCloud(userId)
  
  const hasLocalData =
    localData.tasks.length > 0 ||
    localData.projects.length > 0 ||
    localData.habits.length > 0 ||
    localData.timeSlots.length > 0
  const hasCloudData =
    cloudData.tasks.length > 0 ||
    cloudData.projects.length > 0 ||
    cloudData.habits.length > 0 ||
    cloudData.timeSlots.length > 0
  
  // 2. 本地为空：直接使用云端数据
  if (!hasLocalData && hasCloudData) {
    const activeTasks = cloudData.tasks.filter((task) => !isTaskDeleted(task))
    const activeTaskIds = new Set(activeTasks.map((task) => task.id))
    return {
      ...cloudData,
      tasks: activeTasks,
      timeSlots: cloudData.timeSlots.filter((slot) => activeTaskIds.has(slot.taskId)),
    }
  }
  
  // 3. 云端为空：上传本地数据
  if (hasLocalData && !hasCloudData) {
    await uploadOnly(userId, localData)
    const { tasks: normalizedTasks, idMapping } = await ensureTaskIdsAreUUIDs(localData.tasks)
    const normalizedTimeSlots = updateTimeSlotTaskIds(localData.timeSlots, idMapping)
    const activeTasks = normalizedTasks.filter((task) => !isTaskDeleted(task))
    const activeTaskIds = new Set(activeTasks.map((task) => task.id))
    return {
      tasks: activeTasks,
      timeSlots: normalizedTimeSlots.filter((slot) => activeTaskIds.has(slot.taskId)),
      projects: localData.projects,
      habits: localData.habits,
    }
  }
  
  // 4. 两端都有数据：智能合并
  const { tasks: normalizedTasks, idMapping: uuidMapping } = await ensureTaskIdsAreUUIDs(localData.tasks)
  const normalizedTimeSlots = updateTimeSlotTaskIds(localData.timeSlots, uuidMapping)
  
  // 智能合并：基于 updatedAt 时间戳
  const { tasks: mergedTasksList, idMapping: mergeMapping } = mergeTasks(normalizedTasks, cloudData.tasks)
  
  // 合并 ID 映射
  const combinedIdMapping = new Map<string, string>()
  uuidMapping.forEach((newId, oldId) => combinedIdMapping.set(oldId, newId))
  mergeMapping.forEach((newId, oldId) => {
    let currentId = oldId
    while (combinedIdMapping.has(currentId)) currentId = combinedIdMapping.get(currentId)!
    if (currentId !== newId) combinedIdMapping.set(currentId, newId)
    if (!combinedIdMapping.has(oldId)) combinedIdMapping.set(oldId, newId)
  })
  
  // 合并时间块
  const updatedTimeSlots = updateTimeSlotTaskIds(
    mergeTimeSlots(normalizedTimeSlots, cloudData.timeSlots),
    combinedIdMapping
  )
  
  // 合并项目和习惯
  const mergedProjects = mergeProjects(localData.projects, cloudData.projects)
  const mergedHabits = mergeHabits(localData.habits, cloudData.habits)
  
  // 确保 updatedAt
  const tasksWithUpdatedAt = mergedTasksList.map(task => ({
    ...task,
    updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
  }))
  
  // 去重
  const finalActiveTasks = dedupeBySignature(tasksWithUpdatedAt.filter((task) => !isTaskDeleted(task)))
  const finalDeletedTasks = dedupeById(tasksWithUpdatedAt.filter(isTaskDeleted))
  const tasksForUpload = dedupeById([...finalActiveTasks, ...finalDeletedTasks])
  
  // 过滤无效 time_slots
  const validTaskIds = new Set(finalActiveTasks.map(t => t.id))
  const finalTimeSlots = updatedTimeSlots.filter(slot => validTaskIds.has(slot.taskId))
  const skippedSlots = updatedTimeSlots.filter(slot => !validTaskIds.has(slot.taskId))
  
  console.log('[Sync] 合并结果: tasks=', finalActiveTasks.length, 'timeSlots=', finalTimeSlots.length,
    'projects=', mergedProjects.length, 'habits=', mergedHabits.length)
  if (skippedSlots.length > 0) {
    console.warn('[Sync] 时间块被过滤（task_id无效）:', skippedSlots.length)
  }
  if (finalTimeSlots.length > 0) {
    console.log('[Sync] 时间块详情:', finalTimeSlots.map(s => ({
      id: s.id.substring(0, 8), taskId: s.taskId.substring(0, 8), date: s.date
    })))
  }

  // 上传合并后的数据
  await uploadToCloud(userId, {
    tasks: tasksForUpload,
    timeSlots: finalTimeSlots,
    projects: mergedProjects,
    habits: mergedHabits,
  })
  
  // 返回合并后的数据
  return {
    tasks: finalActiveTasks,
    timeSlots: finalTimeSlots,
    projects: mergedProjects,
    habits: mergedHabits,
  }
}
