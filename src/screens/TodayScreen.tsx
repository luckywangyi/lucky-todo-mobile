import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native'
import { format, isToday, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Ionicons } from '@expo/vector-icons'
import useStore from '../store/useStore'
import { getTheme } from '../theme/colors'
import { Task } from '../types'

// 任务卡片组件
const TaskCard = ({ task, onToggle }: { task: Task; onToggle: () => void }) => {
  const { themeColor } = useStore()
  const theme = getTheme(themeColor)
  
  const completedSubtasks = task.subtasks.filter(st => st.completed).length
  const totalSubtasks = task.subtasks.length
  const isCompleted = task.status === 'completed'
  
  const priorityColors = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981',
  }

  return (
    <TouchableOpacity
      style={[
        styles.taskCard,
        { 
          backgroundColor: theme.card,
          borderLeftColor: priorityColors[task.priority],
          opacity: isCompleted ? 0.6 : 1,
        },
      ]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.taskHeader}>
        <TouchableOpacity
          style={[
            styles.checkbox,
            isCompleted && { backgroundColor: theme.success, borderColor: theme.success },
          ]}
          onPress={onToggle}
        >
          {isCompleted && <Ionicons name="checkmark" size={16} color="white" />}
        </TouchableOpacity>
        <View style={styles.taskContent}>
          <Text
            style={[
              styles.taskTitle,
              { color: theme.text },
              isCompleted && styles.taskTitleCompleted,
            ]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
          {task.description && (
            <Text
              style={[styles.taskDescription, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {task.description}
            </Text>
          )}
        </View>
      </View>
      
      {totalSubtasks > 0 && (
        <View style={styles.subtaskProgress}>
          <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.primary,
                  width: `${(completedSubtasks / totalSubtasks) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.subtaskCount, { color: theme.textSecondary }]}>
            {completedSubtasks}/{totalSubtasks}
          </Text>
        </View>
      )}
      
      <View style={styles.taskTags}>
        {task.tags.slice(0, 2).map((tag, index) => (
          <View
            key={index}
            style={[styles.tag, { backgroundColor: `${theme.primary}20` }]}
          >
            <Text style={[styles.tagText, { color: theme.primary }]}>{tag}</Text>
          </View>
        ))}
        {task.estimatedMinutes && (
          <View style={[styles.timeTag, { backgroundColor: theme.border }]}>
            <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
            <Text style={[styles.timeText, { color: theme.textSecondary }]}>
              {task.estimatedMinutes}分钟
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

const TodayScreen = () => {
  const { tasks, themeColor, updateTask } = useStore()
  const theme = getTheme(themeColor)
  const today = format(new Date(), 'yyyy-MM-dd')

  const todayTasks = useMemo(() => {
    return tasks.filter(task => {
      return task.dueDate === today && task.status !== 'cancelled'
    })
  }, [tasks, today])

  const pendingTasks = todayTasks.filter(t => t.status !== 'completed')
  const completedTasks = todayTasks.filter(t => t.status === 'completed')

  const toggleTask = (task: Task) => {
    updateTask(task.id, {
      status: task.status === 'completed' ? 'pending' : 'completed',
    })
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.background} />
      
      {/* 头部 */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>
            今天
          </Text>
          <Text style={[styles.date, { color: theme.text }]}>
            {format(new Date(), 'M月d日 EEEE', { locale: zhCN })}
          </Text>
        </View>
        <View style={[styles.statsContainer, { backgroundColor: theme.primary }]}>
          <Text style={styles.statsNumber}>{pendingTasks.length}</Text>
          <Text style={styles.statsLabel}>待完成</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 待完成任务 */}
        {pendingTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              待完成 ({pendingTasks.length})
            </Text>
            {pendingTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task)}
              />
            ))}
          </View>
        )}

        {/* 已完成任务 */}
        {completedTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              已完成 ({completedTasks.length})
            </Text>
            {completedTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task)}
              />
            ))}
          </View>
        )}

        {/* 空状态 */}
        {todayTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="sunny-outline" size={64} color={theme.primary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              今天没有任务
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              享受美好的一天吧！
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
  },
  date: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  statsLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  taskCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  taskDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  subtaskProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginLeft: 36,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  subtaskCount: {
    fontSize: 12,
  },
  taskTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginLeft: 36,
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  timeText: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
  },
})

export default TodayScreen
