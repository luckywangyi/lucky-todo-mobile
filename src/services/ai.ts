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

// ---- 测试连接 ----

export async function testConnection(config: AIConfig): Promise<boolean> {
  const messages: ChatMessage[] = [
    { role: 'user', content: '回复"OK"' },
  ]
  const reply = await chatCompletion(messages, config)
  return reply.length > 0
}
