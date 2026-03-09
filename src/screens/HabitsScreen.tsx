import React, { useState, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { impactLight, notificationSuccess } from '../lib/haptics'
import { format, startOfWeek, addDays, addWeeks, isToday, isFuture, startOfDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const DAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
import { Ionicons } from '@expo/vector-icons'
import useStore from '../store/useStore'
import { getTheme } from '../theme/colors'
import { typography } from '../theme/typography'
import Card from '../components/Card'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import { isAIConfigured, generateHabitInsights, type HabitInsight } from '../services/ai'
import { crossAlert } from '../lib/alert'

const habitIcons = ['🌅', '📚', '🏃', '💪', '🧘', '💧', '🍎', '😴', '✍️', '🎯']
const habitColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

const HabitsScreen = () => {
  const { habits, themeColor, darkMode, addHabit, toggleHabitDate, deleteHabit } = useStore()
  const theme = getTheme(themeColor, darkMode)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newHabitName, setNewHabitName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('🌅')
  const [selectedColor, setSelectedColor] = useState('#3B82F6')

  const [aiAvailable, setAiAvailable] = useState(false)
  const [habitInsight, setHabitInsight] = useState<HabitInsight | null>(null)
  const [habitInsightLoading, setHabitInsightLoading] = useState(false)
  const [showInsight, setShowInsight] = useState(false)
  useEffect(() => { isAIConfigured().then(setAiAvailable) }, [])

  const handleHabitInsights = async () => {
    if (habitInsightLoading || habits.length === 0) return
    setHabitInsightLoading(true)
    try {
      const result = await generateHabitInsights(
        habits.map(h => ({ name: h.name, icon: h.icon, records: h.records, frequency: h.frequency }))
      )
      setHabitInsight(result)
      setShowInsight(true)
    } catch (err: any) {
      crossAlert('分析失败', err?.message || '请重试')
    }
    setHabitInsightLoading(false)
  }
  const [weekOffset, setWeekOffset] = useState(0)

  // Week dates
  const weekDates = useMemo(() => {
    const baseDate = addWeeks(new Date(), weekOffset)
    const start = startOfWeek(baseDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [weekOffset])

  const isCurrentWeek = weekOffset === 0
  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return '本周'
    if (weekOffset === 1) return '下周'
    if (weekOffset === -1) return '上周'
    if (weekOffset > 0) return `${weekOffset}周后`
    return `${Math.abs(weekOffset)}周前`
  }, [weekOffset])

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

  // Streak calculator
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

  // Week completion rate for a habit
  const getWeekRate = (records: Record<string, boolean>) => {
    let done = 0
    weekDates.forEach((d) => {
      if (records[format(d, 'yyyy-MM-dd')]) done++
    })
    return Math.round((done / 7) * 100)
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View>
          <Text style={[typography.heading1, { color: theme.text }]}>习惯打卡</Text>
          <Text style={[typography.caption, { color: theme.textSecondary, marginTop: 4 }]}>
            {habits.length} 个习惯
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {aiAvailable && habits.length > 0 && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.card, borderWidth: 1.5, borderColor: theme.primary }]}
              onPress={handleHabitInsights}
              disabled={habitInsightLoading}
            >
              {habitInsightLoading ? (
                <ActivityIndicator size={16} color={theme.primary} />
              ) : (
                <Ionicons name="sparkles" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.primary }]}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Week calendar */}
      <Card theme={theme} style={styles.weekCard}>
        {/* Week nav */}
        <View style={styles.weekNav}>
          <TouchableOpacity
            style={[styles.weekNavBtn, { backgroundColor: `${theme.primary}10` }]}
            onPress={() => setWeekOffset(weekOffset - 1)}
          >
            <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setWeekOffset(0)}>
            <Text
              style={[
                typography.label,
                { color: isCurrentWeek ? theme.primary : theme.text },
              ]}
            >
              {weekLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.weekNavBtn, { backgroundColor: `${theme.primary}10` }]}
            onPress={() => setWeekOffset(weekOffset + 1)}
          >
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Days */}
        <View style={styles.daysRow}>
          {weekDates.map((date, index) => {
            const dayIsToday = isToday(date)
            const dateKey = format(date, 'yyyy-MM-dd')
            const hasRecord = habits.some((h) => h.records[dateKey])

            return (
              <View key={index} style={styles.dayCol}>
                <Text style={[styles.dayLabel, { color: dayIsToday ? theme.primary : theme.textSecondary }]}>
                  {DAY_LABELS[index]}
                </Text>
                <View style={styles.dayCircle}>
                  {dayIsToday && (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.primary, borderRadius: 16, overflow: 'hidden' }]} />
                  )}
                  <Text
                    style={[
                      styles.dayNum,
                      {
                        color: dayIsToday ? '#fff' : theme.text,
                        fontWeight: dayIsToday ? '700' : '600',
                      },
                    ]}
                  >
                    {format(date, 'd')}
                  </Text>
                </View>
                {hasRecord && (
                  <View style={[styles.dayDot, { backgroundColor: dayIsToday ? theme.primary + '60' : theme.primary }]} />
                )}
              </View>
            )
          })}
        </View>
      </Card>

      {/* Habits list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {habits.map((habit) => {
          const streak = getStreak(habit.records)
          const weekRate = getWeekRate(habit.records)

          return (
            <Card key={habit.id} theme={theme} style={styles.habitCard}>
              <View style={styles.habitHeader}>
                <View style={styles.habitLeft}>
                  <View style={[styles.habitIconBg, { backgroundColor: `${habit.color}15` }]}>
                    <Text style={styles.habitIconText}>{habit.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: theme.text }]}>
                      {habit.name}
                    </Text>
                    {streak > 0 && (
                      <View style={[styles.streakBadge, { backgroundColor: theme.primary }]}>
                        <Ionicons name="flame" size={11} color="white" />
                        <Text style={styles.streakText}>连续 {streak} 天</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => deleteHabit(habit.id)}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={17} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Week progress bar */}
              <View style={styles.weekProgressRow}>
                <View style={[styles.weekProgressTrack, { backgroundColor: theme.surfaceSecondary }]}>
                  <View
                    style={[
                      styles.weekProgressFill,
                      { backgroundColor: habit.color, width: `${weekRate}%` },
                    ]}
                  />
                </View>
                <Text style={[typography.small, { color: theme.textSecondary }]}>
                  {weekRate}%
                </Text>
              </View>

              {/* Check buttons */}
              <View style={styles.checksRow}>
                {weekDates.map((date, index) => {
                  const dateKey = format(date, 'yyyy-MM-dd')
                  const isChecked = habit.records[dateKey]
                  const isFutureDate = isFuture(startOfDay(date))
                  return (
                    <TouchableOpacity
                      key={index}
                      disabled={isFutureDate}
                      style={[
                        styles.checkBtn,
                        {
                          backgroundColor: isChecked ? theme.primary : theme.surfaceSecondary,
                          borderColor: isChecked ? theme.primary : theme.border,
                          opacity: isFutureDate ? 0.3 : 1,
                        },
                      ]}
                      onPress={() => {
                        const wasChecked = habit.records[dateKey]
                        if (!wasChecked) notificationSuccess()
                        else impactLight()
                        toggleHabitDate(habit.id, dateKey)
                      }}
                    >
                      {isChecked && <Ionicons name="checkmark" size={18} color="white" />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            </Card>
          )
        })}

        {habits.length === 0 && (
          <EmptyState
            theme={theme}
            icon="fitness-outline"
            title="还没有习惯"
            subtitle="添加一个习惯，开始每日打卡吧!"
            actionLabel="添加习惯"
            onAction={() => setShowAddModal(true)}
          />
        )}
      </ScrollView>

      {/* Add habit bottom sheet */}
      <BottomSheet
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        theme={theme}
        title="新建习惯"
      >
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="习惯名称"
          placeholderTextColor={theme.textSecondary}
          value={newHabitName}
          onChangeText={setNewHabitName}
          autoFocus
        />

        <Text style={[typography.label, { color: theme.text, marginBottom: 12 }]}>选择图标</Text>
        <View style={styles.iconGrid}>
          {habitIcons.map((icon) => (
            <TouchableOpacity
              key={icon}
              style={[
                styles.iconBtn,
                {
                  backgroundColor:
                    selectedIcon === icon ? `${theme.primary}10` : theme.surfaceSecondary,
                  borderColor: selectedIcon === icon ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setSelectedIcon(icon)}
            >
              <Text style={styles.iconBtnText}>{icon}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[typography.label, { color: theme.text, marginBottom: 12 }]}>选择颜色</Text>
        <View style={styles.colorGrid}>
          {habitColors.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorBtn,
                { backgroundColor: color },
                selectedColor === color && { borderWidth: 3, borderColor: theme.primary },
              ]}
              onPress={() => setSelectedColor(color)}
            >
              {selectedColor === color && (
                <Ionicons name="checkmark" size={18} color="white" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: theme.primary }]}
          onPress={handleAddHabit}
        >
          <Ionicons name="add-circle-outline" size={20} color="white" />
          <Text style={styles.submitBtnText}>创建习惯</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Habit Insights */}
      <BottomSheet
        visible={showInsight && !!habitInsight}
        onClose={() => setShowInsight(false)}
        theme={theme}
        title="AI 习惯分析"
      >
        {habitInsight && (
          <View style={{ gap: 14 }}>
            <Text style={[typography.body, { color: theme.text, lineHeight: 20 }]}>{habitInsight.summary}</Text>
            <View style={{ backgroundColor: theme.surfaceSecondary, borderRadius: 8, padding: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text, marginBottom: 4 }}>连续打卡分析</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18 }}>{habitInsight.streakAnalysis}</Text>
            </View>
            <View style={{ backgroundColor: theme.surfaceSecondary, borderRadius: 8, padding: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text, marginBottom: 4 }}>最佳坚持日</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary }}>{habitInsight.bestDay}</Text>
            </View>
            {habitInsight.suggestions.length > 0 && (
              <View>
                <Text style={[typography.label, { color: theme.text, marginBottom: 6 }]}>改进建议</Text>
                {habitInsight.suggestions.map((s, i) => (
                  <Text key={i} style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 3 }}>· {s}</Text>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 13, color: theme.primary, fontStyle: 'italic', textAlign: 'center', marginTop: 4 }}>
              {habitInsight.encouragement}
            </Text>
          </View>
        )}
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  weekCard: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  weekNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  weekNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 4,
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 13,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  habitCard: {
    marginBottom: 12,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  habitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  habitIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitIconText: {
    fontSize: 24,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  streakText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 8,
  },
  weekProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  weekProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  weekProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  checksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  checkBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bottom sheet content
  input: {
    padding: 16,
    borderRadius: 14,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  iconBtnText: {
    fontSize: 26,
  },
  colorGrid: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  colorBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 14,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})

export default HabitsScreen
