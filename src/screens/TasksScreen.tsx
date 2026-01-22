import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native'
import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Ionicons } from '@expo/vector-icons'
import useStore from '../store/useStore'
import { getTheme } from '../theme/colors'
import { Task, Priority } from '../types'

const TasksScreen = () => {
  const { tasks, themeColor, addTask, updateTask, deleteTask } = useStore()
  const theme = getTheme(themeColor)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('medium')
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')

  const filteredTasks = useMemo(() => {
    let result = [...tasks]
    if (filter === 'pending') {
      result = result.filter(t => t.status !== 'completed')
    } else if (filter === 'completed') {
      result = result.filter(t => t.status === 'completed')
    }
    return result.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [tasks, filter])

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return
    
    addTask({
      title: newTaskTitle.trim(),
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      priority: newTaskPriority,
      tags: [],
      subtasks: [],
      status: 'pending',
    })
    
    setNewTaskTitle('')
    setShowAddModal(false)
  }

  const toggleTask = (task: Task) => {
    updateTask(task.id, {
      status: task.status === 'completed' ? 'pending' : 'completed',
    })
  }

  const priorityColors = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981',
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 头部 */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>全部任务</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* 筛选器 */}
      <View style={styles.filterContainer}>
        {(['all', 'pending', 'completed'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterButton,
              filter === f && { backgroundColor: theme.primary },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f ? 'white' : theme.textSecondary },
              ]}
            >
              {f === 'all' ? '全部' : f === 'pending' ? '待完成' : '已完成'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 任务列表 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredTasks.map(task => (
          <TouchableOpacity
            key={task.id}
            style={[
              styles.taskItem,
              { 
                backgroundColor: theme.card,
                borderLeftColor: priorityColors[task.priority],
              },
            ]}
            onPress={() => toggleTask(task)}
            onLongPress={() => deleteTask(task.id)}
          >
            <View
              style={[
                styles.checkbox,
                task.status === 'completed' && {
                  backgroundColor: theme.success,
                  borderColor: theme.success,
                },
              ]}
            >
              {task.status === 'completed' && (
                <Ionicons name="checkmark" size={14} color="white" />
              )}
            </View>
            <View style={styles.taskContent}>
              <Text
                style={[
                  styles.taskTitle,
                  { color: theme.text },
                  task.status === 'completed' && styles.taskCompleted,
                ]}
                numberOfLines={1}
              >
                {task.title}
              </Text>
              <Text style={[styles.taskDate, { color: theme.textSecondary }]}>
                {format(parseISO(task.dueDate), 'M月d日', { locale: zhCN })}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {filteredTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              暂无任务
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 添加任务模态框 */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                新建任务
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: theme.background,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="任务标题"
              placeholderTextColor={theme.textSecondary}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />

            <Text style={[styles.label, { color: theme.text }]}>优先级</Text>
            <View style={styles.priorityContainer}>
              {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityButton,
                    {
                      backgroundColor:
                        newTaskPriority === p
                          ? priorityColors[p]
                          : theme.background,
                      borderColor: priorityColors[p],
                    },
                  ]}
                  onPress={() => setNewTaskPriority(p)}
                >
                  <Text
                    style={{
                      color: newTaskPriority === p ? 'white' : priorityColors[p],
                      fontWeight: '600',
                    }}
                  >
                    {p === 'high' ? '高' : p === 'medium' ? '中' : '低'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: theme.primary }]}
              onPress={handleAddTask}
            >
              <Text style={styles.submitText}>创建任务</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
    fontSize: 15,
    fontWeight: '500',
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  taskDate: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  input: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default TasksScreen
