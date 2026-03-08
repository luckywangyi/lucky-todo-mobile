import React, { useEffect, useRef } from 'react'
import { View, Animated, Dimensions, StyleSheet } from 'react-native'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const PARTICLE_COUNT = 24
const COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']

interface Props {
  visible: boolean
  onFinish?: () => void
}

const CelebrationOverlay: React.FC<Props> = ({ visible, onFinish }) => {
  const startXValues = useRef(Array.from({ length: PARTICLE_COUNT }, () => Math.random() * SCREEN_W)).current
  const animations = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      y: new Animated.Value(-20),
      x: new Animated.Value(startXValues[i]),
      opacity: new Animated.Value(1),
      rotate: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current

  useEffect(() => {
    if (!visible) return

    const anims = animations.map((p, i) => {
      const sx = Math.random() * SCREEN_W
      startXValues[i] = sx
      p.y.setValue(-20 - Math.random() * 40)
      p.x.setValue(sx)
      p.opacity.setValue(1)
      p.rotate.setValue(0)
      p.scale.setValue(0)

      return Animated.sequence([
        Animated.delay(i * 40),
        Animated.parallel([
          Animated.timing(p.y, { toValue: SCREEN_H + 20, duration: 2000 + Math.random() * 1000, useNativeDriver: true }),
          Animated.timing(p.x, { toValue: sx + (Math.random() - 0.5) * 120, duration: 2500, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0, duration: 2500, useNativeDriver: true }),
          Animated.timing(p.rotate, { toValue: 360 * (1 + Math.random()), duration: 2500, useNativeDriver: true }),
          Animated.sequence([
            Animated.spring(p.scale, { toValue: 1, friction: 3, useNativeDriver: true }),
            Animated.timing(p.scale, { toValue: 0, duration: 1000, delay: 1000, useNativeDriver: true }),
          ]),
        ]),
      ])
    })

    Animated.parallel(anims).start(() => onFinish?.())
  }, [visible])

  if (!visible) return null

  return (
    <View style={styles.container} pointerEvents="none">
      {animations.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              backgroundColor: COLORS[i % COLORS.length],
              width: 6 + Math.random() * 6,
              height: 6 + Math.random() * 10,
              borderRadius: Math.random() > 0.5 ? 10 : 2,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: p.rotate.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
                { scale: p.scale },
              ],
              opacity: p.opacity,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  particle: {
    position: 'absolute',
  },
})

export default CelebrationOverlay
