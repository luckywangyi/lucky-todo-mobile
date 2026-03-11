import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { useFonts, DancingScript_700Bold } from '@expo-google-fonts/dancing-script'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const WRITE_DURATION = 1500
const HOLD_DURATION = 500
const FADE_DURATION = 400

interface Props {
  onFinish: () => void
}

export default function SplashAnimation({ onFinish }: Props) {
  const [fontsLoaded] = useFonts({ DancingScript_700Bold })
  const [textWidth, setTextWidth] = useState(0)
  const revealAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(1)).current
  const cursorBlink = useRef(new Animated.Value(1)).current
  const animStarted = useRef(false)

  useEffect(() => {
    if (!fontsLoaded || textWidth === 0 || animStarted.current) return
    animStarted.current = true

    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorBlink, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(cursorBlink, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    )
    blinkLoop.start()

    Animated.timing(revealAnim, {
      toValue: 1,
      duration: WRITE_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start(() => {
      blinkLoop.stop()
      cursorBlink.setValue(0)

      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: FADE_DURATION,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }).start(() => onFinish())
      }, HOLD_DURATION)
    })
  }, [fontsLoaded, textWidth])

  if (!fontsLoaded) return <View style={styles.container} />

  const revealWidth = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, textWidth + 4],
  })

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Hidden text to measure actual width */}
      <Text
        style={[styles.text, styles.hiddenText]}
        onLayout={(e) => {
          if (textWidth === 0) setTextWidth(e.nativeEvent.layout.width)
        }}
      >
        Lucky Day
      </Text>

      {/* Reveal mask */}
      <View style={styles.center}>
        <Animated.View style={[styles.mask, { width: revealWidth }]}>
          <Text style={styles.text} numberOfLines={1}>
            Lucky Day
          </Text>

          {/* Writing cursor */}
          <Animated.View
            style={[
              styles.cursor,
              { opacity: cursorBlink },
            ]}
          />
        </Animated.View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mask: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
  },
  text: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 44,
    color: '#7C5CBF',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  hiddenText: {
    position: 'absolute',
    opacity: 0,
  },
  cursor: {
    width: 2.5,
    height: 36,
    backgroundColor: '#7C5CBF',
    borderRadius: 1,
    marginLeft: -1,
  },
})
