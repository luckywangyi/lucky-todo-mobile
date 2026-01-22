import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import useStore from '../store/useStore'
import { getTheme, themes } from '../theme/colors'
import { ThemeColor } from '../types'
import { supabase, isSupabaseConfigured, signOut } from '../lib/supabase'
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'

WebBrowser.maybeCompleteAuthSession()

const themeOptions: { id: ThemeColor; name: string; emoji: string }[] = [
  { id: 'ocean', name: '海洋蓝', emoji: '🌊' },
  { id: 'forest', name: '森林绿', emoji: '🌲' },
  { id: 'lavender', name: '薰衣草', emoji: '💜' },
  { id: 'sunset', name: '日落橙', emoji: '🌅' },
  { id: 'rose', name: '玫瑰红', emoji: '🌹' },
  { id: 'slate', name: '石板灰', emoji: '🌫️' },
]

const ProfileScreen = () => {
  const { themeColor, setThemeColor, user, setUser, tasks, habits } = useStore()
  const theme = getTheme(themeColor)

  // 统计数据
  const stats = useMemo(() => {
    const completedTasks = tasks.filter(t => t.status === 'completed').length
    const totalTasks = tasks.length
    const activeHabits = habits.length
    
    // 计算习惯完成率
    let habitCompletions = 0
    let habitTotal = 0
    habits.forEach(habit => {
      Object.values(habit.records).forEach(completed => {
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

  // GitHub 登录
  const handleGitHubLogin = async () => {
    if (!isSupabaseConfigured()) {
      Alert.alert('提示', '请先配置 Supabase 环境变量')
      return
    }

    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'lucky-todo-mobile',
      })
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUrl,
        },
      })
      
      if (error) {
        Alert.alert('登录失败', error.message)
        return
      }
      
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
        
        if (result.type === 'success') {
          // 获取用户信息
          const { data: { user: authUser } } = await supabase.auth.getUser()
          if (authUser) {
            setUser({
              id: authUser.id,
              email: authUser.email || null,
              avatar_url: authUser.user_metadata?.avatar_url || null,
              full_name: authUser.user_metadata?.full_name || null,
              provider: 'github',
            })
          }
        }
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '登录失败')
    }
  }

  // 登出
  const handleLogout = async () => {
    await signOut()
    setUser(null)
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 用户信息 */}
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          {user ? (
            <>
              <Image
                source={{ uri: user.avatar_url || 'https://via.placeholder.com/80' }}
                style={styles.avatar}
              />
              <Text style={[styles.userName, { color: theme.text }]}>
                {user.full_name || '用户'}
              </Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                {user.email}
              </Text>
              <View style={styles.syncStatus}>
                <Ionicons name="cloud-done" size={16} color={theme.success} />
                <Text style={[styles.syncText, { color: theme.success }]}>
                  已连接云端
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.border }]}>
                <Ionicons name="person" size={40} color={theme.textSecondary} />
              </View>
              <Text style={[styles.userName, { color: theme.text }]}>
                未登录
              </Text>
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>
                登录后可同步数据到云端
              </Text>
            </>
          )}
        </View>

        {/* 统计卡片 */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statNumber, { color: theme.primary }]}>
              {stats.completedTasks}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              已完成任务
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statNumber, { color: theme.primary }]}>
              {stats.completionRate}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              完成率
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statNumber, { color: theme.primary }]}>
              {stats.activeHabits}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              习惯数
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statNumber, { color: theme.primary }]}>
              {stats.habitRate}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              习惯打卡率
            </Text>
          </View>
        </View>

        {/* 主题选择 */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            主题颜色
          </Text>
          <View style={styles.themeGrid}>
            {themeOptions.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.themeButton,
                  { backgroundColor: themes[t.id].primary },
                  themeColor === t.id && styles.themeSelected,
                ]}
                onPress={() => setThemeColor(t.id)}
              >
                <Text style={styles.themeEmoji}>{t.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 账户操作 */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            账户
          </Text>
          
          {user ? (
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: theme.error }]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color={theme.error} />
              <Text style={[styles.actionButtonText, { color: theme.error }]}>
                退出登录
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.githubButton]}
              onPress={handleGitHubLogin}
            >
              <Ionicons name="logo-github" size={20} color="white" />
              <Text style={[styles.actionButtonText, { color: 'white' }]}>
                使用 GitHub 登录
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 关于 */}
        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            关于
          </Text>
          <View style={styles.aboutItem}>
            <Text style={[styles.aboutLabel, { color: theme.textSecondary }]}>
              版本
            </Text>
            <Text style={[styles.aboutValue, { color: theme.text }]}>
              1.0.0
            </Text>
          </View>
          <View style={styles.aboutItem}>
            <Text style={[styles.aboutLabel, { color: theme.textSecondary }]}>
              开发者
            </Text>
            <Text style={[styles.aboutValue, { color: theme.text }]}>
              Lucky Todo Team
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 14,
    marginTop: 4,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  themeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSelected: {
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  themeEmoji: {
    fontSize: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  githubButton: {
    backgroundColor: '#24292e',
    borderColor: '#24292e',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  aboutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  aboutLabel: {
    fontSize: 14,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: '500',
  },
})

export default ProfileScreen
