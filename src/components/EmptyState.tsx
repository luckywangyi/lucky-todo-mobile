import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ThemeColors } from '../theme/colors'
import { typography } from '../theme/typography'

interface EmptyStateProps {
  theme: ThemeColors
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  actionLabel?: string
  onAction?: () => void
}

const EmptyState: React.FC<EmptyStateProps> = ({
  theme,
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: `${theme.primary}08` }]}>
        <Ionicons name={icon} size={48} color={theme.primary} />
      </View>
      <Text style={[typography.heading3, { color: theme.text, marginTop: 20 }]}>
        {title}
      </Text>
      <Text
        style={[
          typography.body,
          { color: theme.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
        ]}
      >
        {subtitle}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={onAction}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  actionText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
})

export default EmptyState
