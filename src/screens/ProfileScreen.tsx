import React, { useMemo, useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  TextInput,
  ActivityIndicator,
} from 'react-native'
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
import { getAIConfig, saveAIConfig, testConnection, type AIConfig } from '../services/ai'

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
    setThemeColor,
    user,
    setUser,
    tasks,
    timeSlots,
    projects,
    habits,
    setSyncData,
  } = useStore()
  const theme = getTheme(themeColor)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const lastAutoSyncUserId = useRef<string | null>(null)

  // AI settings
  const [aiConfig, setAiConfig] = useState<AIConfig>({ endpoint: '', apiKey: '', model: '' })
  const [showApiKey, setShowApiKey] = useState(false)
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [showAISettings, setShowAISettings] = useState(false)

  useEffect(() => {
    getAIConfig().then(setAiConfig)
  }, [])

  const handleAIConfigChange = (field: keyof AIConfig, value: string) => {
    const newConfig = { ...aiConfig, [field]: value }
    setAiConfig(newConfig)
    saveAIConfig(newConfig)
  }

  const handleTestAI = async () => {
    setAiTestStatus('testing')
    try {
      await testConnection(aiConfig)
      setAiTestStatus('success')
      Alert.alert('成功', 'AI 连接测试成功')
    } catch (err: any) {
      setAiTestStatus('error')
      Alert.alert('连接失败', err?.message || '请检查配置')
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
              Alert.alert('成功', '登录成功！')
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
    return {
      completedTasks,
      totalTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      activeHabits,
      habitRate: habitTotal > 0 ? Math.round((habitCompletions / habitTotal) * 100) : 0,
    }
  }, [tasks, habits])

  // GitHub login
  const handleGitHubLogin = async () => {
    if (!isSupabaseConfigured() || !supabase) {
      Alert.alert('提示', '请先配置 Supabase 环境变量')
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
        Alert.alert('登录失败', error.message)
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
              Alert.alert('登录失败', sessionError.message)
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
              Alert.alert('成功', '登录成功！')
            }
          }
        }
      }
    } catch (error: any) {
      console.error('登录错误:', error)
      Alert.alert('错误', error.message || '登录失败')
    }
  }

  const handleLogout = async () => {
    await signOut()
    setUser(null)
    Alert.alert('成功', '已退出登录')
  }

  const runSync = async (showAlert: boolean) => {
    if (syncing) return
    if (!user) {
      if (showAlert) Alert.alert('提示', '请先登录后再同步')
      return
    }
    if (!isSupabaseConfigured() || !supabase) {
      if (showAlert) Alert.alert('提示', '请先配置 Supabase 环境变量')
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
        if (showAlert) Alert.alert('提示', '云端没有数据，已保留本地数据')
        return
      }
      if (isEmpty) {
        if (showAlert) Alert.alert('提示', '云端暂无数据，请先在电脑端同步上传')
        return
      }
      setSyncData(cloudData)
      setLastSyncAt(new Date().toISOString())
      if (showAlert) {
        Alert.alert(
          '同步完成',
          `任务 ${cc.tasks} · 日程 ${cc.timeSlots} · 项目 ${cc.projects} · 习惯 ${cc.habits}`
        )
      }
    } catch (error: any) {
      console.error('同步失败:', error)
      if (showAlert) Alert.alert('同步失败', error?.message || '请稍后重试')
    } finally {
      setSyncing(false)
    }
  }

  const handleSync = () => runSync(true)

  const handleDownload = async () => {
    if (syncing) return
    if (!user) {
      Alert.alert('提示', '请先登录后再同步')
      return
    }
    if (!isSupabaseConfigured() || !supabase) {
      Alert.alert('提示', '请先配置 Supabase 环境变量')
      return
    }
    Alert.alert('确认下载', '这将用云端数据覆盖本地数据，确定继续？', [
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
              Alert.alert('提示', '云端暂无数据')
              return
            }
            setSyncData(cloudData)
            setLastSyncAt(new Date().toISOString())
            Alert.alert(
              '下载完成',
              `任务 ${cloudData.tasks.length} · 日程 ${cloudData.timeSlots.length} · 项目 ${cloudData.projects.length} · 习惯 ${cloudData.habits.length}`
            )
          } catch (error: any) {
            console.error('下载失败:', error)
            Alert.alert('下载失败', error?.message || '请稍后重试')
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
      Alert.alert('提示', '请先登录后再同步')
      return
    }
    if (!isSupabaseConfigured() || !supabase) {
      Alert.alert('提示', '请先配置 Supabase 环境变量')
      return
    }
    const hasLocalData = tasks.length > 0 || projects.length > 0 || habits.length > 0
    if (!hasLocalData) {
      Alert.alert('提示', '本地没有数据可上传')
      return
    }
    Alert.alert('确认上传', '这将把本地数据上传到云端，确定继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          try {
            setSyncing(true)
            await uploadOnly(user.id, { tasks, timeSlots, projects, habits })
            setLastSyncAt(new Date().toISOString())
            Alert.alert(
              '上传完成',
              `任务 ${tasks.length} · 日程 ${timeSlots.length} · 项目 ${projects.length} · 习惯 ${habits.length}`
            )
          } catch (error: any) {
            console.error('上传失败:', error)
            Alert.alert('上传失败', error?.message || '请稍后重试')
          } finally {
            setSyncing(false)
          }
        },
      },
    ])
  }

  // No auto-sync in local-only version

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.primary }]}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={36} color="rgba(255,255,255,0.7)" />
          </View>
          <Text style={styles.userName}>Lucky Todo</Text>
          <Text style={styles.userEmail}>本地版 · 数据仅存储在本机</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <Card theme={theme} style={styles.statCard}>
            <ProgressRing
              progress={stats.completionRate}
              size={56}
              strokeWidth={5}
              color={theme.primary}
              backgroundColor={theme.border}
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
              backgroundColor={theme.border}
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
                <Text style={[typography.small, { color: theme.textSecondary, marginBottom: 4 }]}>
                  API Endpoint
                </Text>
                <TextInput
                  style={[styles.aiInput, { backgroundColor: theme.surfaceSecondary, color: theme.text, borderColor: theme.border }]}
                  value={aiConfig.endpoint}
                  onChangeText={(v) => handleAIConfigChange('endpoint', v)}
                  placeholder="https://dashscope.aliyuncs.com/compatible-mode"
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
                    placeholder="sk-..."
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
                  placeholder="qwen-plus"
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
                支持阿里百炼、DeepSeek 等 OpenAI 兼容 API。Key 仅存本地。
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
    marginBottom: 14,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
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
