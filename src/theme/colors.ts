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
  isDark: boolean
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

const darkShadow = {
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
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
    isDark: false,
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
    isDark: false,
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
    isDark: false,
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
    isDark: false,
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
    isDark: false,
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
    isDark: false,
    cardShadow: { ...baseShadow, shadowColor: '#000000' },
  },
}

const darkThemes: Record<ThemeColor, ThemeColors> = {
  ocean: {
    primary: '#818CF8',
    secondary: '#6366F1',
    accent: '#A5B4FC',
    background: '#0F0F14',
    card: '#1A1A24',
    text: '#E8E8ED',
    textSecondary: '#9898A0',
    border: '#2A2A35',
    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#F87171',
    primaryGradient: ['#818CF8', '#6366F1'],
    shadowColor: '#000000',
    surfaceSecondary: '#1E1E28',
    isDark: true,
    cardShadow: { ...darkShadow, shadowColor: '#000000' },
  },
  forest: {
    primary: '#4ADE80',
    secondary: '#22C55E',
    accent: '#86EFAC',
    background: '#0F1410',
    card: '#1A241A',
    text: '#E8EDE8',
    textSecondary: '#98A098',
    border: '#2A352A',
    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#F87171',
    primaryGradient: ['#4ADE80', '#22C55E'],
    shadowColor: '#000000',
    surfaceSecondary: '#1E281E',
    isDark: true,
    cardShadow: { ...darkShadow, shadowColor: '#000000' },
  },
  lavender: {
    primary: '#C084FC',
    secondary: '#A855F7',
    accent: '#D8B4FE',
    background: '#12101A',
    card: '#1E1A28',
    text: '#ECE8F0',
    textSecondary: '#A098A8',
    border: '#302A3A',
    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#F87171',
    primaryGradient: ['#C084FC', '#A855F7'],
    shadowColor: '#000000',
    surfaceSecondary: '#221E2C',
    isDark: true,
    cardShadow: { ...darkShadow, shadowColor: '#000000' },
  },
  sunset: {
    primary: '#FB923C',
    secondary: '#F97316',
    accent: '#FDBA74',
    background: '#14100F',
    card: '#241E1A',
    text: '#EDE8E8',
    textSecondary: '#A89890',
    border: '#3A2A25',
    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#F87171',
    primaryGradient: ['#FB923C', '#F97316'],
    shadowColor: '#000000',
    surfaceSecondary: '#2C221E',
    isDark: true,
    cardShadow: { ...darkShadow, shadowColor: '#000000' },
  },
  rose: {
    primary: '#F472B6',
    secondary: '#EC4899',
    accent: '#F9A8D4',
    background: '#141012',
    card: '#241A20',
    text: '#EDE8EA',
    textSecondary: '#A89098',
    border: '#3A252E',
    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#F87171',
    primaryGradient: ['#F472B6', '#EC4899'],
    shadowColor: '#000000',
    surfaceSecondary: '#2C1E24',
    isDark: true,
    cardShadow: { ...darkShadow, shadowColor: '#000000' },
  },
  slate: {
    primary: '#94A3B8',
    secondary: '#64748B',
    accent: '#CBD5E1',
    background: '#0F1114',
    card: '#1A1D24',
    text: '#E2E8F0',
    textSecondary: '#8892A0',
    border: '#2A2E38',
    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#F87171',
    primaryGradient: ['#94A3B8', '#64748B'],
    shadowColor: '#000000',
    surfaceSecondary: '#1E2128',
    isDark: true,
    cardShadow: { ...darkShadow, shadowColor: '#000000' },
  },
}

export const TASK_TITLE_COLOR = '#5B8FD4'

export const getTheme = (color: ThemeColor, darkMode: boolean = false): ThemeColors => {
  if (darkMode) return darkThemes[color] || darkThemes.ocean
  return themes[color] || themes.ocean
}
