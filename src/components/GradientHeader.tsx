import React from 'react'
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { ThemeColors } from '../theme/colors'

interface GradientHeaderProps {
  theme: ThemeColors
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

const GradientHeader: React.FC<GradientHeaderProps> = ({ theme, children, style }) => {
  return (
    <View style={[styles.header, { backgroundColor: theme.background }, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
})

export default GradientHeader
