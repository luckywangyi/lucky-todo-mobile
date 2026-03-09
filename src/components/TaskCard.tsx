import React, { useState, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { ThemeColors } from '../theme/colors'
import { Task } from '../types'
import Checkbox from './Checkbox'
import { typography } from '../theme/typography'

const priorityColors = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
}

interface TaskCardProps {
  task: Task
  theme: ThemeColors
  onToggle: (task: Task) => void
  onDelete: (task: Task) => void
  onToggleSubtask?: (taskId: string, subtaskId: string) => void
  onLongPress?: (task: Task) => void
  hint?: string
}

const SWIPE_THRESHOLD = 80

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  theme,
  onToggle,
  onDelete,
  onToggleSubtask,
  onLongPress,
  hint,
}) => {
  const [expanded, setExpanded] = useState(false)
  const isCompleted = task.status === 'completed'
  const completedSubtasks = task.subtasks.filter((st) => st.completed).length
  const totalSubtasks = task.subtasks.length

  const translateX = useRef(new Animated.Value(0)).current
  const callbacksRef = useRef({ onDelete, onToggle, task })
  callbacksRef.current = { onDelete, onToggle, task }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gs) =>
        Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
      onPanResponderMove: (_e, gs) => {
        translateX.setValue(gs.dx)
      },
      onPanResponderRelease: (_e, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          Animated.timing(translateX, { toValue: -200, duration: 200, useNativeDriver: true }).start(() => {
            callbacksRef.current.onDelete(callbacksRef.current.task)
            translateX.setValue(0)
          })
        } else if (gs.dx > SWIPE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          Animated.timing(translateX, { toValue: 200, duration: 200, useNativeDriver: true }).start(() => {
            callbacksRef.current.onToggle(callbacksRef.current.task)
            translateX.setValue(0)
          })
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
        }
      },
    })
  ).current

  return (
    <View style={{ overflow: 'hidden', borderRadius: 16, marginBottom: 10 }}>
      {/* Background actions */}
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={[styles.swipeAction, { backgroundColor: theme.success, justifyContent: 'flex-start', paddingLeft: 20 }]}>
            <Ionicons name={isCompleted ? 'arrow-undo' : 'checkmark-circle'} size={22} color="#fff" />
            <Text style={styles.swipeText}>{isCompleted ? '恢复' : '完成'}</Text>
          </View>
          <View style={[styles.swipeAction, { backgroundColor: theme.error, justifyContent: 'flex-end', paddingRight: 20 }]}>
            <Text style={styles.swipeText}>删除</Text>
            <Ionicons name="trash" size={22} color="#fff" />
          </View>
        </View>
      </View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
            },
          ]}
          onPress={() => totalSubtasks > 0 && setExpanded(!expanded)}
          onLongPress={() => onLongPress?.(task)}
          delayLongPress={300}
        >
          <View style={[styles.priorityBar, { backgroundColor: priorityColors[task.priority], opacity: isCompleted ? 0.5 : 1 }]} />
          <View style={[styles.content, isCompleted && { opacity: 0.6 }]}>
            <View style={styles.headerRow}>
              <Checkbox
                checked={isCompleted}
                onPress={() => onToggle(task)}
                theme={theme}
              />
              <View style={styles.info}>
                <Text
                  style={[
                    typography.bodyMedium,
                    { color: theme.text },
                    isCompleted && styles.titleCompleted,
                  ]}
                  numberOfLines={2}
                >
                  {task.title}
                </Text>
                {hint && !isCompleted && (
                  <Text style={[typography.small, { color: theme.textSecondary, marginTop: 2 }]}>
                    {hint}
                  </Text>
                )}
                {(task.postponeCount || 0) >= 3 && !isCompleted && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <Ionicons name="alert-circle" size={12} color={theme.warning} />
                    <Text style={{ fontSize: 10, color: theme.warning }}>
                      已推迟 {task.postponeCount} 次
                    </Text>
                  </View>
                )}
                {totalSubtasks > 0 && (
                  <View style={styles.progressRow}>
                    <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
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
                    <Text style={[typography.small, { color: theme.textSecondary }]}>
                      {completedSubtasks}/{totalSubtasks}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.actions}>
                {totalSubtasks > 0 && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setExpanded(!expanded)}
                  >
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete(task)}>
                  <Ionicons name="trash-outline" size={16} color={theme.error} />
                </TouchableOpacity>
              </View>
            </View>

            {expanded && totalSubtasks > 0 && (
              <View style={[styles.subtasks, { borderTopColor: theme.border }]}>
                {task.subtasks.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    style={styles.subtaskRow}
                    onPress={() => onToggleSubtask?.(task.id, sub.id)}
                  >
                    <Checkbox
                      checked={sub.completed}
                      onPress={() => onToggleSubtask?.(task.id, sub.id)}
                      theme={theme}
                      size="small"
                    />
                    <Text
                      style={[
                        typography.caption,
                        { color: theme.textSecondary, flex: 1, marginLeft: 8 },
                        sub.completed && styles.subtaskCompleted,
                      ]}
                      numberOfLines={2}
                    >
                      {sub.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {task.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {task.tags.slice(0, 3).map((tag, idx) => (
                  <View key={idx} style={[styles.tag, { backgroundColor: `${theme.primary}10` }]}>
                    <Text style={[typography.small, { color: theme.primary, fontWeight: '500' }]}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  priorityBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  info: {
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 6,
  },
  subtasks: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  subtaskCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  swipeAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swipeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
})

export default TaskCard
