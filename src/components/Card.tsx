import React from 'react'
import { View, ViewStyle, StyleProp } from 'react-native'
import { ThemeColors } from '../theme/colors'

interface CardProps {
  theme: ThemeColors
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  noPadding?: boolean
}

const Card: React.FC<CardProps> = ({ theme, children, style, noPadding }) => {
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          ...theme.cardShadow,
        },
        !noPadding && { padding: 16 },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export default Card
