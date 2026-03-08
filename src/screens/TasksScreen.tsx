import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { format, parseISO, isToday, isTomorrow, isYesterday, isPast } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Ionicons } from '@expo/vector-icons'
import useStore from '../store/useStore'
import { getTheme } from '../theme/colors'
import { typography } from '../theme/typography'
import { Task, Priority } from '../types'
import TaskCard from '../components/TaskCard'
import FilterPills from '../components/FilterPills'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import { parseNaturalLanguage, generateSubtasks, isAIConfigured, type ParsedTask } from '../services/ai'
import { syncWithCloud } from '../lib/cloudSync'
import { isSupabaseConfigured } from '../lib/supabase'

interface DateGroup {
  date: string
  label: string
  tasks: Task[]
  isToday: boolean
  isPast: boolean
}

const filterOptions = [
  { key: 'pending' as const, label: '待完成' },
  { key: 'completed' as const, label: '已完成' },
  { key: 'all' as const, label: '全部' },
]

const TasksScreen = () => {
  const { tasks, themeColor, darkMode, addTask, updateTask, deleteTask, toggleSubtask } = useStore()
  const theme = getTheme(themeColor, darkMode)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium')
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [searchQuery, setSearchQuery] = useState('')

  const [refreshing, setRefreshing] = useState(false)
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

  // AI states
  const [aiAvailable, setAiAvailable] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<ParsedTask | null>(null)
  const [showSubtaskAI, setShowSubtaskAI] = useState(false)
  const [aiSubLoading, setAiSubLoading] = useState(false)
  const [aiSubtasks, setAiSubtasks] = useState<string[]>([])

  useEffect(() => {
    isAIConfigured().then(setAiAvailable)
  }, [])

  const handleAIParse = async () => {
    if (!aiInput.trim() || aiLoading) return
    setAiLoading(true)
    try {
      const result = await parseNaturalLanguage(aiInput, format(new Date(), 'yyyy-MM-dd'))
      setAiResult(result)
    } catch (err: any) {
      Alert.alert('AI 解析失败', err?.message || '请重试')
    }
    setAiLoading(false)
  }

  const handleAIConfirm = () => {
    if (!aiResult) return
    addTask({
      title: aiResult.title,
      description: aiResult.description,
      dueDate: aiResult.dueDate || format(new Date(), 'yyyy-MM-dd'),
      priority: aiResult.priority || 'medium',
      tags: aiResult.tags || [],
      subtasks: (aiResult.subtasks || []).map((st, i) => ({
        id: `subtask-ai-${Date.now()}-${i}`,
        title: st,
        completed: false,
      })),
      status: 'pending',
      estimatedMinutes: aiResult.estimatedMinutes || 60,
    })
    setAiResult(null)
    setAiInput('')
    setShowAIModal(false)
  }

  const handleAISubtasks = async () => {
    if (!newTaskTitle.trim() || aiSubLoading) return
    setAiSubLoading(true)
    try {
      const result = await generateSubtasks(newTaskTitle, '')
      setAiSubtasks(result.map(r => r.title))
    } catch { /* ignore */ }
    setAiSubLoading(false)
  }

  // Group tasks by date
  const groupedTasks = useMemo(() => {
    let filteredTasks = [...tasks]
    if (filter === 'pending') {
      filteredTasks = filteredTasks.filter(
        (t) => t.status !== 'completed' && t.status !== 'cancelled'
      )
    } else if (filter === 'completed') {
      filteredTasks = filteredTasks.filter((t) => t.status === 'completed')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      filteredTasks = filteredTasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q)) ||
        t.subtasks.some(s => s.title.toLowerCase().includes(q))
      )
    }

    const groups: { [key: string]: Task[] } = {}
    filteredTasks.forEach((task) => {
      const date = task.dueDate
      if (!groups[date]) groups[date] = []
      groups[date].push(task)
    })

    const result: DateGroup[] = Object.entries(groups)
      .map(([date, tasks]) => {
        const dateObj = parseISO(date)
        let label = format(dateObj, 'M月d日 EEEE', { locale: zhCN })
        if (isToday(dateObj)) label = '今天 · ' + format(dateObj, 'M月d日', { locale: zhCN })
        else if (isTomorrow(dateObj)) label = '明天 · ' + format(dateObj, 'M月d日', { locale: zhCN })
        else if (isYesterday(dateObj))
          label = '昨天 · ' + format(dateObj, 'M月d日', { locale: zhCN })

        return {
          date,
          label,
          tasks: tasks.sort((a, b) => {
            const po = { high: 0, medium: 1, low: 2 }
            return po[a.priority] - po[b.priority]
          }),
          isToday: isToday(dateObj),
          isPast: isPast(dateObj) && !isToday(dateObj),
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    return result
  }, [tasks, filter, searchQuery])

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return
    addTask({
      title: newTaskTitle.trim(),
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      priority: newTaskPriority,
      tags: [],
      subtasks: aiSubtasks.map((st, i) => ({
        id: `subtask-${Date.now()}-${i}`,
        title: st,
        completed: false,
      })),
      status: 'pending',
    })
    setNewTaskTitle('')
    setAiSubtasks([])
    setShowAddModal(false)
  }

  const toggleTask = (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    if (newStatus === 'completed') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateTask(task.id, { status: newStatus })
  }

  const handleDelete = (task: Task) => {
    Alert.alert('确认删除', `确定要删除任务「${task.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteTask(task.id) },
    ])
  }

  const stats = useMemo(() => {
    const pending = tasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'cancelled'
    ).length
    const completed = tasks.filter((t) => t.status === 'completed').length
    return { pending, completed }
  }, [tasks])

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.heading1, { color: theme.text }]}>全部任务</Text>
            <View style={styles.headerStats}>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                {stats.pending} 待完成 · {stats.completed} 已完成
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {aiAvailable && (
              <TouchableOpacity
                style={[styles.addButton, {
                  backgroundColor: theme.card,
                  borderWidth: 1.5,
                  borderColor: theme.primary,
                }]}
                onPress={() => { setShowAIModal(true); setAiResult(null); setAiInput('') }}
              >
                <Ionicons name="sparkles" size={20} color={theme.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => { setShowAddModal(true); setAiSubtasks([]) }}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.surfaceSecondary,
          borderRadius: 10,
          paddingHorizontal: 10,
          height: 36,
          gap: 6,
        }}>
          <Ionicons name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: theme.text, padding: 0 }}
            placeholder="搜索任务..."
            placeholderTextColor={theme.textSecondary + '80'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter */}
      <View style={[styles.filterWrapper, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
        <FilterPills
          theme={theme}
          options={filterOptions}
          selected={filter}
          onSelect={setFilter}
        />
      </View>

      {/* Task list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
      >
        {groupedTasks.map((group) => (
          <View key={group.date} style={styles.dateGroup}>
            {/* Date header */}
            <View style={styles.dateHeader}>
              <Text style={[typography.label, { color: theme.textSecondary, flex: 1 }]}>
                {group.label}
              </Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>
                {group.tasks.length} 个任务
              </Text>
            </View>

            {/* Tasks */}
            <View style={styles.tasksList}>
              {group.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  theme={theme}
                  onToggle={toggleTask}
                  onDelete={handleDelete}
                  onToggleSubtask={toggleSubtask}
                />
              ))}
            </View>
          </View>
        ))}

        {groupedTasks.length === 0 && (
          <EmptyState
            theme={theme}
            icon={filter === 'completed' ? 'checkmark-done-outline' : 'calendar-outline'}
            title={filter === 'completed' ? '暂无已完成任务' : '暂无待完成任务'}
            subtitle={
              filter === 'completed' ? '完成任务后会显示在这里' : '点击右上角添加新任务'
            }
            actionLabel={filter !== 'completed' ? '添加任务' : undefined}
            onAction={filter !== 'completed' ? () => setShowAddModal(true) : undefined}
          />
        )}
      </ScrollView>

      {/* Add task bottom sheet */}
      <BottomSheet
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        theme={theme}
        title="新建任务"
      >
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="任务标题"
          placeholderTextColor={theme.textSecondary}
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          autoFocus
        />

        <Text style={[typography.label, { color: theme.text, marginBottom: 12 }]}>优先级</Text>
        <View style={styles.priorityRow}>
          {(['high', 'medium', 'low'] as Priority[]).map((p) => {
            const active = newTaskPriority === p
            const labels = { high: '高', medium: '中', low: '低' }
            const icons = { high: 'arrow-up', medium: 'remove', low: 'arrow-down' } as const

            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityPill,
                  {
                    backgroundColor: active ? theme.primary : theme.surfaceSecondary,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => setNewTaskPriority(p)}
              >
                <Ionicons
                  name={icons[p]}
                  size={18}
                  color={active ? 'white' : theme.textSecondary}
                />
                <Text
                  style={[
                    typography.caption,
                    {
                      color: active ? 'white' : theme.textSecondary,
                      fontWeight: '600',
                      marginTop: 4,
                    },
                  ]}
                >
                  {labels[p]}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* AI subtask generation */}
        {aiAvailable && newTaskTitle.trim().length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[typography.label, { color: theme.text }]}>子任务</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: theme.primary + '18' }}
                onPress={handleAISubtasks}
                disabled={aiSubLoading}
              >
                {aiSubLoading ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
                )}
                <Text style={[typography.small, { color: theme.primary, fontWeight: '600' }]}>AI 生成</Text>
              </TouchableOpacity>
            </View>
            {aiSubtasks.map((st, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: theme.surfaceSecondary, borderRadius: 8, marginBottom: 4 }}>
                <View style={{ width: 14, height: 14, borderRadius: 3, borderWidth: 1.5, borderColor: theme.border }} />
                <Text style={[typography.body, { color: theme.text, flex: 1 }]} numberOfLines={1}>{st}</Text>
                <TouchableOpacity onPress={() => setAiSubtasks(prev => prev.filter((_, idx) => idx !== i))}>
                  <Ionicons name="close" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: theme.primary }]}
          onPress={handleAddTask}
        >
          <Ionicons name="add-circle-outline" size={20} color="white" />
          <Text style={styles.submitBtnText}>创建任务</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* AI create task modal */}
      <BottomSheet
        visible={showAIModal}
        onClose={() => { setShowAIModal(false); setAiResult(null) }}
        theme={theme}
        title="AI 创建任务"
      >
        <TextInput
          style={[styles.input, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
          placeholder='用自然语言描述，如"明天下午复习算法2小时"'
          placeholderTextColor={theme.textSecondary}
          value={aiInput}
          onChangeText={setAiInput}
          multiline
        />
        {!aiResult && (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: aiLoading || !aiInput.trim() ? 0.5 : 1 }]}
            onPress={handleAIParse}
            disabled={aiLoading || !aiInput.trim()}
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="sparkles-outline" size={20} color="white" />
            )}
            <Text style={styles.submitBtnText}>AI 解析</Text>
          </TouchableOpacity>
        )}
        {aiResult && (
          <View style={{ gap: 12 }}>
            <View style={{ padding: 14, borderRadius: 12, backgroundColor: theme.surfaceSecondary, gap: 6 }}>
              <Text style={[typography.bodyMedium, { color: theme.text }]}>{aiResult.title}</Text>
              {aiResult.description ? (
                <Text style={[typography.small, { color: theme.textSecondary }]}>{aiResult.description}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {aiResult.dueDate ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: theme.card }}>
                    <Text style={[typography.small, { color: theme.textSecondary }]}>{aiResult.dueDate}</Text>
                  </View>
                ) : null}
                {aiResult.priority ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: aiResult.priority === 'high' ? '#FEE2E2' : aiResult.priority === 'medium' ? '#FEF3C7' : '#D1FAE5' }}>
                    <Text style={{ fontSize: 12, color: aiResult.priority === 'high' ? '#DC2626' : aiResult.priority === 'medium' ? '#D97706' : '#059669' }}>
                      {aiResult.priority === 'high' ? '高' : aiResult.priority === 'medium' ? '中' : '低'}优先级
                    </Text>
                  </View>
                ) : null}
                {aiResult.estimatedMinutes ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: theme.card }}>
                    <Text style={[typography.small, { color: theme.textSecondary }]}>{aiResult.estimatedMinutes}分钟</Text>
                  </View>
                ) : null}
              </View>
              {aiResult.subtasks && aiResult.subtasks.length > 0 && (
                <View style={{ marginTop: 4, gap: 3 }}>
                  {aiResult.subtasks.map((st, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 3, borderWidth: 1, borderColor: theme.border }} />
                      <Text style={[typography.small, { color: theme.textSecondary }]}>{st}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary, flex: 1 }]}
                onPress={handleAIConfirm}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                <Text style={styles.submitBtnText}>创建任务</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.surfaceSecondary, flex: 0 }]}
                onPress={() => { setAiResult(null); setAiInput('') }}
              >
                <Ionicons name="refresh-outline" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerStats: {
    marginTop: 8,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  filterWrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  tasksList: {
    gap: 0,
  },
  // Bottom sheet content
  input: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  priorityPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default TasksScreen
