import React, { useState, useRef } from 'react'
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ThemeColors } from '../theme/colors'

const { width: SCREEN_W } = Dimensions.get('window')

const pages = [
  {
    icon: 'today' as const,
    title: '智能时间轴',
    desc: '将任务拖到时间轴上，自动安排你的一天。AI 可以帮你智能规划最优日程。',
  },
  {
    icon: 'sparkles' as const,
    title: 'AI 助手',
    desc: '用自然语言创建任务、生成子任务、改排日程。每天早上获得智能简报。',
  },
  {
    icon: 'school' as const,
    title: '课表集成',
    desc: '导入大学课表到时间轴，将任务安排到课程中，学习效率翻倍。',
  },
]

interface Props {
  visible: boolean
  theme: ThemeColors
  onDone: () => void
}

const OnboardingOverlay: React.FC<Props> = ({ visible, theme, onDone }) => {
  const [currentPage, setCurrentPage] = useState(0)
  const scrollRef = useRef<ScrollView>(null)

  if (!visible) return null

  const goTo = (idx: number) => {
    setCurrentPage(idx)
    scrollRef.current?.scrollTo({ x: idx * SCREEN_W, animated: true })
  }

  return (
    <View style={[styles.overlay, { backgroundColor: theme.background }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
          setCurrentPage(idx)
        }}
        scrollEventThrottle={16}
      >
        {pages.map((page, i) => (
          <View key={i} style={[styles.page, { width: SCREEN_W }]}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name={page.icon} size={48} color={theme.primary} />
            </View>
            <Text style={[styles.pageTitle, { color: theme.text }]}>{page.title}</Text>
            <Text style={[styles.pageDesc, { color: theme.textSecondary }]}>{page.desc}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentPage ? theme.primary : theme.border,
                  width: i === currentPage ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        {currentPage === pages.length - 1 ? (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.primary }]}
            onPress={onDone}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>开始使用</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.btns}>
            <TouchableOpacity onPress={onDone} activeOpacity={0.6}>
              <Text style={[styles.skipText, { color: theme.textSecondary }]}>跳过</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.primary, paddingHorizontal: 24 }]}
              onPress={() => goTo(currentPage + 1)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnText}>下一步</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    justifyContent: 'center',
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  pageDesc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 60,
    alignItems: 'center',
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  btns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  btn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  skipText: {
    fontSize: 15,
  },
})

export default OnboardingOverlay
