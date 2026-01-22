import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import TabNavigator from './src/navigation/TabNavigator'
import useStore from './src/store/useStore'
import { getTheme } from './src/theme/colors'

export default function App() {
  const { loadData, themeColor } = useStore()
  const theme = getTheme(themeColor)

  useEffect(() => {
    loadData()
  }, [])

  return (
    <NavigationContainer>
      <StatusBar style="auto" backgroundColor={theme.background} />
      <TabNavigator />
    </NavigationContainer>
  )
}
