import React from 'react'
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native'
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import TodayScreen from '../screens/TodayScreen'
import TasksScreen from '../screens/TasksScreen'
import ProjectsScreen from '../screens/ProjectsScreen'
import HabitsScreen from '../screens/HabitsScreen'
import ProfileScreen from '../screens/ProfileScreen'
import useStore from '../store/useStore'
import { getTheme } from '../theme/colors'

const Tab = createBottomTabNavigator()

const tabConfig: {
  name: string
  iconFocused: keyof typeof Ionicons.glyphMap
  iconDefault: keyof typeof Ionicons.glyphMap
}[] = [
  { name: '今日', iconFocused: 'today', iconDefault: 'today-outline' },
  { name: '任务', iconFocused: 'checkbox', iconDefault: 'checkbox-outline' },
  { name: '项目', iconFocused: 'folder', iconDefault: 'folder-outline' },
  { name: '习惯', iconFocused: 'repeat', iconDefault: 'repeat-outline' },
  { name: '我的', iconFocused: 'person-circle', iconDefault: 'person-circle-outline' },
]

const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const { themeColor } = useStore()
  const theme = getTheme(themeColor)

  return (
    <View style={[styles.tabBarOuter, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index
          const config = tabConfig[index]

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={[
                styles.tab,
                focused && [styles.tabFocused, { backgroundColor: `${theme.primary}10` }],
              ]}
            >
              <Ionicons
                name={focused ? config.iconFocused : config.iconDefault}
                size={21}
                color={focused ? theme.primary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: focused ? theme.primary : theme.textSecondary },
                  focused && { fontWeight: '600' },
                ]}
              >
                {config.name}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const TabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="今日" component={TodayScreen} />
      <Tab.Screen name="任务" component={TasksScreen} />
      <Tab.Screen name="项目" component={ProjectsScreen} />
      <Tab.Screen name="习惯" component={HabitsScreen} />
      <Tab.Screen name="我的" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingTop: 6,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 16,
    gap: 3,
  },
  tabFocused: {},
  tabLabel: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
})

export default TabNavigator
