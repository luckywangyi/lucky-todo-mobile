import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { format, parse, isToday, isTomorrow } from 'date-fns'
import { Task, TimeSlot } from '../types'

// 配置通知行为
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// 请求通知权限
export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('通知权限未授予')
    return false
  }

  // Android 需要设置通知频道
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('task-reminders', {
      name: '任务提醒',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3B82F6',
      sound: 'default',
    })
  }

  return true
}

// 取消所有已安排的通知
export const cancelAllScheduledNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

// 安排每日固定时间提醒（上午10点和晚上8点）
export const scheduleDailyReminders = async (tasks: Task[]) => {
  // 获取未完成的任务
  const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  
  if (pendingTasks.length === 0) {
    return
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const todayPendingTasks = pendingTasks.filter(t => t.dueDate === today)
  
  // 生成任务摘要
  const taskSummary = todayPendingTasks.length > 0
    ? `今日有 ${todayPendingTasks.length} 个任务待完成`
    : `你有 ${pendingTasks.length} 个任务待完成`

  const taskTitles = todayPendingTasks.slice(0, 3).map(t => t.title).join('、')
  const body = todayPendingTasks.length > 0
    ? (todayPendingTasks.length > 3 
        ? `${taskTitles}... 等 ${todayPendingTasks.length} 个任务`
        : taskTitles || '查看任务列表')
    : '查看任务列表规划你的一天'

  // 安排上午 10:00 提醒
  const morningTime = new Date()
  morningTime.setHours(10, 0, 0, 0)
  
  // 如果当前时间已过上午10点，安排明天的
  if (morningTime.getTime() <= Date.now()) {
    morningTime.setDate(morningTime.getDate() + 1)
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '早安！' + taskSummary,
      body: body,
      sound: 'default',
      data: { type: 'daily-morning' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 10,
      minute: 0,
    },
  })

  // 安排晚上 20:00 提醒
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '晚间提醒：' + taskSummary,
      body: body,
      sound: 'default',
      data: { type: 'daily-evening' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  })

  console.log('[Notifications] 已安排每日提醒：上午10点、晚上8点')
}

// 根据时间轴安排任务提醒
export const scheduleTimeSlotReminders = async (tasks: Task[], timeSlots: TimeSlot[]) => {
  const today = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  
  // 只安排今天和明天的时间块提醒
  const relevantSlots = timeSlots.filter(slot => 
    slot.date === today || slot.date === tomorrow
  )

  for (const slot of relevantSlots) {
    const task = tasks.find(t => t.id === slot.taskId)
    if (!task || task.status === 'completed' || task.status === 'cancelled') {
      continue
    }

    // 计算提醒时间（提前5分钟）
    const slotDate = parse(slot.date, 'yyyy-MM-dd', new Date())
    const startHour = Math.floor(slot.startTime / 60)
    const startMinute = slot.startTime % 60
    
    const reminderTime = new Date(slotDate)
    reminderTime.setHours(startHour, startMinute, 0, 0)
    
    // 提前5分钟提醒
    reminderTime.setMinutes(reminderTime.getMinutes() - 5)

    // 如果提醒时间已过，跳过
    if (reminderTime.getTime() <= Date.now()) {
      continue
    }

    // 格式化时间显示
    const timeStr = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`
    const durationStr = slot.duration >= 60 
      ? `${Math.floor(slot.duration / 60)}小时${slot.duration % 60 > 0 ? slot.duration % 60 + '分钟' : ''}`
      : `${slot.duration}分钟`

    const datePrefix = slot.date === today ? '今天' : '明天'

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `即将开始：${task.title}`,
        body: `${datePrefix} ${timeStr} 开始，预计 ${durationStr}`,
        sound: 'default',
        data: { 
          type: 'time-slot',
          taskId: task.id,
          slotId: slot.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    })

    console.log(`[Notifications] 已安排任务提醒：${task.title} @ ${format(reminderTime, 'yyyy-MM-dd HH:mm')}`)
  }
}

// 初始化所有提醒
export const initializeReminders = async (tasks: Task[], timeSlots: TimeSlot[]) => {
  const hasPermission = await requestNotificationPermissions()
  if (!hasPermission) {
    console.log('[Notifications] 无通知权限，跳过提醒设置')
    return
  }

  // 清除旧的通知
  await cancelAllScheduledNotifications()

  // 安排每日固定提醒
  await scheduleDailyReminders(tasks)

  // 安排时间轴任务提醒
  await scheduleTimeSlotReminders(tasks, timeSlots)

  console.log('[Notifications] 提醒初始化完成')
}

// 更新提醒（当任务或时间块变化时调用）
export const updateReminders = async (tasks: Task[], timeSlots: TimeSlot[]) => {
  // 重新初始化所有提醒
  await initializeReminders(tasks, timeSlots)
}
