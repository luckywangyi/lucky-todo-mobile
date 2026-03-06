import { ThemeColor } from '../types'

export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  background: string
  card: string
  text: string
  textSecondary: string
  border: string
  success: string
  warning: string
  error: string
  primaryGradient: [string, string]
  shadowColor: string
  surfaceSecondary: string
  cardShadow: {
    shadowColor: string
    shadowOffset: { width: number; height: number }
    shadowOpacity: number
    shadowRadius: number
    elevation: number
  }
}

const baseShadow = {
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
}

export const themes: Record<ThemeColor, ThemeColors> = {
  ocean: {
    primary: '#6366F1',
    secondary: '#818CF8',
    accent: '#4F46E5',
    background: '#F5F5F7',
    card: '#FFFFFF',
    text: '#1D1D1F',
    textSecondary: '#6E6E73',
    border: '#E8E8ED',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    primaryGradient: ['#6366F1', '#818CF8'],
    shadowColor: '#000000',
    surfaceSecondary: '#EEEEF0',
    cardShadow: { ...baseShadow, shadowColor: '#000000' },
  },
  forest: {
    primary: '#22C55E',
    secondary: '#4ADE80',
    accent: '#16A34A',
    background: '#F5F7F5',
    card: '#FFFFFF',
    text: '#1D1F1D',
    textSecondary: '#6E736E',
    border: '#E8EDE8',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    primaryGradient: ['#22C55E', '#4ADE80'],
    shadowColor: '#000000',
    surfaceSecondary: '#EEF2EE',
    cardShadow: { ...baseShadow, shadowColor: '#000000' },
  },
  lavender: {
    primary: '#A855F7',
    secondary: '#C084FC',
    accent: '#9333EA',
    background: '#F7F5F9',
    card: '#FFFFFF',
    text: '#1F1D21',
    textSecondary: '#736E78',
    border: '#ECE8F0',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    primaryGradient: ['#A855F7', '#C084FC'],
    shadowColor: '#000000',
    surfaceSecondary: '#F0EEF3',
    cardShadow: { ...baseShadow, shadowColor: '#000000' },
  },
  sunset: {
    primary: '#F97316',
    secondary: '#FB923C',
    accent: '#EA580C',
    background: '#F7F5F5',
    card: '#FFFFFF',
    text: '#1F1D1D',
    textSecondary: '#73706E',
    border: '#EDE8E8',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    primaryGradient: ['#F97316', '#FB923C'],
    shadowColor: '#000000',
    surfaceSecondary: '#F2EEEE',
    cardShadow: { ...baseShadow, shadowColor: '#000000' },
  },
  rose: {
    primary: '#EC4899',
    secondary: '#F472B6',
    accent: '#DB2777',
    background: '#F7F5F6',
    card: '#FFFFFF',
    text: '#1F1D1E',
    textSecondary: '#736E71',
    border: '#EDE8EA',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    primaryGradient: ['#EC4899', '#F472B6'],
    shadowColor: '#000000',
    surfaceSecondary: '#F2EEF0',
    cardShadow: { ...baseShadow, shadowColor: '#000000' },
  },
  slate: {
    primary: '#64748B',
    secondary: '#94A3B8',
    accent: '#475569',
    background: '#F5F5F7',
    card: '#FFFFFF',
    text: '#1E293B',
    textSecondary: '#64748B',
    border: '#E8E8ED',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    primaryGradient: ['#64748B', '#94A3B8'],
    shadowColor: '#000000',
    surfaceSecondary: '#EDEDEF',
    cardShadow: { ...baseShadow, shadowColor: '#000000' },
  },
}

export const getTheme = (color: ThemeColor): ThemeColors => {
  return themes[color] || themes.ocean
}
