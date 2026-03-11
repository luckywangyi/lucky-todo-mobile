import React, { useEffect, useRef, useState } from 'react'
import { View, Modal, TouchableOpacity, Text, StyleSheet, Platform, Animated, Easing, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ThemeColors } from '../theme/colors'
import { typography } from '../theme/typography'

const SCREEN_HEIGHT = Dimensions.get('window').height

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
    <View style={styles.content}>
      {children}
    </View>
  </>
)

const WebBottomSheet: React.FC<BottomSheetProps & { tabBarHeight: number }> = (props) => {
  const { visible, onClose, theme, tabBarHeight } = props
  const anim = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      anim.setValue(0)
      requestAnimationFrame(() => {
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: false,
          damping: 26,
          stiffness: 140,
          mass: 0.9,
        }).start()
      })
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: false,
      }).start(() => setMounted(false))
    }
  }, [visible])

  if (!mounted) return null

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  })
  const backdropOpacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.25, 0.3],
  })

  return (
    <View style={[styles.webOverlay, { bottom: tabBarHeight }]}>
      <Animated.View
        style={[styles.webBackdrop, { opacity: backdropOpacity }]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.card, paddingBottom: 24, transform: [{ translateY }] },
        ]}
      >
        <SheetContent {...props} />
      </Animated.View>
    </View>
  )
}

const NativeBottomSheet: React.FC<BottomSheetProps> = (props) => {
  const { visible, onClose, theme } = props
  const insets = useSafeAreaInsets()
  const anim = useRef(new Animated.Value(0)).current
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    if (visible) {
      setModalVisible(true)
      anim.setValue(0)
      requestAnimationFrame(() => {
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 26,
          stiffness: 140,
          mass: 0.9,
        }).start()
      })
    } else if (modalVisible) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => setModalVisible(false))
    }
  }, [visible])

  if (!modalVisible) return null

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.25, 0.3],
  })
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  })

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              paddingBottom: insets.bottom + 24,
              transform: [{ translateY }],
            },
          ]}
        >
          <SheetContent {...props} />
        </Animated.View>
      </View>
    </Modal>
  )
}

const BottomSheet: React.FC<BottomSheetProps> = (props) => {
  const insets = useSafeAreaInsets()
  const tabBarHeight = 64 + insets.bottom

  if (Platform.OS === 'web') {
    return <WebBottomSheet {...props} tabBarHeight={tabBarHeight} />
  }

  return <NativeBottomSheet {...props} />
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
    overflow: 'hidden',
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '85%',
    overflow: 'hidden',
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
