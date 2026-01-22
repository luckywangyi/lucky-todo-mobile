import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import TodayScreen from '../screens/TodayScreen'
import TasksScreen from '../screens/TasksScreen'
import HabitsScreen from '../screens/HabitsScreen'
import ProfileScreen from '../screens/ProfileScreen'
import useStore from '../store/useStore'
import { getTheme } from '../theme/colors'

const Tab = createBottomTabNavigator()

const TabNavigator = () => {
  const { themeColor } = useStore()
  const theme = getTheme(themeColor)

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home'

          if (route.name === '今日') {
            iconName = focused ? 'sunny' : 'sunny-outline'
          } else if (route.name === '任务') {
            iconName = focused ? 'list' : 'list-outline'
          } else if (route.name === '习惯') {
            iconName = focused ? 'flame' : 'flame-outline'
          } else if (route.name === '我的') {
            iconName = focused ? 'person' : 'person-outline'
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen name="今日" component={TodayScreen} />
      <Tab.Screen name="任务" component={TasksScreen} />
      <Tab.Screen name="习惯" component={HabitsScreen} />
      <Tab.Screen name="我的" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export default TabNavigator
