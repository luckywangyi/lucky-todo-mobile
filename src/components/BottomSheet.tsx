import React from 'react'
import { View, Modal, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ThemeColors } from '../theme/colors'
import { typography } from '../theme/typography'

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  theme: ThemeColors
  title: string
  children: React.ReactNode
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  theme,
  title,
  children,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.header}>
            <Text style={[typography.heading3, { color: theme.text }]}>{title}</Text>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.background }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
  },
})

export default BottomSheet
