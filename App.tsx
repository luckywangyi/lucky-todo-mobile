import React, { useEffect, useRef, useCallback, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { AppState, AppStateStatus } from 'react-native'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import TabNavigator from './src/navigation/TabNavigator'
import useStore from './src/store/useStore'
import { getTheme } from './src/theme/colors'
import { updateReminders } from './src/lib/notifications'
import { syncWithCloud } from './src/lib/cloudSync'
import { isSupabaseConfigured } from './src/lib/supabase'
import OnboardingOverlay from './src/components/OnboardingOverlay'

const PERIODIC_SYNC_INTERVAL = 3 * 60 * 1000 // 3分钟定时同步
const AUTO_SYNC_DELAY = 5000 // 数据变化后5秒防抖同步

export default function App() {
  const { loadData, themeColor, darkMode, tasks, timeSlots, projects, habits, user, setSyncData } = useStore()
  const theme = getTheme(themeColor, darkMode)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const appState = useRef(AppState.currentState)
  const notificationListener = useRef<Notifications.EventSubscription | null>(null)
  const responseListener = useRef<Notifications.EventSubscription | null>(null)
  const syncingRef = useRef(false)
  const periodicSyncTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const dataSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialLoadDone = useRef(false)

  const runAutoSync = useCallback(async () => {
    const currentUser = useStore.getState().user
    if (!currentUser || syncingRef.current || !isSupabaseConfigured()) return

    syncingRef.current = true
    try {
      const { tasks, timeSlots, projects, habits } = useStore.getState()
      console.log('[AutoSync] 自动同步开始...')
      const cloudData = await syncWithCloud(currentUser.id, { tasks, timeSlots, projects, habits })
      const isEmpty = cloudData.tasks.length === 0 && cloudData.timeSlots.length === 0 &&
        cloudData.projects.length === 0 && cloudData.habits.length === 0
      if (!isEmpty) {
        useStore.getState().setSyncData(cloudData)
        console.log('[AutoSync] 同步完成:', {
          tasks: cloudData.tasks.length,
          timeSlots: cloudData.timeSlots.length,
          projects: cloudData.projects.length,
          habits: cloudData.habits.length,
        })
      } else {
        console.log('[AutoSync] 云端为空，保留本地数据')
      }
    } catch (err) {
      console.error('[AutoSync] 自动同步失败:', err)
    } finally {
      syncingRef.current = false
    }
  }, [])

  // 初始化数据和通知
  useEffect(() => {
    const init = async () => {
      await loadData()
      initialLoadDone.current = true
      const seen = await AsyncStorage.getItem('lucky-todo-onboarding-done')
      if (!seen) setShowOnboarding(true)
    }
    init()

    // 监听通知（前台收到通知时）
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[App] 收到通知:', notification.request.content.title)
    })

    // 监听通知点击
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[App] 点击通知:', response.notification.request.content.data)
    })

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove()
      }
      if (responseListener.current) {
        responseListener.current.remove()
      }
    }
  }, [])

  // 当任务或时间块变化时更新提醒
  useEffect(() => {
    if (tasks.length > 0) {
      const timer = setTimeout(() => {
        updateReminders(tasks, timeSlots)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [tasks, timeSlots])

  // 应用回到前台时自动同步 + 刷新提醒
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (tasks.length > 0) {
          updateReminders(tasks, timeSlots)
        }
        runAutoSync()
      }
      appState.current = nextAppState
    })

    return () => {
      subscription.remove()
    }
  }, [tasks, timeSlots, runAutoSync])

  // 定时同步（每3分钟）
  useEffect(() => {
    if (!user) {
      if (periodicSyncTimer.current) {
        clearInterval(periodicSyncTimer.current)
        periodicSyncTimer.current = null
      }
      return
    }

    periodicSyncTimer.current = setInterval(() => {
      console.log('[AutoSync] 定时同步触发')
      runAutoSync()
    }, PERIODIC_SYNC_INTERVAL)

    return () => {
      if (periodicSyncTimer.current) {
        clearInterval(periodicSyncTimer.current)
        periodicSyncTimer.current = null
      }
    }
  }, [user, runAutoSync])

  // 数据变化后防抖自动同步
  useEffect(() => {
    if (!user || !initialLoadDone.current) return

    if (dataSyncTimer.current) clearTimeout(dataSyncTimer.current)
    dataSyncTimer.current = setTimeout(() => {
      console.log('[AutoSync] 数据变化，防抖同步触发')
      runAutoSync()
    }, AUTO_SYNC_DELAY)

    return () => {
      if (dataSyncTimer.current) clearTimeout(dataSyncTimer.current)
    }
  }, [user, tasks, timeSlots, projects, habits, runAutoSync])

  return (
    <NavigationContainer>
      <StatusBar style={darkMode ? 'light' : 'dark'} backgroundColor={theme.background} />
      <TabNavigator />
      <OnboardingOverlay
        visible={showOnboarding}
        theme={theme}
        onDone={() => {
          setShowOnboarding(false)
          AsyncStorage.setItem('lucky-todo-onboarding-done', 'true')
        }}
      />
    </NavigationContainer>
  )
}
