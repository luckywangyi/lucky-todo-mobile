import { TextStyle } from 'react-native'

export const typography: Record<string, TextStyle> = {
  heading1: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  heading2: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  heading3: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  small: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
  },
} as const
