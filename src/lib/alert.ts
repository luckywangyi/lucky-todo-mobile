import { Alert, Platform } from 'react-native'

type AlertButton = {
  text: string
  style?: 'default' | 'cancel' | 'destructive'
  onPress?: () => void
}

let _customShowAlert: ((config: { title: string; message: string; buttons?: AlertButton[] }) => void) | null = null

export function registerCustomAlert(
  fn: (config: { title: string; message: string; buttons?: AlertButton[] }) => void
) {
  _customShowAlert = fn
}

export function crossAlert(
  title: string,
  message: string,
  buttons?: AlertButton[]
) {
  if (_customShowAlert) {
    _customShowAlert({ title, message, buttons })
    return
  }

  if (Platform.OS === 'web') {
    if (!buttons || buttons.length === 0) {
      window.alert(`${title}\n${message}`)
      return
    }

    const cancelBtn = buttons.find(b => b.style === 'cancel')
    const actionButtons = buttons.filter(b => b.style !== 'cancel')

    if (actionButtons.length <= 1) {
      const confirmBtn = actionButtons[0]
      if (confirmBtn && cancelBtn) {
        if (window.confirm(`${title}\n\n${message}`)) {
          confirmBtn.onPress?.()
        }
      } else {
        window.alert(`${title}\n${message}`)
        confirmBtn?.onPress?.()
      }
    } else {
      const choices = actionButtons.map((b, i) => `${i + 1}. ${b.text}`).join('\n')
      const input = window.prompt(`${title}\n\n${message}\n\n${choices}\n\n输入序号选择（取消请留空）:`)
      if (input) {
        const idx = parseInt(input, 10) - 1
        if (idx >= 0 && idx < actionButtons.length) {
          actionButtons[idx].onPress?.()
        }
      }
    }
  } else {
    Alert.alert(title, message, buttons)
  }
}
