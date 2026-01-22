import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native'
import { format, startOfWeek, addDays, isToday } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Ionicons } from '@expo/vector-icons'
import useStore from '../store/useStore'
import { getTheme } from '../theme/colors'

const habitIcons = ['🌅', '📚', '🏃', '💪', '🧘', '💧', '🍎', '😴', '✍️', '🎯']
const habitColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

const HabitsScreen = () => {
  const { habits, themeColor, addHabit, toggleHabitDate, deleteHabit } = useStore()
  const theme = getTheme(themeColor)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newHabitName, setNewHabitName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('🌅')
  const [selectedColor, setSelectedColor] = useState('#3B82F6')

  // 获取本周日期
  const weekDates = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [])

  const handleAddHabit = () => {
    if (!newHabitName.trim()) return
    
    addHabit({
      name: newHabitName.trim(),
      icon: selectedIcon,
      color: selectedColor,
      frequency: 'daily',
      customDays: [],
    })
    
    setNewHabitName('')
    setShowAddModal(false)
  }

  // 计算习惯的连续天数
  const getStreak = (records: Record<string, boolean>) => {
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const date = format(addDays(today, -i), 'yyyy-MM-dd')
      if (records[date]) {
        streak++
      } else if (i > 0) {
        break
      }
    }
    return streak
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 头部 */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>习惯打卡</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* 周日历 */}
      <View style={[styles.weekCalendar, { backgroundColor: theme.card }]}>
        {weekDates.map((date, index) => {
          const dateKey = format(date, 'yyyy-MM-dd')
          const dayIsToday = isToday(date)
          return (
            <View
              key={index}
              style={[
                styles.dayColumn,
                dayIsToday && { backgroundColor: `${theme.primary}20` },
              ]}
            >
              <Text style={[styles.dayName, { color: theme.textSecondary }]}>
                {format(date, 'EEE', { locale: zhCN })}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  { color: dayIsToday ? theme.primary : theme.text },
                  dayIsToday && { fontWeight: 'bold' },
                ]}
              >
                {format(date, 'd')}
              </Text>
            </View>
          )
        })}
      </View>

      {/* 习惯列表 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {habits.map(habit => {
          const streak = getStreak(habit.records)
          return (
            <View
              key={habit.id}
              style={[styles.habitCard, { backgroundColor: theme.card }]}
            >
              <View style={styles.habitHeader}>
                <View style={styles.habitInfo}>
                  <Text style={styles.habitIcon}>{habit.icon}</Text>
                  <View>
                    <Text style={[styles.habitName, { color: theme.text }]}>
                      {habit.name}
                    </Text>
                    {streak > 0 && (
                      <View style={styles.streakBadge}>
                        <Ionicons name="flame" size={12} color="#F59E0B" />
                        <Text style={styles.streakText}>连续 {streak} 天</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => deleteHabit(habit.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekChecks}>
                {weekDates.map((date, index) => {
                  const dateKey = format(date, 'yyyy-MM-dd')
                  const isChecked = habit.records[dateKey]
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.checkButton,
                        {
                          backgroundColor: isChecked ? habit.color : theme.background,
                          borderColor: isChecked ? habit.color : theme.border,
                        },
                      ]}
                      onPress={() => toggleHabitDate(habit.id, dateKey)}
                    >
                      {isChecked && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )
        })}

        {habits.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              还没有习惯，添加一个吧！
            </Text>
          </View>
        )}
      </ScrollView>

      {/* 添加习惯模态框 */}
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
                新建习惯
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
              placeholder="习惯名称"
              placeholderTextColor={theme.textSecondary}
              value={newHabitName}
              onChangeText={setNewHabitName}
            />

            <Text style={[styles.label, { color: theme.text }]}>选择图标</Text>
            <View style={styles.iconGrid}>
              {habitIcons.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconButton,
                    selectedIcon === icon && {
                      backgroundColor: `${theme.primary}20`,
                      borderColor: theme.primary,
                    },
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Text style={styles.iconText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: theme.text }]}>选择颜色</Text>
            <View style={styles.colorGrid}>
              {habitColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: theme.primary }]}
              onPress={handleAddHabit}
            >
              <Text style={styles.submitText}>创建习惯</Text>
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
  weekCalendar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  dayName: {
    fontSize: 12,
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  habitCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  habitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  habitIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '600',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  streakText: {
    fontSize: 12,
    color: '#F59E0B',
    marginLeft: 4,
  },
  deleteButton: {
    padding: 8,
  },
  weekChecks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  checkButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconText: {
    fontSize: 24,
  },
  colorGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
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

export default HabitsScreen
