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
  TextInput,
  PanResponder,
  RefreshControl,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import useStore from '../store/useStore'
import { getTheme } from '../theme/colors'
import { typography } from '../theme/typography'
import { Task, TimeSlot, CourseSlot } from '../types'
import TaskCard from '../components/TaskCard'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import CelebrationOverlay from '../components/CelebrationOverlay'
import { syncWithCloud } from '../lib/cloudSync'
import { isSupabaseConfigured } from '../lib/supabase'
import { generateDailySummary, generateSchedule, isAIConfigured, parseCourseGoal, generateMorningBriefing, generateWeeklyReview, parseScheduleCommand, type DailySummary, type MorningBriefing, type WeeklyReview } from '../services/ai'
// Course filtering now done inline with selectedDate

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const START_HOUR = 8
const DEFAULT_END_HOUR = 22
const TIMELINE_LEFT = 44
const HEADER_HEIGHT = 100
const { height: SCREEN_HEIGHT } = Dimensions.get('window')

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const MONTH_LABELS = ['月', '火', '水', '木', '金', '土', '日']

const getWeekDates = (date: Date): Date[] => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() || 7
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(monday)
    nd.setDate(monday.getDate() + i)
    return nd
  })
}

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

  const hours = Array.from({ length: 23 - START_HOUR + 1 }, (_, i) => START_HOUR + i)
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

  const hours = Array.from({ length: 23 - START_HOUR + 1 }, (_, i) => START_HOUR + i)
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
    habits,
    themeColor,
    darkMode,
    updateTask,
    deleteTask,
    addTimeSlot,
    removeTimeSlot,
    toggleSubtask,
    courses,
    semesterStart,
    courseGoals,
    addCourseGoal,
    removeCourseGoal,
  } = useStore()
  const tabBarHeight = useBottomTabBarHeight()
  const bottomSafeSpace = Math.max(tabBarHeight, 80) + 12
  const theme = getTheme(themeColor, darkMode)

  // Date selection
  const [selectedDate, setSelectedDate] = useState(new Date())
  const today = format(selectedDate, 'yyyy-MM-dd')
  const actualToday = format(new Date(), 'yyyy-MM-dd')
  const isViewingToday = today === actualToday
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate])

  const weekNumber = useMemo(() => {
    if (!semesterStart) return null
    const sd = new Date(selectedDate)
    sd.setHours(0, 0, 0, 0)
    const start = new Date(semesterStart)
    start.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((sd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const week = Math.floor(diffDays / 7) + 1
    return week >= 1 && week <= 25 ? week : null
  }, [semesterStart, selectedDate])

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
  const [unschedExpanded, setUnschedExpanded] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const prevPendingRef = useRef<number | null>(null)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      const { user, tasks, timeSlots, projects, habits, setSyncData } = useStore.getState()
      if (user && isSupabaseConfigured()) {
        const cloudData = await syncWithCloud(user.id, { tasks, timeSlots, projects, habits })
        const isEmpty = cloudData.tasks.length === 0 && cloudData.timeSlots.length === 0 &&
          cloudData.projects.length === 0 && cloudData.habits.length === 0
        if (!isEmpty) setSyncData(cloudData)
      }
    } catch { /* ignore */ }
    setRefreshing(false)
  }, [])

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

  const slideAnim = useRef(new Animated.Value(0)).current
  const isSwipingRef = useRef(false)

  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gs) =>
        !isSwipingRef.current && Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderGrant: () => {
        slideAnim.setValue(0)
      },
      onPanResponderMove: (_evt, gs) => {
        slideAnim.setValue(gs.dx)
      },
      onPanResponderRelease: (_evt, gs) => {
        if (gs.dx > 50 || (gs.dx > 0 && gs.vx > 0.5)) {
          isSwipingRef.current = true
          Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 200, useNativeDriver: true }).start(() => {
            setSelectedDate(prev => {
              const d = new Date(prev)
              d.setDate(d.getDate() - 1)
              return d
            })
            slideAnim.setValue(-SCREEN_WIDTH)
            Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
              isSwipingRef.current = false
            })
          })
        } else if (gs.dx < -50 || (gs.dx < 0 && gs.vx < -0.5)) {
          isSwipingRef.current = true
          Animated.timing(slideAnim, { toValue: -SCREEN_WIDTH, duration: 200, useNativeDriver: true }).start(() => {
            setSelectedDate(prev => {
              const d = new Date(prev)
              d.setDate(d.getDate() + 1)
              return d
            })
            slideAnim.setValue(SCREEN_WIDTH)
            Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
              isSwipingRef.current = false
            })
          })
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start()
        }
      },
    })
  ).current

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === today && t.status !== 'cancelled'),
    [tasks, today]
  )
  const todaySlots = useMemo(
    () => timeSlots.filter((s) => s.date === today),
    [timeSlots, today]
  )

  const todayCourses = useMemo(() => {
    if (!semesterStart || courses.length === 0) return []
    const sd = new Date(selectedDate)
    sd.setHours(0, 0, 0, 0)
    const dayOfWeek = sd.getDay() || 7
    const start = new Date(semesterStart)
    start.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((sd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const currentWeek = Math.floor(diffDays / 7) + 1
    if (currentWeek < 1 || currentWeek > 25) return []
    return courses.filter(c => c.dayOfWeek === dayOfWeek && c.weeks.includes(currentWeek))
  }, [courses, semesterStart, selectedDate])

  const effectiveEndHour = useMemo(() => {
    const hasLate = todaySlots.some(s => s.startTime + s.duration > DEFAULT_END_HOUR * 60)
      || todayCourses.some(c => c.startTime + c.duration > DEFAULT_END_HOUR * 60)
    return hasLate ? 23 : DEFAULT_END_HOUR
  }, [todaySlots, todayCourses])

  const TAB_BAR_HEIGHT = Math.max(tabBarHeight, 80)
  const MIN_HOUR_HEIGHT = 38
  const hourHeight = useMemo(() => {
    const available = SCREEN_HEIGHT - HEADER_HEIGHT - TAB_BAR_HEIGHT
    const numHours = effectiveEndHour - START_HOUR
    const calculated = Math.floor(available / numHours)
    return Math.max(calculated, MIN_HOUR_HEIGHT)
  }, [effectiveEndHour])

  const timelineOverflows = useMemo(() => {
    const available = SCREEN_HEIGHT - HEADER_HEIGHT - TAB_BAR_HEIGHT
    const totalHeight = (effectiveEndHour - START_HOUR) * hourHeight
    return totalHeight > available
  }, [effectiveEndHour, hourHeight])

  const clampSlotToTimeline = useCallback((startTime: number, duration: number) => {
    const maxDuration = effectiveEndHour * 60 - START_HOUR * 60
    const safeDuration = Math.max(15, Math.min(duration, maxDuration))
    const safeStart = Math.max(
      START_HOUR * 60,
      Math.min(startTime, effectiveEndHour * 60 - safeDuration)
    )
    return { startTime: safeStart, duration: safeDuration }
  }, [effectiveEndHour])

  const scheduleSlot = useCallback((
    taskId: string,
    startTime: number,
    duration: number,
    silent = false
  ) => {
    let candidate = clampSlotToTimeline(startTime, duration)

    const allOccupied = [
      ...todaySlots.map(s => ({ startTime: s.startTime, duration: s.duration })),
      ...todayCourses.map(c => ({ startTime: c.startTime, duration: c.duration })),
    ]

    let attempts = 0
    while (attempts < 50) {
      const end = candidate.startTime + candidate.duration
      const conflict = allOccupied.find(o => candidate.startTime < o.startTime + o.duration && end > o.startTime)
      if (!conflict) break
      candidate = clampSlotToTimeline(conflict.startTime + conflict.duration + 5, candidate.duration)
      attempts++
    }

    if (candidate.startTime + candidate.duration > effectiveEndHour * 60) {
      if (!silent) {
        Alert.alert('无法安排', '今日剩余时间不足，无法避开所有课程和任务。')
      }
      return false
    }

    addTimeSlot({ taskId, date: today, startTime: candidate.startTime, duration: candidate.duration })
    return true
  }, [addTimeSlot, today, todaySlots, todayCourses, clampSlotToTimeline, effectiveEndHour])
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

  useEffect(() => {
    if (prevPendingRef.current !== null && prevPendingRef.current > 0 && pendingCount === 0 && todayTasks.length > 0) {
      setShowCelebration(true)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    prevPendingRef.current = pendingCount
  }, [pendingCount, todayTasks.length])

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
      const courseOccupied = todayCourses.map(c => ({
        startTime: c.startTime,
        duration: c.duration,
      }))
      const occupiedSlots: TimeSlot[] = [
        ...todaySlots,
        ...todayCourses.map(c => ({
          id: c.id, taskId: '', date: today,
          startTime: c.startTime, duration: c.duration,
        })),
      ]
      const existing = [
        ...todaySlots.map(s => ({ startTime: s.startTime, duration: s.duration })),
        ...courseOccupied,
      ]
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

  // Morning Briefing
  const [briefing, setBriefing] = useState<MorningBriefing | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingDismissed, setBriefingDismissed] = useState(false)

  useEffect(() => {
    if (!aiAvailable || briefingDismissed || briefing || briefingLoading) return
    if (!isViewingToday || todayTasks.length === 0) return
    const hour = new Date().getHours()
    if (hour < 5 || hour > 11) return
    setBriefingLoading(true)
    generateMorningBriefing(
      todayTasks.map(t => ({ title: t.title, priority: t.priority, status: t.status })),
      todayCourses.map(c => ({ name: c.name, startTime: c.startTime, duration: c.duration })),
      todaySlots.map(s => ({ startTime: s.startTime, duration: s.duration, taskId: s.taskId })),
      habits.map(h => ({ name: h.name, icon: h.icon, records: h.records })),
      today
    ).then(setBriefing).catch(() => {}).finally(() => setBriefingLoading(false))
  }, [aiAvailable, isViewingToday, todayTasks.length])

  // Weekly Review
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview | null>(null)
  const [weeklyReviewLoading, setWeeklyReviewLoading] = useState(false)
  const [showWeeklyReview, setShowWeeklyReview] = useState(false)

  const handleWeeklyReview = async () => {
    if (weeklyReviewLoading) return
    setWeeklyReviewLoading(true)
    try {
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
      const weekTaskData: { date: string; title: string; status: string }[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + i)
        const ds = format(d, 'yyyy-MM-dd')
        tasks.filter(t => t.dueDate === ds).forEach(t => weekTaskData.push({ date: ds, title: t.title, status: t.status }))
      }
      const weekHabitData = habits.map(h => {
        let checks = 0
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart)
          d.setDate(d.getDate() + i)
          if (h.records[format(d, 'yyyy-MM-dd')]) checks++
        }
        return { name: h.name, icon: h.icon, weekChecks: checks, total: 7 }
      })
      const result = await generateWeeklyReview(weekTaskData, weekHabitData, [])
      setWeeklyReview(result)
      setShowWeeklyReview(true)
    } catch (err: any) {
      Alert.alert('周报生成失败', err?.message || '请重试')
    }
    setWeeklyReviewLoading(false)
  }

  // Course goal AI input (also used for natural language rescheduling)
  const [courseGoalInput, setCourseGoalInput] = useState('')
  const [courseGoalLoading, setCourseGoalLoading] = useState(false)

  const handleSmartInput = async () => {
    const text = courseGoalInput.trim()
    if (!text || courseGoalLoading) return
    setCourseGoalLoading(true)
    try {
      const rescheduleKeywords = /改到|推迟|提前|取消安排|挪到|移到|延后/
      if (rescheduleKeywords.test(text) && todaySlots.length > 0) {
        const tasksForAI = todayTasks.map(t => ({ id: t.id, title: t.title }))
        const slotsForAI = todaySlots.map(s => ({ id: s.id, taskId: s.taskId, startTime: s.startTime, duration: s.duration }))
        const cmd = await parseScheduleCommand(text, tasksForAI, slotsForAI, today)
        if (cmd.action === 'cancel' && cmd.taskId) {
          const slotToRemove = todaySlots.find(s => s.taskId === cmd.taskId)
          if (slotToRemove) removeTimeSlot(slotToRemove.id)
          Alert.alert('已取消', `已取消「${cmd.taskTitle || '任务'}」的时间安排`)
        } else if (cmd.action === 'reschedule' && cmd.taskId && cmd.newStartTime) {
          const slotToUpdate = todaySlots.find(s => s.taskId === cmd.taskId)
          if (slotToUpdate) {
            removeTimeSlot(slotToUpdate.id)
            addTimeSlot({ taskId: cmd.taskId, date: cmd.newDate || today, startTime: cmd.newStartTime, duration: slotToUpdate.duration })
          }
          const h = Math.floor(cmd.newStartTime / 60)
          const m = cmd.newStartTime % 60
          Alert.alert('已改排', `「${cmd.taskTitle || '任务'}」改到 ${h}:${String(m).padStart(2, '0')}`)
        } else if (cmd.action === 'shift' && cmd.shiftMinutes) {
          const slotsToShift = cmd.scope === 'afternoon'
            ? todaySlots.filter(s => s.startTime >= 12 * 60)
            : todaySlots
          slotsToShift.forEach(s => {
            removeTimeSlot(s.id)
            addTimeSlot({ taskId: s.taskId, date: today, startTime: s.startTime + cmd.shiftMinutes!, duration: s.duration })
          })
          Alert.alert('已调整', `已将${cmd.scope === 'afternoon' ? '下午' : '所有'}任务${cmd.shiftMinutes > 0 ? '推迟' : '提前'}${Math.abs(cmd.shiftMinutes)}分钟`)
        }
        setCourseGoalInput('')
        setCourseGoalLoading(false)
        return
      }

      if (todayCourses.length > 0 && todayTasks.length > 0) {
        const coursesForAI = todayCourses.map(c => ({
          id: c.id, name: c.name, startTime: c.startTime, duration: c.duration,
        }))
        const tasksForAI = todayTasks.map(t => ({ id: t.id, title: t.title }))
        const result = await parseCourseGoal(text, coursesForAI, tasksForAI)
        const matchedCourse = todayCourses.find(c => c.id === result.courseId)
        addCourseGoal(result.courseId, today, result.taskId, result.taskTitle)
        setCourseGoalInput('')
        Alert.alert('已添加', `「${result.taskTitle}」→ ${matchedCourse?.name || '课程'}`)
      } else {
        Alert.alert('提示', '今天没有课程或任务可以操作')
      }
    } catch (err: any) {
      Alert.alert('操作失败', err?.message || '请重试')
    }
    setCourseGoalLoading(false)
  }

  const handleCourseGoalLongPress = (course: CourseSlot) => {
    const key = `${course.id}_${today}`
    const goals = courseGoals[key]
    if (!goals || goals.length === 0) return

    const buttons = goals.map((g, i) => ({
      text: `删除: ${g.taskTitle}`,
      style: 'destructive' as const,
      onPress: () => removeCourseGoal(course.id, today, i),
    }))
    buttons.push({ text: '取消', style: 'cancel' as const, onPress: () => {} })
    Alert.alert(`${course.name} - 课程任务`, '选择要删除的任务', buttons)
  }

  const toggleTask = (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    if (newStatus === 'completed') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateTask(task.id, { status: newStatus })
  }

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
    const rawMinutes = (y / hourHeight) * 60 + START_HOUR * 60
    const snapped = Math.round(rawMinutes / 15) * 15
    const clamped = Math.max(START_HOUR * 60, Math.min(effectiveEndHour * 60, snapped))
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

  const [draggingSlot, setDraggingSlot] = useState<string | null>(null)
  const dragOffsetY = useRef(new Animated.Value(0)).current
  const dragStartY = useRef(0)
  const dragCurrentOffset = useRef(0)

  const handleSlotDragStart = (slot: TimeSlot, gestureY: number) => {
    setDraggingSlot(slot.id)
    dragStartY.current = gestureY
    dragCurrentOffset.current = 0
    dragOffsetY.setValue(0)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  const handleSlotDragMove = (gestureY: number) => {
    const offset = gestureY - dragStartY.current
    dragCurrentOffset.current = offset
    dragOffsetY.setValue(offset)
  }

  const handleSlotDragEnd = (slot: TimeSlot) => {
    const offset = dragCurrentOffset.current
    const minutesDelta = Math.round((offset / hourHeight) * 60 / 15) * 15
    if (Math.abs(minutesDelta) >= 15) {
      const newStart = Math.max(START_HOUR * 60, Math.min(effectiveEndHour * 60 - slot.duration, slot.startTime + minutesDelta))
      removeTimeSlot(slot.id)
      addTimeSlot({ taskId: slot.taskId, date: slot.date, startTime: newStart, duration: slot.duration })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
    setDraggingSlot(null)
    dragOffsetY.setValue(0)
  }

  const renderTimeline = () => {
    const hours = Array.from({ length: effectiveEndHour - START_HOUR + 1 }, (_, i) => START_HOUR + i)
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const hasUnscheduled = unscheduledTasks.length > 0

    const timelineHeight = (effectiveEndHour - START_HOUR) * hourHeight + 12

    const timelineContent = (
          <TouchableOpacity
            activeOpacity={hasUnscheduled ? 0.95 : 1}
            onPress={hasUnscheduled ? handleTimelineTap : undefined}
            style={{ height: timelineHeight, position: 'relative' }}
          >
            {hours.map((hour) => (
              <View key={hour} style={[styles.hourRow, { top: (hour - START_HOUR) * hourHeight }]}>
                <Text style={[styles.hourLabel, { color: theme.textSecondary }]}>
                  {hour.toString().padStart(2, '0')}
                </Text>
                <View style={[styles.hourLine, { backgroundColor: theme.border }]} />
              </View>
            ))}

            {isViewingToday && currentMinutes >= START_HOUR * 60 && currentMinutes <= effectiveEndHour * 60 && (
              <View
                style={[
                  styles.nowLine,
                  { top: ((currentMinutes - START_HOUR * 60) / 60) * hourHeight },
                ]}
              >
                <Animated.View
                  style={[
                    styles.nowDotOuter,
                    { backgroundColor: `${theme.primary}30`, transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <View style={[styles.nowDot, { backgroundColor: theme.primary }]} />
              </View>
            )}

            {todaySlots.map((slot) => {
              const task = tasks.find((t) => t.id === slot.taskId)
              if (!task) return null
              const top = ((slot.startTime - START_HOUR * 60) / 60) * hourHeight
              const height = (slot.duration / 60) * hourHeight
              const isDone = task.status === 'completed'
              const pColor = priorityColors[task.priority]
              const totalSubs = task.subtasks?.length || 0
              const doneSubs = task.subtasks?.filter(s => s.completed).length || 0
              const isCompact = height < 50
              const isDragging = draggingSlot === slot.id

              return (
                <Animated.View
                  key={slot.id}
                  style={[
                    styles.timeBlock,
                    {
                      top,
                      height: Math.max(height, 24),
                      backgroundColor: theme.card,
                      borderWidth: isDragging ? 2 : 1,
                      borderColor: isDragging ? theme.primary : theme.border,
                      borderLeftWidth: 4,
                      borderLeftColor: pColor,
                      opacity: isDone ? 0.6 : 1,
                      transform: isDragging ? [{ translateY: dragOffsetY }] : [],
                      zIndex: isDragging ? 100 : 5,
                      elevation: isDragging ? 8 : 2,
                    },
                  ]}
                >
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => openTaskDetail(task, slot)}
                  onLongPress={(e) => handleSlotDragStart(slot, e.nativeEvent.pageY)}
                  onStartShouldSetResponderCapture={() => isDragging}
                  onMoveShouldSetResponderCapture={() => isDragging}
                  onMoveShouldSetResponder={() => isDragging}
                  onResponderMove={(e) => { if (isDragging) handleSlotDragMove(e.nativeEvent.pageY) }}
                  onResponderRelease={() => { if (isDragging) handleSlotDragEnd(slot) }}
                  onResponderTerminate={() => { if (isDragging) handleSlotDragEnd(slot) }}
                  activeOpacity={isDragging ? 1 : 0.7}
                  delayLongPress={400}
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.tbTitle, { color: isDone ? theme.textSecondary : theme.text, flex: 1 }]} numberOfLines={1}>
                          {task.title}
                        </Text>
                        {(task.postponeCount || 0) >= 3 && !isDone && (
                          <Ionicons name="alert-circle" size={12} color={theme.warning} />
                        )}
                      </View>
                    </>
                  )}
                </TouchableOpacity>
                </Animated.View>
              )
            })}

            {todayCourses.map((course) => {
              const top = ((course.startTime - START_HOUR * 60) / 60) * hourHeight
              const height = (course.duration / 60) * hourHeight
              const isCompact = height < 50
              const goalKey = `${course.id}_${today}`
              const goals = courseGoals[goalKey] || []
              const hasGoals = goals.length > 0

              return (
                <TouchableOpacity
                  key={course.id}
                  style={[
                    styles.timeBlock,
                    {
                      top,
                      height: Math.max(height, 24),
                      backgroundColor: `${course.color}18`,
                      borderWidth: 1,
                      borderColor: `${course.color}40`,
                      borderLeftWidth: 4,
                      borderLeftColor: course.color,
                    },
                  ]}
                  activeOpacity={hasGoals ? 0.7 : 1}
                  onLongPress={() => handleCourseGoalLongPress(course)}
                >
                  {isCompact ? (
                    <View style={styles.tbCompact}>
                      <Ionicons name="school-outline" size={11} color={course.color} style={{ marginRight: 4 }} />
                      <Text style={[styles.tbTitleCompact, { color: course.color }]} numberOfLines={1}>
                        {course.name}
                      </Text>
                      {hasGoals && (
                        <View style={[styles.courseGoalDot, { backgroundColor: course.color }]} />
                      )}
                    </View>
                  ) : (
                    <>
                      <View style={styles.tbHeader}>
                        <Text style={{ fontSize: 10, color: course.color, fontWeight: '500' }}>
                          {formatTime(course.startTime)} - {formatTime(course.startTime + course.duration)}
                        </Text>
                        <Ionicons name="school" size={12} color={course.color} />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: course.color, marginTop: 1 }} numberOfLines={1}>
                        {course.name}
                      </Text>
                      {course.location && !hasGoals ? (
                        <Text style={{ fontSize: 10, color: `${course.color}99`, marginTop: 1 }} numberOfLines={1}>
                          📍 {course.location}
                        </Text>
                      ) : null}
                      {hasGoals && (
                        <View style={styles.courseGoalList}>
                          {goals.map((g, gi) => (
                            <View key={gi} style={styles.courseGoalItem}>
                              <Ionicons name="checkbox-outline" size={9} color={course.color} />
                              <Text style={{ fontSize: 10, color: course.color, flex: 1 }} numberOfLines={1}>
                                {g.taskTitle}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              )
            })}
          </TouchableOpacity>
    )

    return (
      <View style={styles.tlContainer}>
        <ScrollView
          nestedScrollEnabled
          scrollEnabled={!draggingSlot}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 8, minHeight: timelineOverflows ? undefined : '100%' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
        >
          {timelineContent}
        </ScrollView>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      <View style={[styles.headerGradient, { backgroundColor: theme.background }]}>
        {/* Compact single-line header */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>
              {format(selectedDate, 'M/d')}
            </Text>
            <Text style={{ fontSize: 13, color: theme.textSecondary }}>
              {DAY_LABELS[(selectedDate.getDay() + 6) % 7]}
            </Text>
            {weekNumber ? (
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                第{weekNumber}周
              </Text>
            ) : null}
            <Text style={{ fontSize: 10, color: theme.textSecondary, marginLeft: 2 }}>
              {pendingCount}待办·{completedCount}完成
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!isViewingToday && (
              <TouchableOpacity
                style={[styles.todayBtn, { backgroundColor: theme.primary + '18', borderColor: theme.primary + '30' }]}
                onPress={() => setSelectedDate(new Date())}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.primary }}>今天</Text>
              </TouchableOpacity>
            )}
            <View style={[styles.segmented, { backgroundColor: theme.surfaceSecondary }]}>
              <TouchableOpacity
                style={[styles.segBtn, viewMode === 'timeline' && { backgroundColor: theme.card }]}
                onPress={() => setViewMode('timeline')}
              >
                <Ionicons name="calendar-outline" size={14} color={viewMode === 'timeline' ? theme.primary : theme.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, viewMode === 'list' && { backgroundColor: theme.card }]}
                onPress={() => setViewMode('list')}
              >
                <Ionicons name="list-outline" size={14} color={viewMode === 'list' ? theme.primary : theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Compact week strip */}
        <View style={styles.weekStrip}>
          {weekDates.map((date, i) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const isSelected = dateStr === today
            const isRealToday = dateStr === actualToday
            const dayTasks = tasks.filter(t => t.dueDate === dateStr && t.status !== 'cancelled')
            const hasTasks = dayTasks.length > 0

            return (
              <TouchableOpacity
                key={i}
                style={[styles.weekDayItem]}
                onPress={() => setSelectedDate(new Date(date))}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.weekDayLabel,
                  { color: isSelected ? theme.primary : theme.textSecondary },
                ]}>
                  {DAY_LABELS[i]}
                </Text>
                <View style={[
                  styles.weekDayDateWrap,
                  isSelected && { backgroundColor: theme.primary },
                  isRealToday && !isSelected && { borderWidth: 1.5, borderColor: theme.primary },
                ]}>
                  <Text style={[
                    styles.weekDayDate,
                    { color: isSelected ? '#fff' : isRealToday ? theme.primary : theme.text },
                  ]}>
                    {date.getDate()}
                  </Text>
                </View>
                {hasTasks && (
                  <View style={[styles.weekDayDot, { backgroundColor: isSelected ? theme.primary + '60' : theme.primary }]} />
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {/* Morning Briefing */}
      {briefing && !briefingDismissed && isViewingToday && (
        <View style={[styles.briefingCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '20' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.primary, marginBottom: 4 }}>{briefing.greeting}</Text>
              <Text style={{ fontSize: 12, color: theme.text, marginBottom: 4 }}>{briefing.overview}</Text>
              {briefing.priorities.length > 0 && (
                <View style={{ gap: 2 }}>
                  {briefing.priorities.map((p, i) => (
                    <Text key={i} style={{ fontSize: 11, color: theme.textSecondary }}>· {p}</Text>
                  ))}
                </View>
              )}
              <Text style={{ fontSize: 11, color: theme.primary, marginTop: 4, fontStyle: 'italic' }}>{briefing.motivational}</Text>
            </View>
            <TouchableOpacity onPress={() => setBriefingDismissed(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Smart AI input */}
      {aiAvailable && (todayCourses.length > 0 || todaySlots.length > 0) && (
        <View style={[styles.courseGoalBar, { borderBottomColor: theme.border }]}>
          <View style={[styles.courseGoalInputWrap, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
            <Ionicons name="sparkles-outline" size={14} color={theme.textSecondary} />
            <TextInput
              style={[styles.courseGoalInput, { color: theme.text }]}
              placeholder="课程任务 / 改排日程..."
              placeholderTextColor={theme.textSecondary + '80'}
              value={courseGoalInput}
              onChangeText={setCourseGoalInput}
              onSubmitEditing={handleSmartInput}
              returnKeyType="send"
              editable={!courseGoalLoading}
            />
            <TouchableOpacity
              onPress={handleSmartInput}
              disabled={courseGoalLoading || !courseGoalInput.trim()}
              activeOpacity={0.6}
              style={[styles.courseGoalSendBtn, {
                backgroundColor: courseGoalInput.trim() ? theme.primary : theme.primary + '30',
              }]}
            >
              {courseGoalLoading ? (
                <ActivityIndicator size={12} color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={14} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }} {...swipePanResponder.panHandlers}>
      {viewMode === 'timeline' ? (
        <View style={{ flex: 1 }}>
          {/* Unscheduled tasks at top, before timeline */}
          {unscheduledTasks.length > 0 && (
            <View style={[styles.unscheduledSection, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <TouchableOpacity
                style={styles.unschedHeader}
                onPress={() => setUnschedExpanded(!unschedExpanded)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[typography.label, { color: theme.textSecondary }]}>
                    待安排
                  </Text>
                  <View style={[styles.unschedBadge, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.primary }}>
                      {unscheduledTasks.length}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={unschedExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
              {unschedExpanded && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }}
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
              )}
            </View>
          )}

          <View style={[styles.tlSection, { paddingBottom: 0, flex: 1 }]}>
            {renderTimeline()}
          </View>

          {/* Floating AI buttons — normal flow, sits above tab bar */}
          {aiAvailable && (unscheduledTasks.length > 0 || todayTasks.length > 0) && (
            <View style={[styles.floatingAiRow, { marginBottom: bottomSafeSpace }]}>
              {unscheduledTasks.length > 0 && (
                <TouchableOpacity
                  style={[styles.floatingAiBtn, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
                  onPress={handleAISchedule}
                  disabled={aiScheduling}
                  activeOpacity={0.7}
                >
                  {aiScheduling ? (
                    <ActivityIndicator size={10} color={theme.primary} />
                  ) : (
                    <Ionicons name="sparkles" size={12} color={theme.primary} />
                  )}
                  <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '600' }}>AI规划</Text>
                </TouchableOpacity>
              )}
              {todayTasks.length > 0 && (
                <TouchableOpacity
                  style={[styles.floatingAiBtn, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
                  onPress={handleGenerateSummary}
                  disabled={aiSummaryLoading}
                  activeOpacity={0.7}
                >
                  {aiSummaryLoading ? (
                    <ActivityIndicator size={10} color={theme.primary} />
                  ) : (
                    <Ionicons name="sparkles-outline" size={12} color={theme.primary} />
                  )}
                  <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '600' }}>总结</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.floatingAiBtn, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
                onPress={handleWeeklyReview}
                disabled={weeklyReviewLoading}
                activeOpacity={0.7}
              >
                {weeklyReviewLoading ? (
                  <ActivityIndicator size={10} color={theme.primary} />
                ) : (
                  <Ionicons name="analytics-outline" size={12} color={theme.primary} />
                )}
                <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '600' }}>周报</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomSafeSpace + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
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
      </Animated.View>

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

      {/* Weekly Review */}
      <BottomSheet
        visible={showWeeklyReview && !!weeklyReview}
        onClose={() => setShowWeeklyReview(false)}
        theme={theme}
        title="AI 周报"
      >
        {weeklyReview && (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={[typography.label, { color: theme.text }]}>本周完成</Text>
              <Text style={[typography.heading3, { color: theme.primary }]}>{weeklyReview.completionRate}</Text>
            </View>
            <Text style={[typography.body, { color: theme.textSecondary, lineHeight: 20 }]}>{weeklyReview.summary}</Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flex: 1, backgroundColor: theme.surfaceSecondary, borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 10, color: theme.textSecondary }}>最高效日</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginTop: 2 }}>{weeklyReview.bestDay}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: theme.surfaceSecondary, borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 10, color: theme.textSecondary }}>黄金时段</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginTop: 2 }}>{weeklyReview.mostProductiveTime}</Text>
              </View>
            </View>
            {weeklyReview.highlights.length > 0 && (
              <View>
                <Text style={[typography.label, { color: theme.text, marginBottom: 6 }]}>亮点</Text>
                {weeklyReview.highlights.map((h, i) => (
                  <Text key={i} style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 3 }}>+ {h}</Text>
                ))}
              </View>
            )}
            {weeklyReview.nextWeekSuggestions.length > 0 && (
              <View>
                <Text style={[typography.label, { color: theme.text, marginBottom: 6 }]}>下周建议</Text>
                {weeklyReview.nextWeekSuggestions.map((s, i) => (
                  <Text key={i} style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 3 }}>· {s}</Text>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18 }}>{weeklyReview.habitSummary}</Text>
          </View>
        )}
      </BottomSheet>

      <CelebrationOverlay visible={showCelebration} onFinish={() => setShowCelebration(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    paddingTop: 44,
    paddingBottom: 2,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 2,
    gap: 1,
  },
  segBtn: {
    width: 30,
    height: 26,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStrip: {
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: 2,
  },
  weekDayItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  weekDayLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  weekDayDateWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  weekDayDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  weekDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  floatingAiRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  floatingAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  tlSection: { flex: 1, paddingTop: 2 },
  tlContainer: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: 12,
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
    fontSize: 10,
    textAlign: 'right',
    paddingRight: 6,
  },
  hourLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    width: TIMELINE_LEFT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  nowDotOuter: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timeBlock: {
    position: 'absolute',
    left: TIMELINE_LEFT,
    right: 4,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
    justifyContent: 'center',
    zIndex: 5,
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
  briefingCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  courseGoalBar: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  courseGoalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 4,
    height: 32,
    gap: 6,
  },
  courseGoalInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  courseGoalSendBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseGoalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
  },
  courseGoalList: {
    marginTop: 2,
    gap: 1,
  },
  courseGoalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unscheduledSection: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  unschedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  unschedBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
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
