import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ThemeColors } from '../theme/colors'

interface CheckboxProps {
  checked: boolean
  onPress: () => void
  theme: ThemeColors
  size?: 'small' | 'large'
  color?: string
}

const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onPress,
  theme,
  size = 'large',
  color,
}) => {
  const isLarge = size === 'large'
  const dim = isLarge ? 24 : 18
  const iconSize = isLarge ? 14 : 10
  const fillColor = color || theme.primary

  return (
    <TouchableOpacity
      style={[
        {
          width: dim,
          height: dim,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: checked ? fillColor : theme.border,
          backgroundColor: checked ? fillColor : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {checked && <Ionicons name="checkmark" size={iconSize} color="white" />}
    </TouchableOpacity>
  )
}

export default Checkbox
