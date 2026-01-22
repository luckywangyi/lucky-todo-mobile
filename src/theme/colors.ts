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
}

export const themes: Record<ThemeColor, ThemeColors> = {
  ocean: {
    primary: '#0EA5E9',
    secondary: '#38BDF8',
    accent: '#0284C7',
    background: '#F0F9FF',
    card: '#FFFFFF',
    text: '#0C4A6E',
    textSecondary: '#64748B',
    border: '#E0F2FE',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  forest: {
    primary: '#10B981',
    secondary: '#34D399',
    accent: '#059669',
    background: '#ECFDF5',
    card: '#FFFFFF',
    text: '#064E3B',
    textSecondary: '#64748B',
    border: '#D1FAE5',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  lavender: {
    primary: '#8B5CF6',
    secondary: '#A78BFA',
    accent: '#7C3AED',
    background: '#F5F3FF',
    card: '#FFFFFF',
    text: '#4C1D95',
    textSecondary: '#64748B',
    border: '#EDE9FE',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  sunset: {
    primary: '#F97316',
    secondary: '#FB923C',
    accent: '#EA580C',
    background: '#FFF7ED',
    card: '#FFFFFF',
    text: '#7C2D12',
    textSecondary: '#64748B',
    border: '#FFEDD5',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  rose: {
    primary: '#F43F5E',
    secondary: '#FB7185',
    accent: '#E11D48',
    background: '#FFF1F2',
    card: '#FFFFFF',
    text: '#881337',
    textSecondary: '#64748B',
    border: '#FFE4E6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  slate: {
    primary: '#475569',
    secondary: '#64748B',
    accent: '#334155',
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#1E293B',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
}

export const getTheme = (color: ThemeColor): ThemeColors => {
  return themes[color] || themes.ocean
}
