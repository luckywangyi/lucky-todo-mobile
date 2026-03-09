import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

export function impactLight() {
  if (Platform.OS === 'web') return
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) } catch {}
}

export function impactMedium() {
  if (Platform.OS === 'web') return
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) } catch {}
}

export function notificationSuccess() {
  if (Platform.OS === 'web') return
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) } catch {}
}

export function notificationWarning() {
  if (Platform.OS === 'web') return
  try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning) } catch {}
}

export function selectionChanged() {
  if (Platform.OS === 'web') return
  try { Haptics.selectionAsync() } catch {}
}
