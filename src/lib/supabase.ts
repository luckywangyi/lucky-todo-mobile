import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// Supabase 配置 - 与桌面版相同
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

// 自定义存储适配器 for React Native
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch {
      // 静默失败
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch {
      // 静默失败
    }
  },
}

// 创建 Supabase 客户端（只在配置有效时）
let supabase: SupabaseClient | null = null

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
}

export { supabase }

// 检查是否配置了 Supabase
export const isSupabaseConfigured = () => {
  return supabase !== null
}

// 登出
export const signOut = async () => {
  if (!supabase) return { error: new Error('Supabase not configured') }
  const { error } = await supabase.auth.signOut()
  return { error }
}

// 获取当前用户
export const getCurrentUser = async () => {
  if (!supabase) return { user: null, error: new Error('Supabase not configured') }
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

// 获取当前会话
export const getSession = async () => {
  if (!supabase) return { session: null, error: new Error('Supabase not configured') }
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}
