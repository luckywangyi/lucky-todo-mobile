import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import useStore from '../store/useStore'
import { getTheme } from '../theme/colors'
import { typography } from '../theme/typography'
import { Task, TimeSlot } from '../types'
import TaskCard from '../components/TaskCard'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import { syncWithCloud } from '../lib/cloudSync'
import { isSupabaseConfigured } from '../lib/supabase'
import { generateDailySummary, generateSchedule, isAIConfigured, type DailySummary } from '../services/ai'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const START_HOUR = 6
const END_HOUR = 23
const HOUR_HEIGHT = 56
const TIMELINE_LEFT = 52

const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

const isTimeSlotOverlapping = (
  slots: TimeSlot[],
  startTime: number,
  duration: number,
  excludeSlotId?: string
) => {
  const endTime = startTime + duration
  return slots.some((slot) => {
    if (excludeSlotId && slot.id === excludeSlotId) return false
    const slotEnd = slot.startTime + slot.duration
    return startTime < slotEnd && endTime > slot.startTime
  })
}

const priorityColors = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#22C55E',
}

const getGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

// --- Time Picker (for a known task) ---
const TimePickerContent = ({
  task,
  onConfirm,
  theme,
  initialHour,
  initialMinute,
}: {
  task: Task
  onConfirm: (startTime: number, duration: number) => void
  theme: ReturnType<typeof getTheme>
  initialHour?: number
  initialMinute?: number
}) => {
  const [selectedHour, setSelectedHour] = useState(initialHour ?? 9)
  const [selectedMinute, setSelectedMinute] = useState(initialMinute ?? 0)
  const [duration, setDuration] = useState(60)

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)
  const minutes = [0, 15, 30, 45]
  const durations = [15, 30, 45, 60, 90, 120, 180]
  const endTime = selectedHour * 60 + selectedMinute + duration

  return (
    <View>
      <Text style={[typography.bodyMedium, { color: theme.text, marginBottom: 16 }]} numberOfLines={2}>
        {task.title}
      </Text>

      <View style={[styles.previewBar, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>
        <Ionicons name="time-outline" size={16} color={theme.primary} />
        <Text style={[typography.label, { color: theme.text }]}>
          {formatTime(selectedHour * 60 + selectedMinute)} - {formatTime(endTime)}
          {'  '}
          {duration >= 60 ? `${duration / 60}小时` : `${duration}分钟`}
        </Text>
      </View>

      <Text style={[typography.label, { color: theme.textSecondary, marginBottom: 10, marginTop: 20 }]}>
        开始时间
      </Text>
      <View style={styles.timePickerRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {hours.map((h) => (
            <TouchableOpacity
              key={h}
              style={[
                styles.pickerChip,
                {
                  backgroundColor: selectedHour === h ? theme.primary : theme.card,
                  borderWidth: 1,
                  borderColor: selectedHour === h ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setSelectedHour(h)}
            >
              <Text
                style={[styles.pickerChipText, { color: selectedHour === h ? 'white' : theme.text }]}
              >
                {h.toString().padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[styles.timeSep, { color: theme.text }]}>:</Text>
        <View style={{ flexDirection: 'row' }}>
          {minutes.map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.pickerChip,
                {
                  backgroundColor: selectedMinute === m ? theme.primary : theme.card,
                  borderWidth: 1,
                  borderColor: selectedMinute === m ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setSelectedMinute(m)}
            >
              <Text
                style={[styles.pickerChipText, { color: selectedMinute === m ? 'white' : theme.text }]}
              >
                {m.toString().padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[typography.label, { color: theme.textSecondary, marginBottom: 10, marginTop: 20 }]}>
        时长
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {durations.map((d) => (
          <TouchableOpacity
            key={d}
            style={[
              styles.durationChip,
              {
                backgroundColor: duration === d ? theme.primary : theme.card,
                borderWidth: 1,
                borderColor: duration === d ? theme.primary : theme.border,
              },
            ]}
            onPress={() => setDuration(d)}
          >
            <Text style={[styles.durationChipText, { color: duration === d ? 'white' : theme.text }]}>
              {d >= 60 ? `${d / 60}小时` : `${d}分钟`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
        onPress={() => onConfirm(selectedHour * 60 + selectedMinute, duration)}
      >
        <Ionicons name="checkmark" size={20} color="white" />
        <Text style={styles.confirmBtnText}>确认安排</Text>
      </TouchableOpacity>
    </View>
  )
}

// --- Task Picker (tap timeline → pick task + time) ---
const TaskPickerContent = ({
  tasks,
  theme,
  initialHour,
  initialMinute,
  onPick,
}: {
  tasks: Task[]
  theme: ReturnType<typeof getTheme>
  initialHour: number
  initialMinute: number
  onPick: (task: Task, startTime: number, duration: number) => void
}) => {
  const [step, setStep] = useState<'pick' | 'time'>('pick')
  const [pickedTask, setPickedTask] = useState<Task | null>(null)
  const [selectedHour, setSelectedHour] = useState(initialHour)
  const [selectedMinute, setSelectedMinute] = useState(initialMinute)
  const [duration, setDuration] = useState(60)

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)
  const minutes = [0, 15, 30, 45]
  const durations = [15, 30, 45, 60, 90, 120, 180]
  const endTime = selectedHour * 60 + selectedMinute + duration

  if (step === 'pick') {
    return (
      <View>
        <Text style={[typography.label, { color: theme.textSecondary, marginBottom: 4 }]}>
          安排到 {formatTime(initialHour * 60 + initialMinute)}
        </Text>
        <Text style={[typography.label, { color: theme.textSecondary, marginBottom: 16 }]}>
          选择一个任务
        </Text>
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {tasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.taskPickItem, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => {
                setPickedTask(task)
                setDuration(60)
                setStep('time')
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.taskPickDot, { backgroundColor: priorityColors[task.priority] }]} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: theme.text }]} numberOfLines={1}>
                  {task.title}
                </Text>
                {(task.subtasks?.length || 0) > 0 && (
                  <Text style={[typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
                    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} 子任务
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )
  }

  return (
    <View>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => setStep('pick')}
      >
        <Ionicons name="chevron-back" size={18} color={theme.primary} />
        <Text style={[typography.label, { color: theme.primary }]}>返回选择</Text>
      </TouchableOpacity>

      <Text style={[typography.bodyMedium, { color: theme.text, marginBottom: 16 }]} numberOfLines={2}>
        {pickedTask?.title}
      </Text>

      <View style={[styles.previewBar, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>
        <Ionicons name="time-outline" size={16} color={theme.primary} />
        <Text style={[typography.label, { color: theme.text }]}>
          {formatTime(selectedHour * 60 + selectedMinute)} - {formatTime(endTime)}
          {'  '}
          {duration >= 60 ? `${duration / 60}小时` : `${duration}分钟`}
        </Text>
      </View>

      <Text style={[typography.label, { color: theme.textSecondary, marginBottom: 10, marginTop: 20 }]}>
        开始时间
      </Text>
      <View style={styles.timePickerRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {hours.map((h) => (
            <TouchableOpacity
              key={h}
              style={[
                styles.pickerChip,
                {
                  backgroundColor: selectedHour === h ? theme.primary : theme.card,
                  borderWidth: 1,
                  borderColor: selectedHour === h ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setSelectedHour(h)}
            >
              <Text style={[styles.pickerChipText, { color: selectedHour === h ? 'white' : theme.text }]}>
                {h.toString().padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[styles.timeSep, { color: theme.text }]}>:</Text>
        <View style={{ flexDirection: 'row' }}>
          {minutes.map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.pickerChip,
                {
                  backgroundColor: selectedMinute === m ? theme.primary : theme.card,
                  borderWidth: 1,
                  borderColor: selectedMinute === m ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setSelectedMinute(m)}
            >
              <Text style={[styles.pickerChipText, { color: selectedMinute === m ? 'white' : theme.text }]}>
                {m.toString().padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[typography.label, { color: theme.textSecondary, marginBottom: 10, marginTop: 20 }]}>
        时长
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {durations.map((d) => (
          <TouchableOpacity
            key={d}
            style={[
              styles.durationChip,
              {
                backgroundColor: duration === d ? theme.primary : theme.card,
                borderWidth: 1,
                borderColor: duration === d ? theme.primary : theme.border,
              },
            ]}
            onPress={() => setDuration(d)}
          >
            <Text style={[styles.durationChipText, { color: duration === d ? 'white' : theme.text }]}>
              {d >= 60 ? `${d / 60}小时` : `${d}分钟`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
        onPress={() => {
          if (pickedTask) onPick(pickedTask, selectedHour * 60 + selectedMinute, duration)
        }}
      >
        <Ionicons name="checkmark" size={20} color="white" />
        <Text style={styles.confirmBtnText}>确认安排</Text>
      </TouchableOpacity>
    </View>
  )
}

// --- Task Detail Sheet (view subtasks, toggle, complete) ---
const TaskDetailContent = ({
  task,
  slot,
  theme,
  onToggleTask,
  onToggleSubtask,
  onRemoveSlot,
  onClose,
}: {
  task: Task
  slot: TimeSlot
  theme: ReturnType<typeof getTheme>
  onToggleTask: (task: Task) => void
  onToggleSubtask: (taskId: string, subtaskId: string) => void
  onRemoveSlot: (slotId: string) => void
  onClose: () => void
}) => {
  const isDone = task.status === 'completed'
  const totalSubs = task.subtasks?.length || 0
  const doneSubs = task.subtasks?.filter(s => s.completed).length || 0
  const pColor = priorityColors[task.priority]

  return (
    <View>
      <View style={[detailStyles.timeRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Ionicons name="time-outline" size={16} color={theme.primary} />
        <Text style={[typography.label, { color: theme.text }]}>
          {formatTime(slot.startTime)} - {formatTime(slot.startTime + slot.duration)}
          {'  '}({slot.duration >= 60 ? `${slot.duration / 60}小时` : `${slot.duration}分钟`})
        </Text>
      </View>

      <View style={detailStyles.titleRow}>
        <View style={[detailStyles.priorityDot, { backgroundColor: pColor }]} />
        <Text style={[typography.heading3 || typography.bodyMedium, { color: theme.text, flex: 1, fontSize: 17, fontWeight: '600' }]}>
          {task.title}
        </Text>
      </View>

      {totalSubs > 0 && (
        <View style={detailStyles.subsSection}>
          <View style={detailStyles.subsHeader}>
            <Text style={[typography.label, { color: theme.textSecondary }]}>
              子任务 ({doneSubs}/{totalSubs})
            </Text>
            <View style={[detailStyles.subProgressBarBg, { backgroundColor: theme.border }]}>
              <View
                style={[
                  detailStyles.subProgressBarFill,
                  {
                    backgroundColor: doneSubs === totalSubs ? theme.success : theme.primary,
                    width: `${totalSubs > 0 ? (doneSubs / totalSubs) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
          </View>

          {task.subtasks.map((sub) => (
            <TouchableOpacity
              key={sub.id}
              style={[
                detailStyles.subItem,
                { backgroundColor: sub.completed ? `${theme.success}08` : theme.card, borderColor: theme.border },
              ]}
              onPress={() => onToggleSubtask(task.id, sub.id)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  detailStyles.subCheckbox,
                  {
                    backgroundColor: sub.completed ? theme.success : 'transparent',
                    borderColor: sub.completed ? theme.success : theme.border,
                  },
                ]}
              >
                {sub.completed && <Ionicons name="checkmark" size={12} color="white" />}
              </View>
              <Text
                style={[
                  detailStyles.subTitle,
                  {
                    color: sub.completed ? theme.textSecondary : theme.text,
                    textDecorationLine: sub.completed ? 'line-through' : 'none',
                  },
                ]}
              >
                {sub.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={detailStyles.actions}>
        <TouchableOpacity
          style={[
            detailStyles.actionBtn,
            { backgroundColor: isDone ? theme.card : theme.primary, borderColor: isDone ? theme.border : theme.primary },
          ]}
          onPress={() => { onToggleTask(task); onClose() }}
        >
          <Ionicons name={isDone ? 'arrow-undo' : 'checkmark-circle'} size={18} color={isDone ? theme.text : 'white'} />
          <Text style={[detailStyles.actionBtnText, { color: isDone ? theme.text : 'white' }]}>
            {isDone ? '取消完成' : '标记完成'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[detailStyles.actionBtnSecondary, { borderColor: theme.border }]}
          onPress={() => { onRemoveSlot(slot.id); onClose() }}
        >
          <Ionicons name="close-circle-outline" size={18} color={theme.textSecondary} />
          <Text style={[detailStyles.actionBtnText, { color: theme.textSecondary }]}>取消安排</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// =================== MAIN SCREEN ===================
const TodayScreen = () => {
  const {
    tasks,
    timeSlots,
    themeColor,
    updateTask,
    deleteTask,
    addTimeSlot,
    removeTimeSlot,
    toggleSubtask,
  } = useStore()
  const tabBarHeight = useBottomTabBarHeight()
  const bottomSafeSpace = tabBarHeight + 12
  const theme = getTheme(themeColor)
  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [showTaskDetail, setShowTaskDetail] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailSlot, setDetailSlot] = useState<TimeSlot | null>(null)
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline')
  const [showCompleted, setShowCompleted] = useState(false)
  const [prefillHour, setPrefillHour] = useState(9)
  const [prefillMinute, setPrefillMinute] = useState(0)

  const lastFocusSyncRef = useRef(0)
  useFocusEffect(
    useCallback(() => {
      const now = Date.now()
      if (now - lastFocusSyncRef.current < 30_000) return
      lastFocusSyncRef.current = now

      const { user, tasks, timeSlots, projects, habits, setSyncData } = useStore.getState()
      if (!user || !isSupabaseConfigured()) return

      syncWithCloud(user.id, { tasks, timeSlots, projects, habits })
        .then((cloudData) => {
          const isEmpty = cloudData.tasks.length === 0 && cloudData.timeSlots.length === 0 &&
            cloudData.projects.length === 0 && cloudData.habits.length === 0
          if (!isEmpty) {
            setSyncData(cloudData)
            console.log('[TodayScreen] 焦点同步完成: tasks=', cloudData.tasks.length,
              'timeSlots=', cloudData.timeSlots.length)
          }
        })
        .catch((err) => console.error('[TodayScreen] 焦点同步失败:', err))
    }, [])
  )

  const pulseAnim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [])

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === today && t.status !== 'cancelled'),
    [tasks, today]
  )
  const todaySlots = useMemo(
    () => timeSlots.filter((s) => s.date === today),
    [timeSlots, today]
  )

  const clampSlotToTimeline = useCallback((startTime: number, duration: number) => {
    const maxDuration = END_HOUR * 60 - START_HOUR * 60
    const safeDuration = Math.max(15, Math.min(duration, maxDuration))
    const safeStart = Math.max(
      START_HOUR * 60,
      Math.min(startTime, END_HOUR * 60 - safeDuration)
    )
    return { startTime: safeStart, duration: safeDuration }
  }, [])

  const scheduleSlot = useCallback((
    taskId: string,
    startTime: number,
    duration: number,
    silent = false
  ) => {
    const candidate = clampSlotToTimeline(startTime, duration)
    if (isTimeSlotOverlapping(todaySlots, candidate.startTime, candidate.duration)) {
      if (!silent) {
        Alert.alert('时间冲突', '该时间段与已有安排重叠，请调整时间后再试。')
      }
      return false
    }
    addTimeSlot({ taskId, date: today, startTime: candidate.startTime, duration: candidate.duration })
    return true
  }, [addTimeSlot, today, todaySlots, clampSlotToTimeline])
  const scheduledIds = useMemo(() => new Set(todaySlots.map((s) => s.taskId)), [todaySlots])
  const unscheduledTasks = useMemo(
    () => todayTasks.filter((t) => !scheduledIds.has(t.id) && t.status !== 'completed'),
    [todayTasks, scheduledIds]
  )
  const completedTasks = useMemo(
    () => todayTasks.filter((t) => t.status === 'completed'),
    [todayTasks]
  )
  const pendingCount = todayTasks.filter((t) => t.status !== 'completed').length
  const completedCount = completedTasks.length

  // AI Daily Summary
  const [aiAvailable, setAiAvailable] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [aiSummary, setAiSummary] = useState<DailySummary | null>(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)

  useEffect(() => {
    isAIConfigured().then(setAiAvailable)
  }, [])

  const handleGenerateSummary = async () => {
    if (aiSummaryLoading) return
    setAiSummaryLoading(true)
    setAiSummary(null)
    try {
      const taskData = todayTasks.map(t => ({
        title: t.title,
        status: t.status,
        subtasks: t.subtasks.map(s => ({ title: s.title, completed: s.completed })),
      }))
      const result = await generateDailySummary(taskData, today)
      setAiSummary(result)
      setShowSummary(true)
    } catch (err: any) {
      Alert.alert('AI 总结失败', err?.message || '请重试')
    }
    setAiSummaryLoading(false)
  }

  // AI 自动规划
  const [aiScheduling, setAiScheduling] = useState(false)

  const handleAISchedule = async () => {
    if (aiScheduling) return
    setAiScheduling(true)
    try {
      const tasksToSchedule = unscheduledTasks.map(t => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        estimatedMinutes: t.estimatedMinutes || 60,
      }))
      const occupiedSlots: TimeSlot[] = [...todaySlots]
      const existing = todaySlots.map(s => ({
        startTime: s.startTime,
        duration: s.duration,
      }))
      const now = new Date()
      const currentMinute = now.getHours() * 60 + now.getMinutes()
      const result = await generateSchedule(tasksToSchedule, existing, today, currentMinute)
      let skipped = 0
      for (const slot of result) {
        if (tasksToSchedule.some(t => t.id === slot.taskId)) {
          const candidate = clampSlotToTimeline(slot.startTime, slot.duration)
          if (isTimeSlotOverlapping(occupiedSlots, candidate.startTime, candidate.duration)) {
            skipped += 1
            continue
          }
          addTimeSlot({
            taskId: slot.taskId,
            date: today,
            startTime: candidate.startTime,
            duration: candidate.duration,
          })
          occupiedSlots.push({
            id: `ai-${slot.taskId}-${candidate.startTime}`,
            taskId: slot.taskId,
            date: today,
            startTime: candidate.startTime,
            duration: candidate.duration,
          })
        }
      }
      if (skipped > 0) {
        Alert.alert('AI 规划提示', `已跳过 ${skipped} 个重叠时间块，请手动微调。`)
      }
    } catch (err: any) {
      Alert.alert('AI 规划失败', err?.message || '请重试')
    }
    setAiScheduling(false)
  }

  const toggleTask = (task: Task) =>
    updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' })

  const openTimePickerForTask = (task: Task, hour?: number, minute?: number) => {
    if (task.status === 'completed') return
    setPrefillHour(hour ?? Math.max(START_HOUR, new Date().getHours()))
    setPrefillMinute(minute ?? 0)
    setSelectedTask(task)
    setShowTimePicker(true)
  }

  const handleSchedule = (startTime: number, duration: number) => {
    if (!selectedTask) return
    const added = scheduleSlot(selectedTask.id, startTime, duration)
    if (added) {
      setSelectedTask(null)
      setShowTimePicker(false)
    }
  }

  const handleTaskPickSchedule = (task: Task, startTime: number, duration: number) => {
    const added = scheduleSlot(task.id, startTime, duration)
    if (added) setShowTaskPicker(false)
  }

  const handleTimelineTap = (event: { nativeEvent: { locationY: number } }) => {
    if (unscheduledTasks.length === 0) return
    const y = event.nativeEvent.locationY
    const rawMinutes = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60
    const snapped = Math.round(rawMinutes / 15) * 15
    const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, snapped))
    setPrefillHour(Math.floor(clamped / 60))
    setPrefillMinute(clamped % 60)

    if (unscheduledTasks.length === 1) {
      openTimePickerForTask(unscheduledTasks[0], Math.floor(clamped / 60), clamped % 60)
    } else {
      setShowTaskPicker(true)
    }
  }

  const openTaskDetail = (task: Task, slot: TimeSlot) => {
    setDetailTask(task)
    setDetailSlot(slot)
    setShowTaskDetail(true)
  }

  const handleRemoveSlot = (slotId: string) => {
    removeTimeSlot(slotId)
  }

  const handleDeleteTask = (task: Task) => {
    Alert.alert('确认删除', `确定要删除任务「${task.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteTask(task.id) },
    ])
  }

  const renderTimeline = () => {
    const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const hasUnscheduled = unscheduledTasks.length > 0

    return (
      <View style={styles.tlContainer}>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            activeOpacity={hasUnscheduled ? 0.95 : 1}
            onPress={hasUnscheduled ? handleTimelineTap : undefined}
            style={{ height: (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT, position: 'relative' }}
          >
            {hours.map((hour) => (
              <View key={hour} style={[styles.hourRow, { top: (hour - START_HOUR) * HOUR_HEIGHT }]}>
                <Text style={[styles.hourLabel, { color: theme.textSecondary }]}>
                  {hour.toString().padStart(2, '0')}:00
                </Text>
                <View style={[styles.hourLine, { backgroundColor: theme.border }]} />
              </View>
            ))}

            {currentMinutes >= START_HOUR * 60 && currentMinutes <= END_HOUR * 60 && (
              <View
                style={[
                  styles.nowLine,
                  { top: ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT },
                ]}
              >
                <Animated.View
                  style={[
                    styles.nowDotOuter,
                    { backgroundColor: `${theme.primary}30`, transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <View style={[styles.nowDot, { backgroundColor: theme.primary }]} />
                <View style={[styles.nowBar, { backgroundColor: theme.primary }]} />
              </View>
            )}

            {todaySlots.map((slot) => {
              const task = tasks.find((t) => t.id === slot.taskId)
              if (!task) return null
              const top = ((slot.startTime - START_HOUR * 60) / 60) * HOUR_HEIGHT
              const height = (slot.duration / 60) * HOUR_HEIGHT
              const isDone = task.status === 'completed'
              const pColor = priorityColors[task.priority]
              const totalSubs = task.subtasks?.length || 0
              const doneSubs = task.subtasks?.filter(s => s.completed).length || 0
              const isCompact = height < 50

              return (
                <TouchableOpacity
                  key={slot.id}
                  style={[
                    styles.timeBlock,
                    {
                      top,
                      height: Math.max(height, 24),
                      backgroundColor: theme.card,
                      borderWidth: 1,
                      borderColor: theme.border,
                      borderLeftWidth: 4,
                      borderLeftColor: pColor,
                      opacity: isDone ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => openTaskDetail(task, slot)}
                  activeOpacity={0.7}
                >
                  {isCompact ? (
                    <View style={styles.tbCompact}>
                      <Text style={[styles.tbTime, { color: theme.textSecondary }]}>
                        {formatTime(slot.startTime)}
                      </Text>
                      <Text style={[styles.tbTitleCompact, { color: isDone ? theme.textSecondary : theme.text }]} numberOfLines={1}>
                        {task.title}
                      </Text>
                      {isDone && <Ionicons name="checkmark-circle" size={12} color={theme.success} />}
                    </View>
                  ) : (
                    <>
                      <View style={styles.tbHeader}>
                        <Text style={[styles.tbTime, { color: theme.textSecondary }]}>
                          {formatTime(slot.startTime)} - {formatTime(slot.startTime + slot.duration)}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {totalSubs > 0 && (
                            <Text style={[styles.tbSubText, { color: theme.textSecondary }]}>
                              {doneSubs}/{totalSubs}
                            </Text>
                          )}
                          {isDone && <Ionicons name="checkmark-circle" size={14} color={theme.success} />}
                        </View>
                      </View>
                      <Text style={[styles.tbTitle, { color: isDone ? theme.textSecondary : theme.text }]} numberOfLines={1}>
                        {task.title}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )
            })}
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <View style={[styles.headerGradient, { backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.caption, { color: theme.textSecondary }]}>
              {getGreeting()}
            </Text>
            <Text style={[typography.heading2, { color: theme.text, marginTop: 2 }]}>
              {format(new Date(), 'M月d日 EEEE', { locale: zhCN })}
            </Text>
          </View>
          <View style={[styles.segmented, { backgroundColor: theme.surfaceSecondary }]}>
            <TouchableOpacity
              style={[styles.segBtn, viewMode === 'timeline' && { backgroundColor: theme.card }]}
              onPress={() => setViewMode('timeline')}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={viewMode === 'timeline' ? theme.primary : theme.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segBtn, viewMode === 'list' && { backgroundColor: theme.card }]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={viewMode === 'list' ? theme.primary : theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsPills}>
          <View style={[styles.statPill, { flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>
            <Ionicons name="hourglass-outline" size={13} color={theme.warning} />
            <Text style={[typography.caption, { color: theme.text, fontWeight: '600' }]} numberOfLines={1}>
              {pendingCount} 待完成
            </Text>
          </View>
          <View style={[styles.statPill, { flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>
            <Ionicons name="checkmark-circle-outline" size={13} color={theme.success} />
            <Text style={[typography.caption, { color: theme.text, fontWeight: '600' }]} numberOfLines={1}>
              {completedCount} 已完成
            </Text>
          </View>
          <View style={[styles.statPill, { flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>
            <Ionicons name="time-outline" size={13} color={theme.primary} />
            <Text style={[typography.caption, { color: theme.text, fontWeight: '600' }]} numberOfLines={1}>
              {todaySlots.length} 已安排
            </Text>
          </View>
        </View>
        {aiAvailable && (todayTasks.length > 0 || unscheduledTasks.length > 0) && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, paddingHorizontal: 20 }}>
            {todayTasks.length > 0 && (
              <TouchableOpacity
                style={[styles.statPill, { flex: 1, backgroundColor: theme.primary + '18', borderWidth: 1, borderColor: theme.primary + '30' }]}
                onPress={handleGenerateSummary}
                disabled={aiSummaryLoading}
                activeOpacity={0.7}
              >
                {aiSummaryLoading ? (
                  <ActivityIndicator size={12} color={theme.primary} />
                ) : (
                  <Ionicons name="sparkles-outline" size={13} color={theme.primary} />
                )}
                <Text style={[typography.caption, { color: theme.primary, fontWeight: '600' }]} numberOfLines={1}>
                  AI 总结
                </Text>
              </TouchableOpacity>
            )}
            {unscheduledTasks.length > 0 && (
              <TouchableOpacity
                style={[styles.statPill, { flex: 1, backgroundColor: theme.primary + '18', borderWidth: 1, borderColor: theme.primary + '30' }]}
                onPress={handleAISchedule}
                disabled={aiScheduling}
                activeOpacity={0.7}
              >
                {aiScheduling ? (
                  <ActivityIndicator size={12} color={theme.primary} />
                ) : (
                  <Ionicons name="calendar-outline" size={13} color={theme.primary} />
                )}
                <Text style={[typography.caption, { color: theme.primary, fontWeight: '600' }]} numberOfLines={1}>
                  AI 规划
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {viewMode === 'timeline' ? (
        <View style={{ flex: 1, paddingBottom: bottomSafeSpace }}>
          <View style={[styles.tlSection, { paddingBottom: 8 }]}>
            <View style={styles.tlSectionHeader}>
              <Text style={[typography.label, { color: theme.textSecondary }]}>
                时间轴
              </Text>
              {unscheduledTasks.length > 0 && (
                <Text style={[typography.small, { color: theme.textSecondary }]}>
                  点击空白处安排任务
                </Text>
              )}
            </View>
            {renderTimeline()}
          </View>

          {unscheduledTasks.length > 0 && (
            <View style={styles.unscheduledSection}>
              <Text
                style={[typography.label, { color: theme.textSecondary, paddingHorizontal: 20, marginBottom: 10 }]}
              >
                待安排 ({unscheduledTasks.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
              >
                {unscheduledTasks.map((task) => (
                  <TouchableOpacity
                    key={task.id}
                    style={[
                      styles.unschedCard,
                      {
                        backgroundColor: theme.card,
                        borderWidth: 1,
                        borderColor: theme.border,
                        borderLeftWidth: 4,
                        borderLeftColor: priorityColors[task.priority],
                      },
                    ]}
                    onPress={() => openTimePickerForTask(task)}
                    activeOpacity={0.7}
                  >
                    <Text style={[typography.bodyMedium, { color: theme.text }]} numberOfLines={2}>
                      {task.title}
                    </Text>
                    <View style={styles.unschedHintRow}>
                      <Ionicons name="time-outline" size={11} color={theme.textSecondary} />
                      <Text style={[typography.small, { color: theme.textSecondary }]}>
                        点击安排
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomSafeSpace + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {unscheduledTasks.length > 0 && (
            <View style={styles.listSection}>
              <Text style={[typography.label, { color: theme.text, marginBottom: 12 }]}>
                待完成 ({unscheduledTasks.length})
              </Text>
              {unscheduledTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  theme={theme}
                  onToggle={toggleTask}
                  onDelete={handleDeleteTask}
                  onToggleSubtask={toggleSubtask}
                  onLongPress={(t) => openTimePickerForTask(t)}
                  hint="长按安排到时间轴"
                />
              ))}
            </View>
          )}

          {completedTasks.length > 0 && (
            <View style={styles.listSection}>
              <TouchableOpacity
                style={styles.collapseHeader}
                onPress={() => setShowCompleted(!showCompleted)}
              >
                <Text style={[typography.label, { color: theme.textSecondary }]}>
                  已完成 ({completedTasks.length})
                </Text>
                <Ionicons
                  name={showCompleted ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              {showCompleted &&
                completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    theme={theme}
                    onToggle={toggleTask}
                    onDelete={handleDeleteTask}
                    onToggleSubtask={toggleSubtask}
                  />
                ))}
            </View>
          )}

          {todayTasks.length === 0 && (
            <EmptyState
              theme={theme}
              icon="sunny-outline"
              title="今天没有任务"
              subtitle="享受美好的一天吧!"
            />
          )}
        </ScrollView>
      )}

      {/* Time picker for a specific task */}
      <BottomSheet
        visible={showTimePicker}
        onClose={() => {
          setShowTimePicker(false)
          setSelectedTask(null)
        }}
        theme={theme}
        title="安排时间"
      >
        {selectedTask && (
          <TimePickerContent
            task={selectedTask}
            onConfirm={handleSchedule}
            theme={theme}
            initialHour={prefillHour}
            initialMinute={prefillMinute}
          />
        )}
      </BottomSheet>

      {/* Task picker from timeline tap */}
      <BottomSheet
        visible={showTaskPicker}
        onClose={() => setShowTaskPicker(false)}
        theme={theme}
        title="安排任务"
      >
        <TaskPickerContent
          tasks={unscheduledTasks}
          theme={theme}
          initialHour={prefillHour}
          initialMinute={prefillMinute}
          onPick={handleTaskPickSchedule}
        />
      </BottomSheet>

      {/* Task detail from time block tap */}
      <BottomSheet
        visible={showTaskDetail}
        onClose={() => { setShowTaskDetail(false); setDetailTask(null); setDetailSlot(null) }}
        theme={theme}
        title="任务详情"
      >
        {detailTask && detailSlot && (() => {
          const liveTask = tasks.find(t => t.id === detailTask.id) || detailTask
          return (
            <TaskDetailContent
              task={liveTask}
              slot={detailSlot}
              theme={theme}
              onToggleTask={toggleTask}
              onToggleSubtask={toggleSubtask}
              onRemoveSlot={handleRemoveSlot}
              onClose={() => { setShowTaskDetail(false); setDetailTask(null); setDetailSlot(null) }}
            />
          )
        })()}
      </BottomSheet>

      {/* AI Daily Summary */}
      <BottomSheet
        visible={showSummary && !!aiSummary}
        onClose={() => setShowSummary(false)}
        theme={theme}
        title="AI 每日总结"
      >
        {aiSummary && (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[typography.label, { color: theme.text }]}>完成度</Text>
              <Text style={[typography.heading3, { color: theme.primary }]}>{aiSummary.completionRate}</Text>
            </View>
            <Text style={[typography.body, { color: theme.textSecondary, lineHeight: 20 }]}>
              {aiSummary.summary}
            </Text>
            {aiSummary.highlights.length > 0 && (
              <View>
                <Text style={[typography.label, { color: theme.text, marginBottom: 6 }]}>亮点</Text>
                {aiSummary.highlights.map((h, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                    <Text style={{ color: theme.success, fontSize: 12 }}>+</Text>
                    <Text style={[typography.small, { color: theme.textSecondary, flex: 1 }]}>{h}</Text>
                  </View>
                ))}
              </View>
            )}
            {aiSummary.suggestions.length > 0 && (
              <View>
                <Text style={[typography.label, { color: theme.text, marginBottom: 6 }]}>改进建议</Text>
                {aiSummary.suggestions.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                    <Text style={{ color: theme.warning, fontSize: 12 }}>-</Text>
                    <Text style={[typography.small, { color: theme.textSecondary, flex: 1 }]}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
            {aiSummary.tomorrowPlan.length > 0 && (
              <View>
                <Text style={[typography.label, { color: theme.text, marginBottom: 6 }]}>明日建议</Text>
                {aiSummary.tomorrowPlan.map((p, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                    <Text style={{ color: theme.primary, fontSize: 12 }}>*</Text>
                    <Text style={[typography.small, { color: theme.textSecondary, flex: 1 }]}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    paddingTop: 56,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 3,
    gap: 2,
  },
  segBtn: {
    width: 36,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsPills: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 6,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tlSection: { flex: 1, paddingTop: 8 },
  tlSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  tlContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 20,
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    width: TIMELINE_LEFT,
    fontSize: 11,
    textAlign: 'right',
    paddingRight: 8,
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  nowLine: {
    position: 'absolute',
    left: TIMELINE_LEFT,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  nowDotOuter: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    left: -4,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nowBar: {
    flex: 1,
    height: 2,
    marginLeft: -4,
  },
  timeBlock: {
    position: 'absolute',
    left: TIMELINE_LEFT,
    right: 8,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  tbCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tbTime: { fontSize: 10 },
  tbTitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  tbTitleCompact: { fontSize: 12, fontWeight: '600', flex: 1 },
  tbSubText: {
    fontSize: 10,
    fontWeight: '500',
  },
  unscheduledSection: {
    paddingVertical: 12,
    paddingBottom: 16,
  },
  unschedCard: {
    width: 150,
    padding: 14,
    borderRadius: 14,
    justifyContent: 'space-between',
    minHeight: 80,
  },
  unschedHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  listContent: {
    padding: 20,
    paddingBottom: 120,
  },
  listSection: { marginBottom: 24 },
  collapseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  // Task picker
  taskPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  taskPickDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  // Time picker
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  pickerChipText: { fontSize: 16, fontWeight: '600' },
  timeSep: { fontSize: 20, fontWeight: 'bold', marginHorizontal: 6 },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  durationChipText: { fontSize: 14, fontWeight: '500' },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 14,
    marginTop: 24,
  },
  confirmBtnText: { color: 'white', fontSize: 16, fontWeight: '600' },
})

const detailStyles = StyleSheet.create({
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subsSection: {
    marginBottom: 20,
  },
  subsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  subProgressBarBg: {
    width: 80,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  subProgressBarFill: {
    height: '100%' as any,
    borderRadius: 2,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  subCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTitle: {
    flex: 1,
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
})

export default TodayScreen
