import React, { useMemo, useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { format } from 'date-fns'
import { Ionicons } from '@expo/vector-icons'
import useStore from '../store/useStore'
import { getTheme, themes } from '../theme/colors'
import { typography } from '../theme/typography'
import { ThemeColor } from '../types'
import { supabase, isSupabaseConfigured, signOut } from '../lib/supabase'
import { syncWithCloud, downloadOnly, uploadOnly } from '../lib/cloudSync'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import Card from '../components/Card'
import ProgressRing from '../components/ProgressRing'
import { getAIConfig, saveAIConfig, testConnection, AI_PRESETS, type AIConfig } from '../services/ai'
import { crossAlert } from '../lib/alert'
import {
  saveCookie,
  getCookie,
  saveSemesterStart,
  getSemesterStart,
  fetchCourseSchedule,
  parseManualJson,
  saveCourses,
  clearCourses as clearCourseStorage,
} from '../services/courseSchedule'

WebBrowser.maybeCompleteAuthSession()

const themeOptions: { id: ThemeColor; name: string; emoji: string }[] = [
  { id: 'ocean', name: '海洋', emoji: '🌊' },
  { id: 'forest', name: '森林', emoji: '🌲' },
  { id: 'lavender', name: '薰衣草', emoji: '💜' },
  { id: 'sunset', name: '日落', emoji: '🌅' },
  { id: 'rose', name: '玫瑰', emoji: '🌹' },
  { id: 'slate', name: '石板', emoji: '🌫️' },
]

// Settings list item - clean, minimal
const SettingsItem = ({
  icon,
  label,
  sublabel,
  onPress,
  theme,
  danger,
  disabled,
  showBorder = true,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  sublabel?: string
  onPress: () => void
  theme: ReturnType<typeof getTheme>
  danger?: boolean
  disabled?: boolean
  showBorder?: boolean
}) => (
  <TouchableOpacity
    style={[
      styles.settingsItem,
      disabled && { opacity: 0.6 },
      showBorder && { borderBottomWidth: 1, borderBottomColor: theme.border },
    ]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.6}
  >
    <View style={styles.settingsIconWrap}>
      <Ionicons
        name={icon}
        size={20}
        color={danger ? theme.error : theme.textSecondary}
      />
    </View>
    <View style={{ flex: 1 }}>
      <Text
        style={[
          typography.bodyMedium,
          { color: danger ? theme.error : theme.text },
        ]}
      >
        {label}
      </Text>
      {sublabel && (
        <Text style={[typography.small, { color: theme.textSecondary, marginTop: 1 }]}>
          {sublabel}
        </Text>
      )}
    </View>
    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
  </TouchableOpacity>
)

const ProfileScreen = () => {
  const {
    themeColor,
    darkMode,
    setThemeColor,
    setDarkMode,
    user,
    setUser,
    tasks,
    timeSlots,
    projects,
    habits,
    courses,
    semesterStart,
    setCourses,
    clearCourses: clearCoursesInStore,
    setSemesterStart,
    setSyncData,
    profileName,
    profileAvatar,
    setProfileName,
    setProfileAvatar,
  } = useStore()
  const theme = getTheme(themeColor, darkMode)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const lastAutoSyncUserId = useRef<string | null>(null)

  // Profile editing
  const [showNameEdit, setShowNameEdit] = useState(false)
  const [editingName, setEditingName] = useState('')

  // AI settings
  const [aiConfig, setAiConfig] = useState<AIConfig>({ endpoint: '', apiKey: '', model: '' })
  const [showApiKey, setShowApiKey] = useState(false)
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [showAISettings, setShowAISettings] = useState(false)
  const [activePreset, setActivePreset] = useState('dashscope')

  // Course schedule settings
  const [showCourseSettings, setShowCourseSettings] = useState(false)
  const [hubCookie, setHubCookie] = useState('')
  const [semesterStartInput, setSemesterStartInput] = useState('')
  const [courseImporting, setCourseImporting] = useState(false)
  const [manualJsonInput, setManualJsonInput] = useState('')
  const [showManualImport, setShowManualImport] = useState(false)

  useEffect(() => {
    getAIConfig().then(cfg => {
      setAiConfig(cfg)
      const matched = AI_PRESETS.find(p => p.id !== 'custom' && p.endpoint && cfg.endpoint === p.endpoint)
      setActivePreset(matched?.id || (cfg.endpoint ? 'custom' : 'dashscope'))
    })
    getCookie().then(c => c && setHubCookie(c))
    getSemesterStart().then(d => d && setSemesterStartInput(d))
  }, [])

  const handleAIConfigChange = (field: keyof AIConfig, value: string) => {
    const newConfig = { ...aiConfig, [field]: value }
    setAiConfig(newConfig)
    saveAIConfig(newConfig)
  }

  const handlePresetSelect = (presetId: string) => {
    setActivePreset(presetId)
    const preset = AI_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    if (presetId === 'custom') return
    const newConfig = {
      endpoint: preset.endpoint || aiConfig.endpoint,
      apiKey: aiConfig.apiKey,
      model: preset.model,
    }
    setAiConfig(newConfig)
    saveAIConfig(newConfig)
  }

  const handleTestAI = async () => {
    setAiTestStatus('testing')
    try {
      await testConnection(aiConfig)
      setAiTestStatus('success')
      crossAlert('成功', 'AI 连接测试成功')
    } catch (err: any) {
      setAiTestStatus('error')
      crossAlert('连接失败', err?.message || '请检查配置')
    }
    setTimeout(() => setAiTestStatus('idle'), 3000)
  }

  // URL listener for OAuth callback
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url
      if (url.includes('access_token') || url.includes('refresh_token')) {
        const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1] || '')
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken && supabase) {
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (error) {
              console.error('设置会话失败:', error)
              return
            }
            if (data.user) {
              setUser({
                id: data.user.id,
                email: data.user.email || null,
                avatar_url: data.user.user_metadata?.avatar_url || null,
                full_name:
                  data.user.user_metadata?.full_name ||
                  data.user.user_metadata?.name ||
                  null,
                provider: 'github',
              })
              crossAlert('成功', '登录成功！')
            }
          } catch (err) {
            console.error('处理登录回调失败:', err)
          }
        }
      }
    }
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url })
    })
    const subscription = Linking.addEventListener('url', handleUrl)
    return () => subscription.remove()
  }, [setUser])

  // Check existing session
  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) return
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || null,
            avatar_url: session.user.user_metadata?.avatar_url || null,
            full_name:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              null,
            provider: 'github',
          })
        }
      } catch (err) {
        console.error('检查会话失败:', err)
      }
    }
    checkSession()
  }, [setUser])

  // Stats
  const stats = useMemo(() => {
    const completedTasks = tasks.filter((t) => t.status === 'completed').length
    const totalTasks = tasks.length
    const activeHabits = habits.length
    let habitCompletions = 0
    let habitTotal = 0
    habits.forEach((habit) => {
      Object.values(habit.records).forEach((completed) => {
        habitTotal++
        if (completed) habitCompletions++
      })
    })

    const today = new Date()
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (6 - i))
      return format(d, 'yyyy-MM-dd')
    })
    const weeklyData = last7.map(date => {
      const dayTasks = tasks.filter(t => t.dueDate === date)
      const completed = dayTasks.filter(t => t.status === 'completed').length
      return { date, total: dayTasks.length, completed }
    })
    const totalMinutes = timeSlots.reduce((s, ts) => s + ts.duration, 0)
    const highP = tasks.filter(t => t.priority === 'high' && t.status !== 'cancelled').length
    const medP = tasks.filter(t => t.priority === 'medium' && t.status !== 'cancelled').length
    const lowP = tasks.filter(t => t.priority === 'low' && t.status !== 'cancelled').length
    const bestStreak = habits.reduce((best, h) => {
      let streak = 0
      for (let i = 0; i < 365; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        if (h.records[format(d, 'yyyy-MM-dd')]) streak++
        else break
      }
      return Math.max(best, streak)
    }, 0)

    return {
      completedTasks,
      totalTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      activeHabits,
      habitRate: habitTotal > 0 ? Math.round((habitCompletions / habitTotal) * 100) : 0,
      weeklyData,
      totalMinutes,
      highP, medP, lowP,
      bestStreak,
      projectCount: projects.length,
    }
  }, [tasks, habits, timeSlots, projects])

  // GitHub login
  const handleGitHubLogin = async () => {
    if (!isSupabaseConfigured() || !supabase) {
      crossAlert('提示', '请先配置 Supabase 环境变量')
      return
    }
    try {
      const redirectUrl = makeRedirectUri({
        scheme: 'lucky-todo-mobile',
        path: 'auth/callback',
      })
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      })
      if (error) {
        crossAlert('登录失败', error.message)
        return
      }
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl, {
          showInRecents: true,
        })
        if (result.type === 'success' && result.url) {
          const url = result.url
          const params = new URLSearchParams(
            url.split('#')[1] || url.split('?')[1] || ''
          )
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')
          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } =
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              })
            if (sessionError) {
              crossAlert('登录失败', sessionError.message)
              return
            }
            if (sessionData.user) {
              setUser({
                id: sessionData.user.id,
                email: sessionData.user.email || null,
                avatar_url: sessionData.user.user_metadata?.avatar_url || null,
                full_name:
                  sessionData.user.user_metadata?.full_name ||
                  sessionData.user.user_metadata?.name ||
                  null,
                provider: 'github',
              })
              crossAlert('成功', '登录成功！')
            }
          }
        }
      }
    } catch (error: any) {
      console.error('登录错误:', error)
      crossAlert('错误', error.message || '登录失败')
    }
  }

  const handleLogout = async () => {
    await signOut()
    setUser(null)
    crossAlert('成功', '已退出登录')
  }

  const runSync = async (showAlert: boolean) => {
    if (syncing) return
    if (!user) {
      if (showAlert) crossAlert('提示', '请先登录后再同步')
      return
    }
    if (!isSupabaseConfigured() || !supabase) {
      if (showAlert) crossAlert('提示', '请先配置 Supabase 环境变量')
      return
    }
    try {
      setSyncing(true)
      const cloudData = await syncWithCloud(user.id, {
        tasks,
        timeSlots,
        projects,
        habits,
      })
      const cc = {
        tasks: cloudData.tasks.length,
        timeSlots: cloudData.timeSlots.length,
        projects: cloudData.projects.length,
        habits: cloudData.habits.length,
      }
      const hasLocal =
        tasks.length > 0 || timeSlots.length > 0 || projects.length > 0 || habits.length > 0
      const isEmpty = cc.tasks === 0 && cc.timeSlots === 0 && cc.projects === 0 && cc.habits === 0
      if (isEmpty && hasLocal) {
        if (showAlert) crossAlert('提示', '云端没有数据，已保留本地数据')
        return
      }
      if (isEmpty) {
        if (showAlert) crossAlert('提示', '云端暂无数据，请先在电脑端同步上传')
        return
      }
      setSyncData(cloudData)
      setLastSyncAt(new Date().toISOString())
      if (showAlert) {
        crossAlert(
          '同步完成',
          `任务 ${cc.tasks} · 日程 ${cc.timeSlots} · 项目 ${cc.projects} · 习惯 ${cc.habits}`
        )
      }
    } catch (error: any) {
      console.error('同步失败:', error)
      if (showAlert) crossAlert('同步失败', error?.message || '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  const handleSync = () => runSync(true)

  const handleDownload = async () => {
    if (syncing) return
    if (!user) {
      crossAlert('提示', '请先登录后再同步')
      return
    }
    if (!isSupabaseConfigured() || !supabase) {
      crossAlert('提示', '请先配置 Supabase 环境变量')
      return
    }
    crossAlert('确认下载', '这将用云端数据覆盖本地数据，确定继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        style: 'destructive',
        onPress: async () => {
          try {
            setSyncing(true)
            const cloudData = await downloadOnly(user.id)
            if (
              cloudData.tasks.length === 0 &&
              cloudData.projects.length === 0 &&
              cloudData.habits.length === 0
            ) {
              crossAlert('提示', '云端暂无数据')
              return
            }
            setSyncData(cloudData)
            setLastSyncAt(new Date().toISOString())
            crossAlert(
              '下载完成',
              `任务 ${cloudData.tasks.length} · 日程 ${cloudData.timeSlots.length} · 项目 ${cloudData.projects.length} · 习惯 ${cloudData.habits.length}`
            )
          } catch (error: any) {
            console.error('下载失败:', error)
            crossAlert('下载失败', error?.message || '请稍后重试')
          } finally {
            setSyncing(false)
          }
        },
      },
    ])
  }

  const handleUpload = async () => {
    if (syncing) return
    if (!user) {
      crossAlert('提示', '请先登录后再同步')
      return
    }
    if (!isSupabaseConfigured() || !supabase) {
      crossAlert('提示', '请先配置 Supabase 环境变量')
      return
    }
    const hasLocalData = tasks.length > 0 || projects.length > 0 || habits.length > 0
    if (!hasLocalData) {
      crossAlert('提示', '本地没有数据可上传')
      return
    }
    crossAlert('确认上传', '这将把本地数据上传到云端，确定继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          try {
            setSyncing(true)
            await uploadOnly(user.id, { tasks, timeSlots, projects, habits })
            setLastSyncAt(new Date().toISOString())
            crossAlert(
              '上传完成',
              `任务 ${tasks.length} · 日程 ${timeSlots.length} · 项目 ${projects.length} · 习惯 ${habits.length}`
            )
          } catch (error: any) {
            console.error('上传失败:', error)
            crossAlert('上传失败', error?.message || '请稍后重试')
          } finally {
            setSyncing(false)
          }
        },
      },
    ])
  }

  const handleImportCourses = async () => {
    if (courseImporting) return
    if (!hubCookie.trim()) {
      crossAlert('提示', '请先粘贴 HUB 系统的 Cookie')
      return
    }

    // 如果手动填了学期开始日期，先校验格式
    if (semesterStartInput.trim()) {
      const dateMatch = semesterStartInput.trim().match(/^\d{4}-\d{2}-\d{2}$/)
      if (!dateMatch) {
        crossAlert('格式错误', '日期格式应为 YYYY-MM-DD（如 2025-02-17）')
        return
      }
    }

    setCourseImporting(true)
    try {
      await saveCookie(hubCookie.trim())

      // 如果手动填了日期，先保存
      if (semesterStartInput.trim()) {
        await saveSemesterStart(semesterStartInput.trim())
        setSemesterStart(semesterStartInput.trim())
      }

      const courseList = await fetchCourseSchedule(hubCookie.trim())
      await saveCourses(courseList)
      setCourses(courseList)

      // API 自动保存了学期开始日期，刷新显示
      const autoStart = await getSemesterStart()
      if (autoStart && !autoStart.includes('NaN')) {
        setSemesterStartInput(autoStart)
        setSemesterStart(autoStart)
      }

      crossAlert('导入成功', `已导入 ${courseList.length} 门课程`)
    } catch (err: any) {
      crossAlert('导入失败', err?.message || '请检查 Cookie 是否正确')
    } finally {
      setCourseImporting(false)
    }
  }

  const handleClearCourses = () => {
    crossAlert('确认清除', '确定要清除所有课表数据吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          await clearCourseStorage()
          clearCoursesInStore()
          setHubCookie('')
          setSemesterStartInput('')
          crossAlert('已清除', '课表数据已清除')
        },
      },
    ])
  }

  const handleManualImport = async () => {
    if (!manualJsonInput.trim()) {
      crossAlert('提示', '请粘贴 API 响应的 JSON 数据')
      return
    }
    if (!semesterStartInput.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(semesterStartInput.trim())) {
      crossAlert('提示', '请先填写学期开始日期（如 2025-02-17）')
      return
    }
    setCourseImporting(true)
    try {
      await saveSemesterStart(semesterStartInput.trim())
      setSemesterStart(semesterStartInput.trim())
      const courseList = parseManualJson(manualJsonInput.trim())
      if (courseList.length === 0) {
        throw new Error('未能从 JSON 中解析出课程，请确认数据格式正确')
      }
      await saveCourses(courseList)
      setCourses(courseList)
      setManualJsonInput('')
      setShowManualImport(false)
      crossAlert('导入成功', `已导入 ${courseList.length} 门课程`)
    } catch (err: any) {
      crossAlert('解析失败', err?.message || '请检查 JSON 格式')
    } finally {
      setCourseImporting(false)
    }
  }

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.8,
      allowsMultipleSelection: false,
    })
    if (!result.canceled && result.assets[0]) {
      setProfileAvatar(result.assets[0].uri)
    }
  }

  const handleSaveName = () => {
    const trimmed = editingName.trim()
    if (trimmed) {
      setProfileName(trimmed)
    }
    setShowNameEdit(false)
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.primary }]}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8}>
            <View style={{ width: 88, height: 88 }}>
              <View style={styles.avatarRing}>
                {profileAvatar ? (
                  <Image source={{ uri: profileAvatar }} style={styles.avatar} resizeMode="cover" />
                ) : (
                  <View style={styles.avatarPlaceholderInner}>
                    <Ionicons name="person" size={36} color="rgba(255,255,255,0.7)" />
                  </View>
                )}
              </View>
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setEditingName(profileName); setShowNameEdit(true) }}
            activeOpacity={0.7}
            style={{ marginTop: 4 }}
          >
            <Text style={styles.userName}>{profileName}</Text>
          </TouchableOpacity>
        </View>

        {/* Name edit modal */}
        <Modal visible={showNameEdit} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowNameEdit(false)}>
          <TouchableOpacity style={styles.nameModalOverlay} activeOpacity={1} onPress={() => setShowNameEdit(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.nameModalCard, { backgroundColor: theme.card }]}>
              <Text style={[typography.heading2, { color: theme.text, marginBottom: 16 }]}>修改昵称</Text>
              <TextInput
                style={[styles.nameInput, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, color: theme.text }]}
                value={editingName}
                onChangeText={setEditingName}
                placeholder="输入昵称"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                maxLength={20}
                onSubmitEditing={handleSaveName}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.nameModalBtn, { backgroundColor: theme.surfaceSecondary }]}
                  onPress={() => setShowNameEdit(false)}
                >
                  <Text style={[typography.body, { color: theme.textSecondary }]}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nameModalBtn, { backgroundColor: theme.primary, flex: 1 }]}
                  onPress={handleSaveName}
                >
                  <Text style={[typography.body, { color: '#fff', fontWeight: '600' }]}>保存</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <Card theme={theme} style={styles.statCard}>
            <ProgressRing
              progress={stats.completionRate}
              size={56}
              strokeWidth={5}
              color={theme.primary}
              backgroundColor={theme.surfaceSecondary}
            >
              <Text style={[styles.ringText, { color: theme.primary }]}>
                {stats.completionRate}%
              </Text>
            </ProgressRing>
            <View style={styles.statInfo}>
              <Text style={[typography.heading3, { color: theme.text }]}>
                {stats.completedTasks}
              </Text>
              <Text style={[typography.small, { color: theme.textSecondary }]}>
                已完成 / {stats.totalTasks} 任务
              </Text>
            </View>
          </Card>
          <Card theme={theme} style={styles.statCard}>
            <ProgressRing
              progress={stats.habitRate}
              size={56}
              strokeWidth={5}
              color={theme.success}
              backgroundColor={theme.surfaceSecondary}
            >
              <Text style={[styles.ringText, { color: theme.success }]}>
                {stats.habitRate}%
              </Text>
            </ProgressRing>
            <View style={styles.statInfo}>
              <Text style={[typography.heading3, { color: theme.text }]}>
                {stats.activeHabits}
              </Text>
              <Text style={[typography.small, { color: theme.textSecondary }]}>
                习惯 · 打卡率
              </Text>
            </View>
          </Card>
        </View>

        {/* Analytics */}
        <Card theme={theme} style={styles.section}>
          <Text style={[typography.label, { color: theme.text, marginBottom: 12 }]}>
            本周趋势
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 4 }}>
            {stats.weeklyData.map((d, i) => {
              const maxH = 50
              const h = d.total > 0 ? Math.max(6, (d.completed / d.total) * maxH) : 4
              const dayLabel = ['一', '二', '三', '四', '五', '六', '日']
              const dayIdx = new Date(d.date).getDay()
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{
                    width: '70%', height: h, borderRadius: 3,
                    backgroundColor: d.completed === d.total && d.total > 0 ? theme.primary : theme.primary + '40',
                  }} />
                  <Text style={{ fontSize: 9, color: theme.textSecondary, marginTop: 4 }}>
                    {dayLabel[dayIdx === 0 ? 6 : dayIdx - 1]}
                  </Text>
                </View>
              )
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <View style={{ flex: 1, backgroundColor: theme.surfaceSecondary, borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{Math.round(stats.totalMinutes / 60)}h</Text>
              <Text style={{ fontSize: 10, color: theme.textSecondary }}>规划总时长</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surfaceSecondary, borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{stats.bestStreak}天</Text>
              <Text style={{ fontSize: 10, color: theme.textSecondary }}>最长连续打卡</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: theme.surfaceSecondary, borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>{stats.projectCount}</Text>
              <Text style={{ fontSize: 10, color: theme.textSecondary }}>项目</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 4, marginTop: 12 }}>
            <View style={{ flex: stats.highP || 1, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
            <View style={{ flex: stats.medP || 1, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
            <View style={{ flex: stats.lowP || 1, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontSize: 10, color: '#EF4444' }}>高 {stats.highP}</Text>
            <Text style={{ fontSize: 10, color: '#F59E0B' }}>中 {stats.medP}</Text>
            <Text style={{ fontSize: 10, color: '#10B981' }}>低 {stats.lowP}</Text>
          </View>
        </Card>

        {/* Theme Picker - clean grid */}
        <Card theme={theme} style={styles.section}>
          <Text style={[typography.label, { color: theme.text, marginBottom: 16 }]}>
            主题颜色
          </Text>
          <View style={styles.themeGrid}>
            {themeOptions.map((t) => {
              const isActive = themeColor === t.id
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.themeItem}
                  onPress={() => setThemeColor(t.id)}
                >
                  <View
                    style={[
                      styles.themeRing,
                      {
                        borderColor: isActive ? theme.primary : 'transparent',
                        borderWidth: isActive ? 2.5 : 0,
                      },
                    ]}
                  >
                    <View
                      style={[styles.themeCircle, { backgroundColor: themes[t.id].primary }]}
                    >
                      <Text style={styles.themeEmoji}>{t.emoji}</Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      typography.small,
                      {
                        color: isActive ? theme.text : theme.textSecondary,
                        fontWeight: isActive ? '600' : '400',
                        marginTop: 6,
                      },
                    ]}
                  >
                    {t.name}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 20,
              paddingTop: 16,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}
            onPress={() => setDarkMode(!darkMode)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={darkMode ? 'moon' : 'sunny'} size={20} color={theme.primary} />
              <Text style={[typography.bodyMedium, { color: theme.text }]}>深色模式</Text>
            </View>
            <View style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              backgroundColor: darkMode ? theme.primary : theme.surfaceSecondary,
              justifyContent: 'center',
              paddingHorizontal: 2,
            }}>
              <View style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#fff',
                alignSelf: darkMode ? 'flex-end' : 'flex-start',
              }} />
            </View>
          </TouchableOpacity>
        </Card>

        {/* Data info */}
        <Card theme={theme} style={styles.section}>
          <Text style={[typography.label, { color: theme.text, marginBottom: 12 }]}>
            数据
          </Text>
          <SettingsItem
            icon="phone-portrait-outline"
            label="本地存储"
            sublabel="所有数据保存在本机"
            onPress={() => {}}
            theme={theme}
            showBorder={false}
          />
        </Card>

        {/* Course Schedule Settings */}
        <Card theme={theme} style={styles.section}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            onPress={() => setShowCourseSettings(!showCourseSettings)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[typography.label, { color: theme.text }]}>
                课表设置
              </Text>
              {courses.length > 0 && (
                <View style={{ backgroundColor: theme.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '600' }}>
                    {courses.length} 门课
                  </Text>
                </View>
              )}
            </View>
            <Ionicons
              name={showCourseSettings ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          {showCourseSettings && (
            <View style={{ marginTop: 16, gap: 12 }}>
              <View>
                <Text style={[typography.small, { color: theme.textSecondary, marginBottom: 4 }]}>
                  学期开始日期（第一周的周一）
                </Text>
                <TextInput
                  style={[styles.aiInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                  value={semesterStartInput}
                  onChangeText={setSemesterStartInput}
                  placeholder="2025-02-17"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View>
                <Text style={[typography.small, { color: theme.textSecondary, marginBottom: 4 }]}>
                  HUB Cookie（在浏览器登录后从 F12 中复制）
                </Text>
                <TextInput
                  style={[styles.aiInput, {
                    backgroundColor: theme.surfaceSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }]}
                  value={hubCookie}
                  onChangeText={setHubCookie}
                  placeholder="粘贴完整的 Cookie 内容..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.aiTestBtn, { backgroundColor: theme.primary + '18', flex: 1 }]}
                  onPress={handleImportCourses}
                  disabled={courseImporting}
                  activeOpacity={0.7}
                >
                  {courseImporting ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={16} color={theme.primary} />
                  )}
                  <Text style={[typography.bodyMedium, { color: theme.primary }]}>
                    导入课表
                  </Text>
                </TouchableOpacity>
                {courses.length > 0 && (
                  <TouchableOpacity
                    style={[styles.aiTestBtn, { backgroundColor: theme.error + '18' }]}
                    onPress={handleClearCourses}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={theme.error} />
                    <Text style={[typography.bodyMedium, { color: theme.error }]}>
                      清除
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {/* 手动导入区域 */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}
                onPress={() => setShowManualImport(!showManualImport)}
                activeOpacity={0.7}
              >
                <Ionicons name="code-slash-outline" size={14} color={theme.textSecondary} />
                <Text style={[typography.small, { color: theme.primary }]}>
                  {showManualImport ? '收起手动导入' : '自动导入失败？点击手动导入'}
                </Text>
              </TouchableOpacity>
              {showManualImport && (
                <View style={{ gap: 8 }}>
                  <Text style={[typography.small, { color: theme.textSecondary }]}>
                    步骤：浏览器打开 HUB 课表页 → F12 → Network → 刷新 → 找到 findKbjz 开头的请求 → 点击 → Response 标签 → 全选复制 → 粘贴到下方
                  </Text>
                  <TextInput
                    style={[styles.aiInput, {
                      backgroundColor: theme.surfaceSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                      minHeight: 100,
                      textAlignVertical: 'top',
                      fontFamily: 'monospace',
                      fontSize: 11,
                    }]}
                    value={manualJsonInput}
                    onChangeText={setManualJsonInput}
                    placeholder='粘贴 API 响应 JSON（如 [{"kcmc":"高等数学",...}]）'
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.aiTestBtn, { backgroundColor: theme.success + '18' }]}
                    onPress={handleManualImport}
                    disabled={courseImporting}
                    activeOpacity={0.7}
                  >
                    {courseImporting ? (
                      <ActivityIndicator size="small" color={theme.success} />
                    ) : (
                      <Ionicons name="checkmark-circle-outline" size={16} color={theme.success} />
                    )}
                    <Text style={[typography.bodyMedium, { color: theme.success }]}>
                      解析并导入
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={[typography.small, { color: theme.textSecondary }]}>
                从华科 HUB 系统导入课表，课程将作为固定色块显示在时间轴上。AI 规划时会自动避开上课时间。
              </Text>
            </View>
          )}
        </Card>

        {/* AI Settings */}
        <Card theme={theme} style={styles.section}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            onPress={() => setShowAISettings(!showAISettings)}
            activeOpacity={0.7}
          >
            <Text style={[typography.label, { color: theme.text }]}>
              AI 助手
            </Text>
            <Ionicons
              name={showAISettings ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
          {showAISettings && (
            <View style={{ marginTop: 16, gap: 12 }}>
              <View>
                <Text style={[typography.small, { color: theme.textSecondary, marginBottom: 6 }]}>
                  服务商预设
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                  <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4 }}>
                    {AI_PRESETS.map(preset => (
                      <TouchableOpacity
                        key={preset.id}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 14,
                          backgroundColor: activePreset === preset.id ? theme.primary : theme.surfaceSecondary,
                          borderWidth: 1,
                          borderColor: activePreset === preset.id ? theme.primary : theme.border,
                        }}
                        onPress={() => handlePresetSelect(preset.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={{
                          fontSize: 12,
                          fontWeight: '500',
                          color: activePreset === preset.id ? '#fff' : theme.textSecondary,
                        }}>
                          {preset.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View>
                <Text style={[typography.small, { color: theme.textSecondary, marginBottom: 4 }]}>
                  API Endpoint
                </Text>
                <TextInput
                  style={[styles.aiInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                  value={aiConfig.endpoint}
                  onChangeText={(v) => handleAIConfigChange('endpoint', v)}
                  placeholder={activePreset === 'cursor' ? '填入反代地址，如 https://your-proxy.com' : 'https://api.example.com'}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                />
              </View>
              <View>
                <Text style={[typography.small, { color: theme.textSecondary, marginBottom: 4 }]}>
                  API Key
                </Text>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={[styles.aiInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border, paddingRight: 40 }]}
                    value={aiConfig.apiKey}
                    onChangeText={(v) => handleAIConfigChange('apiKey', v)}
                    placeholder={AI_PRESETS.find(p => p.id === activePreset)?.placeholder || 'API Key'}
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry={!showApiKey}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={{ position: 'absolute', right: 10, top: 10 }}
                    onPress={() => setShowApiKey(!showApiKey)}
                  >
                    <Ionicons name={showApiKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
              <View>
                <Text style={[typography.small, { color: theme.textSecondary, marginBottom: 4 }]}>
                  模型名称
                </Text>
                <TextInput
                  style={[styles.aiInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                  value={aiConfig.model}
                  onChangeText={(v) => handleAIConfigChange('model', v)}
                  placeholder={AI_PRESETS.find(p => p.id === activePreset)?.model || 'model-name'}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity
                style={[styles.aiTestBtn, { backgroundColor: theme.primary + '18' }]}
                onPress={handleTestAI}
                disabled={!aiConfig.apiKey || aiTestStatus === 'testing'}
                activeOpacity={0.7}
              >
                {aiTestStatus === 'testing' ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="sparkles-outline" size={16} color={theme.primary} />
                )}
                <Text style={[typography.bodyMedium, { color: theme.primary }]}>
                  测试连接
                </Text>
              </TouchableOpacity>
              <Text style={[typography.small, { color: theme.textSecondary }]}>
                支持阿里百炼、DeepSeek、Cursor 反代、OpenAI 等兼容 API。Key 仅存本地。
              </Text>
            </View>
          )}
        </Card>

        {/* About */}
        <Card theme={theme} style={[styles.section, { marginBottom: 40 }]}>
          <Text style={[typography.label, { color: theme.text, marginBottom: 12 }]}>
            关于
          </Text>
          <SettingsItem
            icon="information-circle-outline"
            label="版本"
            sublabel="1.0.0"
            onPress={() => {}}
            theme={theme}
          />
          <SettingsItem
            icon="code-slash-outline"
            label="开发者"
            sublabel="Lucky Todo Team"
            onPress={() => {}}
            theme={theme}
            showBorder={false}
          />
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  // Profile card
  profileCard: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    marginBottom: 20,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  avatarPlaceholderInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  nameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  nameModalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
  },
  nameInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  nameModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  connectedText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ringText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statInfo: {
    flex: 1,
  },
  // Theme
  section: {
    marginBottom: 16,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  themeItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 80,
  },
  themeRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeEmoji: {
    fontSize: 18,
  },
  // Settings list
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 0,
    gap: 12,
  },
  settingsIconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // GitHub button - solid dark
  githubBtn: {
    backgroundColor: '#1D1D1F',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  githubBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  aiInput: {
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
    borderWidth: 1,
  },
  aiTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
})

export default ProfileScreen
