import React, { useEffect, useRef, useCallback } from 'react'
import { View, Modal, TouchableOpacity, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Animated, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ThemeColors } from '../theme/colors'
import { typography } from '../theme/typography'

interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  theme: ThemeColors
  title: string
  children: React.ReactNode
}

const SheetContent: React.FC<BottomSheetProps> = ({ onClose, theme, title, children }) => (
  <>
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
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  </>
)

const WebBottomSheet: React.FC<BottomSheetProps & { tabBarHeight: number }> = (props) => {
  const { visible, onClose, theme, tabBarHeight } = props
  const anim = useRef(new Animated.Value(0)).current
  const isAnimating = useRef(false)
  const prevVisible = useRef(false)

  useEffect(() => {
    if (visible === prevVisible.current) return
    prevVisible.current = visible

    if (isAnimating.current) anim.stopAnimation()

    if (visible) {
      isAnimating.current = true
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: false,
        damping: 24,
        stiffness: 160,
        mass: 0.8,
      }).start(() => { isAnimating.current = false })
    } else {
      isAnimating.current = true
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false,
      }).start(() => { isAnimating.current = false })
    }
  }, [visible])

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  })
  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  })
  const pointerEvents = visible ? 'auto' as const : 'none' as const

  return (
    <View
      pointerEvents={pointerEvents}
      style={styles.webOverlay}
    >
      <Animated.View style={[styles.webBackdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.card, marginBottom: tabBarHeight, paddingBottom: 24, transform: [{ translateY }] },
        ]}
      >
        {visible && <SheetContent {...props} />}
      </Animated.View>
    </View>
  )
}

const BottomSheet: React.FC<BottomSheetProps> = (props) => {
  const { visible, onClose, theme } = props
  const insets = useSafeAreaInsets()
  const tabBarHeight = 64 + insets.bottom

  if (Platform.OS === 'web') {
    return <WebBottomSheet {...props} tabBarHeight={tabBarHeight} />
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 24 }]}>
          <SheetContent {...props} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  webOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9000,
    justifyContent: 'flex-end',
  },
  webBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
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
