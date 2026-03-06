import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { ThemeColors } from '../theme/colors'

interface FilterOption<T extends string> {
  key: T
  label: string
}

interface FilterPillsProps<T extends string> {
  theme: ThemeColors
  options: FilterOption<T>[]
  selected: T
  onSelect: (key: T) => void
}

function FilterPills<T extends string>({
  theme,
  options,
  selected,
  onSelect,
}: FilterPillsProps<T>) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const isActive = selected === opt.key
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.pill,
              {
                backgroundColor: isActive ? theme.primary : theme.surfaceSecondary,
              },
            ]}
            onPress={() => onSelect(opt.key)}
          >
            <Text
              style={[
                styles.pillText,
                { color: isActive ? 'white' : theme.textSecondary },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
})

export default FilterPills
