import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { impactLight, notificationSuccess } from '../lib/haptics'
import { crossAlert } from '../lib/alert'
import { format, parseISO, addDays, isToday, isTomorrow, isYesterday, isPast } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Ionicons } from '@expo/vector-icons'
import useStore from '../store/useStore'
import { getTheme, TASK_TITLE_COLOR } from '../theme/colors'
import { typography } from '../theme/typography'
import { Task, Priority } from '../types'
import TaskCard from '../components/TaskCard'
import FilterPills from '../components/FilterPills'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import { parseNaturalLanguage, generateSubtasks, isAIConfigured } from '../services/ai'
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

const priorityConfig = {
  high: { label: '高', icon: 'flag' as const, color: '#EF4444' },
  medium: { label: '中', icon: 'flag' as const, color: '#F59E0B' },
  low: { label: '低', icon: 'flag-outline' as const, color: '#10B981' },
}

const datePresets = [
  { key: 'today', label: '今天', offset: 0 },
  { key: 'tomorrow', label: '明天', offset: 1 },
  { key: 'next3', label: '3天后', offset: 3 },
  { key: 'nextWeek', label: '下周', offset: 7 },
]

const TasksScreen = () => {
  const { tasks, projects, themeColor, darkMode, addTask, updateTask, deleteTask, toggleSubtask } = useStore()
  const theme = getTheme(themeColor, darkMode)
  const projectColorMap = useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach(p => map.set(p.id, p.color))
    return map
  }, [projects])

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [searchQuery, setSearchQuery] = useState('')

  // Create form states
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium')
  const [newTaskDate, setNewTaskDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [subtasksList, setSubtasksList] = useState<string[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [showDateOptions, setShowDateOptions] = useState(false)
  const [showPriorityOptions, setShowPriorityOptions] = useState(false)

  // AI states
  const [aiAvailable, setAiAvailable] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => { isAIConfigured().then(setAiAvailable) }, [])

  // Sync
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    impactLight()
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

  const resetForm = () => {
    setNewTaskTitle('')
    setNewTaskDesc('')
    setNewTaskPriority('medium')
    setNewTaskDate(format(new Date(), 'yyyy-MM-dd'))
    setSubtasksList([])
    setNewSubtaskTitle('')
    setShowDateOptions(false)
    setShowPriorityOptions(false)
    setShowAddModal(false)
  }

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return
    addTask({
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || undefined,
      dueDate: newTaskDate,
      priority: newTaskPriority,
      tags: [],
      subtasks: subtasksList.map((st, i) => ({
        id: `subtask-${Date.now()}-${i}`,
        title: st,
        completed: false,
      })),
      status: 'pending',
    })
    impactLight()
    resetForm()
  }

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return
    setSubtasksList(prev => [...prev, newSubtaskTitle.trim()])
    setNewSubtaskTitle('')
  }

  const handleAI = async () => {
    if (!newTaskTitle.trim() || aiLoading) return
    setAiLoading(true)
    impactLight()
    try {
      const todayISO = format(new Date(), 'yyyy-MM-dd')
      const [parsed, subs] = await Promise.all([
        parseNaturalLanguage(newTaskTitle.trim(), todayISO),
        generateSubtasks(newTaskTitle.trim(), newTaskDesc.trim()),
      ])

      if (parsed.priority) setNewTaskPriority(parsed.priority)
      if (parsed.dueDate) setNewTaskDate(parsed.dueDate)
      if (parsed.description && !newTaskDesc.trim()) setNewTaskDesc(parsed.description)

      const newSubs = subs.map(s => s.title).filter(t => !subtasksList.includes(t))
      if (newSubs.length > 0) setSubtasksList(prev => [...prev, ...newSubs])
    } catch (err: any) {
      crossAlert('AI 处理失败', err?.message || '请重试')
    }
    setAiLoading(false)
  }

  const getDateLabel = (dateStr: string) => {
    const d = parseISO(dateStr)
    if (isToday(d)) return '今天'
    if (isTomorrow(d)) return '明天'
    return format(d, 'M月d日', { locale: zhCN })
  }

  // Group tasks by date
  const groupedTasks = useMemo(() => {
    let filteredTasks = [...tasks]
    if (filter === 'pending') {
      filteredTasks = filteredTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    } else if (filter === 'completed') {
      filteredTasks = filteredTasks.filter(t => t.status === 'completed')
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      filteredTasks = filteredTasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        (t.tags ?? []).some(tag => tag.toLowerCase().includes(q)) ||
        (t.subtasks ?? []).some(s => s.title.toLowerCase().includes(q))
      )
    }

    const groups: { [key: string]: Task[] } = {}
    filteredTasks.forEach(task => {
      const date = task.dueDate
      if (!groups[date]) groups[date] = []
      groups[date].push(task)
    })

    return Object.entries(groups)
      .map(([date, tasks]) => {
        const dateObj = parseISO(date)
        let label = format(dateObj, 'M月d日 EEEE', { locale: zhCN })
        if (isToday(dateObj)) label = '今天 · ' + format(dateObj, 'M月d日', { locale: zhCN })
        else if (isTomorrow(dateObj)) label = '明天 · ' + format(dateObj, 'M月d日', { locale: zhCN })
        else if (isYesterday(dateObj)) label = '昨天 · ' + format(dateObj, 'M月d日', { locale: zhCN })
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
  }, [tasks, filter, searchQuery])

  const toggleTask = (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    if (newStatus === 'completed') notificationSuccess()
    else impactLight()
    updateTask(task.id, { status: newStatus })
  }

  const handleDelete = (task: Task) => {
    crossAlert('确认删除', `确定要删除任务「${task.title}」吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deleteTask(task.id) },
    ])
  }

  const stats = useMemo(() => {
    const pending = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length
    const completed = tasks.filter(t => t.status === 'completed').length
    return { pending, completed }
  }, [tasks])

  const pCfg = priorityConfig[newTaskPriority]

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.heading1, { color: theme.text }]}>全部任务</Text>
            <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 8 }]}>
              {stats.pending} 待完成 · {stats.completed} 已完成
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={[styles.searchBar, { backgroundColor: theme.surfaceSecondary }]}>
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

      <FilterPills theme={theme} options={filterOptions} selected={filter} onSelect={setFilter} />

      {/* Task list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
      >
        {groupedTasks.map(group => (
          <View key={group.date} style={styles.dateGroup}>
            <View style={styles.dateHeader}>
              <Text style={[typography.label, { color: theme.textSecondary, flex: 1 }]}>{group.label}</Text>
              <Text style={[typography.caption, { color: theme.textSecondary }]}>{group.tasks.length} 个任务</Text>
            </View>
            <View style={styles.tasksList}>
              {group.tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  theme={theme}
                  onToggle={toggleTask}
                  onDelete={handleDelete}
                  onToggleSubtask={toggleSubtask}
                  projectColor={task.projectId ? projectColorMap.get(task.projectId) : undefined}
                />
              ))}
            </View>
          </View>
        ))}
        {groupedTasks.length === 0 && (
          <EmptyState
            theme={theme}
            icon={filter === 'completed' ? 'checkmark-done-outline' : 'calendar-outline'}
            title={filter === 'completed' ? '暂无已完成任务' : filter === 'all' ? '还没有任务' : '暂无待完成任务'}
            subtitle={filter === 'completed' ? '完成任务后会显示在这里' : searchQuery.trim() ? '没有匹配的任务' : '点击右上角添加新任务'}
            actionLabel={filter !== 'completed' && !searchQuery.trim() ? '添加任务' : undefined}
            onAction={filter !== 'completed' && !searchQuery.trim() ? () => setShowAddModal(true) : undefined}
          />
        )}
      </ScrollView>

      {/* ======== Redesigned Create Task BottomSheet ======== */}
      <BottomSheet visible={showAddModal} onClose={resetForm} theme={theme} title="新建任务">
        {/* Title */}
        <TextInput
          style={[styles.formTitle, { color: theme.text }]}
          placeholder="任务标题"
          placeholderTextColor={theme.textSecondary}
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          autoFocus
        />

        {/* Description */}
        <TextInput
          style={[styles.formDesc, { color: theme.textSecondary }]}
          placeholder="描述"
          placeholderTextColor={theme.textSecondary + '80'}
          value={newTaskDesc}
          onChangeText={setNewTaskDesc}
          multiline
        />

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            {/* Date pill */}
            <TouchableOpacity
              style={[styles.toolPill, { backgroundColor: theme.surfaceSecondary }]}
              onPress={() => { setShowDateOptions(!showDateOptions); setShowPriorityOptions(false) }}
            >
              <Ionicons name="calendar-outline" size={14} color={theme.primary} />
              <Text style={[styles.toolPillText, { color: theme.primary }]}>{getDateLabel(newTaskDate)}</Text>
            </TouchableOpacity>

            {/* Priority pill */}
            <TouchableOpacity
              style={[styles.toolPill, { backgroundColor: theme.surfaceSecondary }]}
              onPress={() => { setShowPriorityOptions(!showPriorityOptions); setShowDateOptions(false) }}
            >
              <Ionicons name={pCfg.icon} size={14} color={pCfg.color} />
              <Text style={[styles.toolPillText, { color: pCfg.color }]}>P{pCfg.label}</Text>
            </TouchableOpacity>
          </View>

          {/* AI button */}
          {aiAvailable && (
            <TouchableOpacity
              style={[styles.aiButton, { backgroundColor: theme.primary + '12' }]}
              onPress={handleAI}
              disabled={aiLoading || !newTaskTitle.trim()}
              activeOpacity={0.7}
            >
              {aiLoading ? (
                <ActivityIndicator size={14} color={theme.primary} />
              ) : (
                <Ionicons name="sparkles" size={14} color={theme.primary} />
              )}
              <Text style={[styles.toolPillText, { color: theme.primary, fontWeight: '600' }]}>AI</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Date options dropdown */}
        {showDateOptions && (
          <View style={[styles.optionsRow, { backgroundColor: theme.surfaceSecondary }]}>
            {datePresets.map(d => {
              const dateVal = format(addDays(new Date(), d.offset), 'yyyy-MM-dd')
              const active = newTaskDate === dateVal
              return (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.optionChip, active && { backgroundColor: theme.primary }]}
                  onPress={() => { setNewTaskDate(dateVal); setShowDateOptions(false) }}
                >
                  <Text style={[styles.optionChipText, { color: active ? '#fff' : theme.text }]}>{d.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* Priority options dropdown */}
        {showPriorityOptions && (
          <View style={[styles.optionsRow, { backgroundColor: theme.surfaceSecondary }]}>
            {(['high', 'medium', 'low'] as Priority[]).map(p => {
              const cfg = priorityConfig[p]
              const active = newTaskPriority === p
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.optionChip, active && { backgroundColor: cfg.color }]}
                  onPress={() => { setNewTaskPriority(p); setShowPriorityOptions(false) }}
                >
                  <Ionicons name={cfg.icon} size={13} color={active ? '#fff' : cfg.color} />
                  <Text style={[styles.optionChipText, { color: active ? '#fff' : cfg.color }]}>{cfg.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}

        {/* Subtasks area */}
        {(subtasksList.length > 0 || newTaskTitle.trim().length > 0) && (
          <View style={styles.subtasksArea}>
            {subtasksList.map((st, i) => (
              <View key={i} style={[styles.subtaskItem, { backgroundColor: theme.surfaceSecondary }]}>
                <View style={[styles.subtaskCheck, { borderColor: theme.border }]} />
                <Text style={[typography.body, { color: TASK_TITLE_COLOR, flex: 1 }]} numberOfLines={1}>{st}</Text>
                <TouchableOpacity
                  onPress={() => setSubtasksList(prev => prev.filter((_, idx) => idx !== i))}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close" size={15} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={[styles.subtaskAddRow, { borderColor: theme.border }]}>
              <Ionicons name="add" size={16} color={theme.textSecondary} />
              <TextInput
                style={[styles.subtaskInput, { color: theme.text }]}
                placeholder="添加子任务"
                placeholderTextColor={theme.textSecondary + '80'}
                value={newSubtaskTitle}
                onChangeText={setNewSubtaskTitle}
                onSubmitEditing={handleAddSubtask}
                returnKeyType="done"
              />
            </View>
          </View>
        )}

        {/* Bottom action bar */}
        <View style={styles.formActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
            <Text style={[typography.bodyMedium, { color: theme.textSecondary }]}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addTaskBtn, { backgroundColor: theme.primary, opacity: newTaskTitle.trim() ? 1 : 0.4 }]}
            onPress={handleAddTask}
            disabled={!newTaskTitle.trim()}
          >
            <Text style={styles.addTaskBtnText}>添加任务</Text>
          </TouchableOpacity>
        </View>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
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

  // Create form
  formTitle: {
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 4,
    marginBottom: 4,
  },
  formDesc: {
    fontSize: 14,
    paddingVertical: 4,
    marginBottom: 14,
    minHeight: 20,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toolbarLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  toolPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toolPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  // Options dropdown
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Subtasks
  subtasksArea: {
    marginBottom: 16,
    gap: 4,
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  subtaskCheck: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  subtaskAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subtaskInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },

  // Actions
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addTaskBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addTaskBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
})

export default TasksScreen
