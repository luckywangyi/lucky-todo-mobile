import AsyncStorage from '@react-native-async-storage/async-storage'

export interface AIConfig {
  endpoint: string
  apiKey: string
  model: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const AI_CONFIG_KEY = 'lucky-todo-ai-config'

export const getAIConfig = async (): Promise<AIConfig> => {
  try {
    const raw = await AsyncStorage.getItem(AI_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode', apiKey: '', model: 'qwen-plus' }
}

export const saveAIConfig = async (config: AIConfig) => {
  await AsyncStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config))
}

export const isAIConfigured = async (): Promise<boolean> => {
  const config = await getAIConfig()
  return !!(config.endpoint && config.apiKey && config.model)
}

async function chatCompletion(messages: ChatMessage[], config?: AIConfig): Promise<string> {
  const cfg = config || (await getAIConfig())
  if (!cfg.apiKey) throw new Error('请先在设置中配置 AI API Key')

  const base = cfg.endpoint.replace(/\/+$/, '')
  const url = `${base}/v1/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`AI 请求失败 (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) return match[1].trim()
  const braceMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (braceMatch) return braceMatch[1]
  return text
}

// ---- 自然语言解析任务 ----

export interface ParsedTask {
  title: string
  description?: string
  dueDate?: string
  priority?: 'high' | 'medium' | 'low'
  estimatedMinutes?: number
  tags?: string[]
  subtasks?: string[]
}

export async function parseNaturalLanguage(input: string, todayISO: string): Promise<ParsedTask> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个任务解析助手。将用户的自然语言描述解析为结构化任务 JSON。
今天日期是 ${todayISO}。
返回纯 JSON（不要 markdown），字段：
- title: string (必须)
- description: string (可选)
- dueDate: string "YYYY-MM-DD" (根据描述推断，默认今天)
- priority: "high" | "medium" | "low" (默认 "medium")
- estimatedMinutes: number (默认 60)
- tags: string[] (可选，根据内容推断)
- subtasks: string[] (可选，如果内容复杂可拆分)
只返回 JSON，不要其他文字。`,
    },
    { role: 'user', content: input },
  ]

  const reply = await chatCompletion(messages)
  const parsed = JSON.parse(extractJSON(reply)) as ParsedTask
  if (!parsed.title) throw new Error('解析失败：缺少标题')
  return parsed
}

// ---- 智能拆分子任务 ----

export async function generateSubtasks(
  title: string,
  description: string
): Promise<{ title: string; estimatedMinutes?: number }[]> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个任务规划助手。根据任务标题和描述，生成合理的子任务列表。
返回纯 JSON 数组，每项格式：{ "title": "子任务名称", "estimatedMinutes": 预估分钟数 }
子任务数量 3-8 个，每个子任务要具体可执行。只返回 JSON 数组。`,
    },
    { role: 'user', content: `任务标题：${title}\n描述：${description || '无'}` },
  ]

  const reply = await chatCompletion(messages)
  const parsed = JSON.parse(extractJSON(reply))
  return Array.isArray(parsed) ? parsed : []
}

// ---- 每日总结 ----

export interface DailySummary {
  completionRate: string
  summary: string
  highlights: string[]
  suggestions: string[]
  tomorrowPlan: string[]
}

export async function generateDailySummary(
  todayTasks: { title: string; status: string; subtasks: { title: string; completed: boolean }[] }[],
  todayISO: string
): Promise<DailySummary> {
  const taskList = todayTasks.map(t => {
    const subInfo = t.subtasks.length > 0
      ? `(子任务: ${t.subtasks.filter(s => s.completed).length}/${t.subtasks.length} 完成)`
      : ''
    return `- [${t.status === 'completed' ? '已完成' : '未完成'}] ${t.title} ${subInfo}`
  }).join('\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个效率分析助手。根据今日任务完成情况，生成简洁的总结报告。
返回纯 JSON，字段：
- completionRate: string (如 "3/5")
- summary: string (一句话总结今天的情况)
- highlights: string[] (1-3个亮点或表扬)
- suggestions: string[] (1-3个改进建议)
- tomorrowPlan: string[] (1-3个明日建议)
语气友好鼓励，简洁实用。只返回 JSON。`,
    },
    { role: 'user', content: `日期：${todayISO}\n\n任务列表：\n${taskList}` },
  ]

  const reply = await chatCompletion(messages)
  return JSON.parse(extractJSON(reply)) as DailySummary
}

// ---- AI 自动规划时间轴 ----

export interface ScheduledSlot {
  taskId: string
  startTime: number
  duration: number
}

export async function generateSchedule(
  tasks: { id: string; title: string; priority: string; estimatedMinutes: number }[],
  existingSlots: { startTime: number; duration: number }[],
  todayISO: string,
  currentMinute: number
): Promise<ScheduledSlot[]> {
  if (tasks.length === 0) return []

  const occupied = existingSlots
    .map(s => `  - ${String(Math.floor(s.startTime / 60)).padStart(2, '0')}:${String(s.startTime % 60).padStart(2, '0')} ~ ${String(Math.floor((s.startTime + s.duration) / 60)).padStart(2, '0')}:${String((s.startTime + s.duration) % 60).padStart(2, '0')}`)
    .join('\n')

  const taskList = tasks
    .map(t => `  - id: "${t.id}", 标题: "${t.title}", 优先级: ${t.priority}, 预估: ${t.estimatedMinutes}分钟`)
    .join('\n')

  const earliestStart = Math.max(currentMinute + 5, 8 * 60)

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个专业的时间管理规划助手。根据待办任务列表，智能安排今日时间轴。

时间约束：
- 最早开始：${String(Math.floor(earliestStart / 60)).padStart(2, '0')}:${String(earliestStart % 60).padStart(2, '0')}
- 最晚结束：22:00
- 必须避开已占用的时间段
- startTime 用"从零点开始的分钟数"表示（如 8:00=480, 13:30=810）
- 如果时间不够排完所有任务，只排能排下的

智能排序策略：
- high 优先级任务安排在上午或精力充沛时段
- medium 任务安排在中间时段
- low 任务安排在靠后时段
- 需要深度思考的任务（如算法、编程、学习新概念）优先安排在上午

时长智能调整（预估时间仅作参考）：
- 简单/重复性任务（复习、整理、总结）：压缩到 30-60 分钟
- 中等任务：保持预估时长或微调，但单次不超过 90 分钟
- 复杂/深度任务（算法、项目开发、论文）：可适当延长，但单次专注不超过 120 分钟
- 如果预估超过 120 分钟，拆分为多个时段，中间插入休息

休息策略：
- 普通任务之间：10 分钟休息
- 连续两个高难度或 high 优先级任务之间：15-20 分钟休息
- 连续工作超过 2 小时后：安排 20-30 分钟长休息
- 午饭时间 12:00-13:00 附近尽量留出空隙

返回纯 JSON 数组，每项格式：{ "taskId": "任务id", "startTime": 分钟数, "duration": 分钟数 }
只返回 JSON 数组，不要其他文字。`,
    },
    {
      role: 'user',
      content: `日期：${todayISO}\n\n待安排任务：\n${taskList}\n\n已占用时间段：\n${occupied || '  无'}`,
    },
  ]

  const reply = await chatCompletion(messages)
  const parsed = JSON.parse(extractJSON(reply))
  if (!Array.isArray(parsed)) return []

  const raw = parsed
    .filter((s: any) => s.taskId && typeof s.startTime === 'number' && typeof s.duration === 'number')
    .map((s: any) => ({
      taskId: String(s.taskId),
      startTime: Math.round(s.startTime),
      duration: Math.round(s.duration),
    }))

  return enforceBreaks(raw, tasks)
}

function enforceBreaks(
  slots: ScheduledSlot[],
  tasks: { id: string; priority: string }[]
): ScheduledSlot[] {
  if (slots.length <= 1) return slots
  const sorted = [...slots].sort((a, b) => a.startTime - b.startTime)
  const result: ScheduledSlot[] = [sorted[0]]
  const MAX_END = 22 * 60

  let consecutiveWorkMinutes = sorted[0].duration

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1]
    const curr = sorted[i]
    const prevEnd = prev.startTime + prev.duration

    const prevTask = tasks.find(t => t.id === prev.taskId)
    const currTask = tasks.find(t => t.id === curr.taskId)
    const bothHigh = prevTask?.priority === 'high' && currTask?.priority === 'high'

    let minBreak = bothHigh ? 15 : 10
    if (consecutiveWorkMinutes >= 120) {
      minBreak = Math.max(minBreak, 20)
      consecutiveWorkMinutes = 0
    }

    const lunchStart = 12 * 60, lunchEnd = 13 * 60
    let newStart = Math.max(curr.startTime, prevEnd + minBreak)
    if (prevEnd <= lunchStart && newStart < lunchEnd && newStart >= lunchStart - 10) {
      newStart = Math.max(newStart, lunchEnd)
    }

    if (newStart + curr.duration <= MAX_END) {
      result.push({ ...curr, startTime: newStart })
      consecutiveWorkMinutes += minBreak + curr.duration
    }
  }

  return result
}

// ---- 课程目标解析 ----

export interface ParsedCourseGoal {
  courseId: string
  taskId: string
  taskTitle: string
}

export async function parseCourseGoal(
  input: string,
  todayCourses: { id: string; name: string; startTime: number; duration: number }[],
  todayTasks: { id: string; title: string }[]
): Promise<ParsedCourseGoal> {
  if (todayCourses.length === 0) throw new Error('今天没有课程')
  if (todayTasks.length === 0) throw new Error('今天没有任务，请先添加任务')

  const courseList = todayCourses
    .map((c) => {
      const sh = Math.floor(c.startTime / 60)
      const sm = c.startTime % 60
      const eh = Math.floor((c.startTime + c.duration) / 60)
      const em = (c.startTime + c.duration) % 60
      return `  - id: "${c.id}", 名称: "${c.name}", 时间: ${sh}:${String(sm).padStart(2, '0')}-${eh}:${String(em).padStart(2, '0')}`
    })
    .join('\n')

  const taskList = todayTasks
    .map((t) => `  - id: "${t.id}", 标题: "${t.title}"`)
    .join('\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个课程任务助手。用户会说一句话，描述想在某节课上完成某个任务。
你需要：
1. 从今日课程列表中匹配出用户指的是哪一节课
2. 从今日任务列表中匹配出用户想完成的是哪个任务

今日课程：
${courseList}

今日任务：
${taskList}

课程匹配规则：
- 用户可能用时间指代课程（如"十点的课"→匹配10:00开始的课）
- 用户可能用课程名指代（如"数据结构课上"→匹配名称含"数据结构"的课）
- 如果无法确定是哪节课，选择时间最接近的课程

任务匹配规则：
- 用户的描述可能是模糊的，需要智能匹配最相关的任务
- 例如"写作业"可能匹配标题含"作业"的任务
- 例如"复习第三章"可能匹配标题含"复习"或"第三章"的任务
- 如果用户描述不能匹配到任何任务，选择最相关的一个

返回纯 JSON，格式：{ "courseId": "课程id", "taskId": "任务id" }
只返回 JSON，不要其他文字。`,
    },
    { role: 'user', content: input },
  ]

  const reply = await chatCompletion(messages)
  const parsed = JSON.parse(extractJSON(reply)) as { courseId: string; taskId: string }
  if (!parsed.courseId || !parsed.taskId) throw new Error('解析失败')
  if (!todayCourses.find((c) => c.id === parsed.courseId)) {
    throw new Error('未能匹配到课程')
  }
  const matchedTask = todayTasks.find((t) => t.id === parsed.taskId)
  if (!matchedTask) {
    throw new Error('未能匹配到任务')
  }
  return { courseId: parsed.courseId, taskId: matchedTask.id, taskTitle: matchedTask.title }
}

// ---- AI 早报 ----

export interface MorningBriefing {
  greeting: string
  overview: string
  priorities: string[]
  conflicts: string[]
  habitReminder: string
  motivational: string
}

export async function generateMorningBriefing(
  tasks: { title: string; priority: string; status: string }[],
  courses: { name: string; startTime: number; duration: number }[],
  slots: { startTime: number; duration: number; taskId: string }[],
  habits: { name: string; icon: string; records: Record<string, boolean> }[],
  todayISO: string
): Promise<MorningBriefing> {
  const taskList = tasks.map(t => `- [${t.status === 'completed' ? '已完成' : t.priority}] ${t.title}`).join('\n')
  const courseList = courses.map(c => {
    const sh = Math.floor(c.startTime / 60)
    const sm = c.startTime % 60
    return `- ${sh}:${String(sm).padStart(2, '0')} ${c.name}`
  }).join('\n')
  const habitList = habits.map(h => {
    const days = Object.values(h.records).filter(Boolean).length
    return `- ${h.icon} ${h.name} (累计${days}天)`
  }).join('\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个智能效率助手。根据今日任务、课程和习惯，生成简洁的早间简报。
今天: ${todayISO}
返回纯 JSON：
- greeting: string (一句亲切的早安问候)
- overview: string (一句话概述今日安排)
- priorities: string[] (1-3个今日重点建议)
- conflicts: string[] (时间冲突提醒，如果有的话)
- habitReminder: string (一句习惯提醒)
- motivational: string (一句激励语)
简洁有用，只返回 JSON。`,
    },
    {
      role: 'user',
      content: `任务：\n${taskList || '无'}\n\n课程：\n${courseList || '无'}\n\n习惯：\n${habitList || '无'}`,
    },
  ]

  const reply = await chatCompletion(messages)
  return JSON.parse(extractJSON(reply)) as MorningBriefing
}

// ---- 自然语言改排 ----

export interface ScheduleCommand {
  action: 'reschedule' | 'cancel' | 'shift' | 'add'
  taskId?: string
  taskTitle?: string
  newStartTime?: number
  newDate?: string
  shiftMinutes?: number
  scope?: 'single' | 'afternoon' | 'all'
}

export async function parseScheduleCommand(
  input: string,
  tasks: { id: string; title: string }[],
  slots: { id: string; taskId: string; startTime: number; duration: number }[],
  todayISO: string
): Promise<ScheduleCommand> {
  const taskList = tasks.map(t => `  - id: "${t.id}", 标题: "${t.title}"`).join('\n')
  const slotList = slots.map(s => {
    const sh = Math.floor(s.startTime / 60)
    const sm = s.startTime % 60
    return `  - slotId: "${s.id}", taskId: "${s.taskId}", 时间: ${sh}:${String(sm).padStart(2, '0')}, 时长: ${s.duration}分钟`
  }).join('\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个日程管理助手。用户会用自然语言描述想对日程做的调整。
今天日期: ${todayISO}

当前任务：
${taskList || '  无'}

当前时间安排：
${slotList || '  无'}

请解析用户意图，返回纯 JSON：
- action: "reschedule" | "cancel" | "shift" | "add"
- taskId: string (匹配到的任务id，如适用)
- taskTitle: string (任务标题，如适用)
- newStartTime: number (新的开始时间，从午夜开始的分钟数，如 9:00=540)
- newDate: string "YYYY-MM-DD" (新日期，如适用)
- shiftMinutes: number (偏移分钟数，正=推迟，负=提前)
- scope: "single" | "afternoon" | "all" (影响范围)

只返回 JSON。`,
    },
    { role: 'user', content: input },
  ]

  const reply = await chatCompletion(messages)
  return JSON.parse(extractJSON(reply)) as ScheduleCommand
}

// ---- 周报总结 ----

export interface WeeklyReview {
  completionRate: string
  summary: string
  bestDay: string
  mostProductiveTime: string
  highlights: string[]
  improvements: string[]
  habitSummary: string
  nextWeekSuggestions: string[]
}

export async function generateWeeklyReview(
  weekTasks: { date: string; title: string; status: string }[],
  weekHabits: { name: string; icon: string; weekChecks: number; total: number }[],
  weekSlots: { date: string; startTime: number; duration: number }[]
): Promise<WeeklyReview> {
  const taskList = weekTasks.map(t => `- [${t.date}][${t.status === 'completed' ? '完成' : '未完成'}] ${t.title}`).join('\n')
  const habitList = weekHabits.map(h => `- ${h.icon} ${h.name}: ${h.weekChecks}/${h.total}天`).join('\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是效率分析助手。根据本周数据生成周报。返回纯 JSON：
- completionRate: string (如 "15/20")
- summary: string (一句话总结本周)
- bestDay: string (最高效的一天)
- mostProductiveTime: string (最高效的时间段)
- highlights: string[] (2-3个亮点)
- improvements: string[] (2-3个改进点)
- habitSummary: string (习惯总结)
- nextWeekSuggestions: string[] (2-3个下周建议)
简洁有用，只返回 JSON。`,
    },
    { role: 'user', content: `任务：\n${taskList || '无'}\n\n习惯：\n${habitList || '无'}` },
  ]

  const reply = await chatCompletion(messages)
  return JSON.parse(extractJSON(reply)) as WeeklyReview
}

// ---- AI 项目规划 ----

export interface GeneratedProjectPlan {
  phases: {
    title: string
    description: string
    tasks: { title: string }[]
  }[]
}

export async function generateProjectPlan(
  title: string,
  description?: string
): Promise<GeneratedProjectPlan> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个项目规划助手。根据项目标题和描述，生成合理的项目阶段和任务。
返回纯 JSON：
{
  "phases": [
    {
      "title": "阶段名称",
      "description": "阶段描述",
      "tasks": [{ "title": "任务名称" }]
    }
  ]
}
生成 3-6 个阶段，每个阶段 2-5 个任务。只返回 JSON。`,
    },
    { role: 'user', content: `项目标题：${title}\n描述：${description || '无'}` },
  ]

  const reply = await chatCompletion(messages)
  return JSON.parse(extractJSON(reply)) as GeneratedProjectPlan
}

// ---- AI 习惯分析 ----

export interface HabitInsight {
  summary: string
  streakAnalysis: string
  bestDay: string
  suggestions: string[]
  encouragement: string
}

export async function generateHabitInsights(
  habits: { name: string; icon: string; records: Record<string, boolean>; frequency: string }[]
): Promise<HabitInsight> {
  const habitData = habits.map(h => {
    const dates = Object.entries(h.records).filter(([, v]) => v).map(([k]) => k).sort()
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      if (h.records[key]) streak++
      else break
    }
    return `- ${h.icon} ${h.name}: 当前连续${streak}天, 总打卡${dates.length}天, 频率: ${h.frequency}`
  }).join('\n')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是习惯分析助手。根据用户的习惯数据，提供深入分析和建议。
返回纯 JSON：
- summary: string (一句话概述习惯执行情况)
- streakAnalysis: string (连续打卡分析)
- bestDay: string (哪天坚持最好)
- suggestions: string[] (2-3个改进建议)
- encouragement: string (一句鼓励的话)
简洁实用，只返回 JSON。`,
    },
    { role: 'user', content: `习惯数据：\n${habitData || '无'}` },
  ]

  const reply = await chatCompletion(messages)
  return JSON.parse(extractJSON(reply)) as HabitInsight
}

// ---- 测试连接 ----

export async function testConnection(config: AIConfig): Promise<boolean> {
  const messages: ChatMessage[] = [
    { role: 'user', content: '回复"OK"' },
  ]
  const reply = await chatCompletion(messages, config)
  return reply.length > 0
}
