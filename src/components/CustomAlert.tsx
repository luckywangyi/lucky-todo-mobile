import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ThemeColors } from '../theme/colors'
import { registerCustomAlert } from '../lib/alert'

type AlertButton = {
  text: string
  style?: 'default' | 'cancel' | 'destructive'
  onPress?: () => void
}

type AlertConfig = {
  title: string
  message: string
  buttons?: AlertButton[]
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
}

type AlertContextType = {
  showAlert: (config: AlertConfig) => void
}

const AlertContext = createContext<AlertContextType>({ showAlert: () => {} })

export const useAlert = () => useContext(AlertContext)

interface Props {
  children: React.ReactNode
  theme: ThemeColors
}

export const AlertProvider: React.FC<Props> = ({ children, theme }) => {
  const [visible, setVisible] = useState(false)
  const [config, setConfig] = useState<AlertConfig | null>(null)

  const showAlert = useCallback((cfg: AlertConfig) => {
    setConfig(cfg)
    setVisible(true)
  }, [])

  useEffect(() => {
    registerCustomAlert(showAlert)
  }, [showAlert])

  const handlePress = (btn?: AlertButton) => {
    setVisible(false)
    setTimeout(() => btn?.onPress?.(), 200)
  }

  const cancelBtn = config?.buttons?.find(b => b.style === 'cancel')
  const actionButtons = config?.buttons?.filter(b => b.style !== 'cancel') || []
  const hasButtons = (config?.buttons?.length || 0) > 0

  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    if (config?.icon) return config.icon
    const hasDestructive = config?.buttons?.some(b => b.style === 'destructive')
    if (hasDestructive) return 'alert-circle-outline'
    return 'information-circle-outline'
  }

  const getIconColor = () => {
    if (config?.iconColor) return config.iconColor
    const hasDestructive = config?.buttons?.some(b => b.style === 'destructive')
    if (hasDestructive) return theme.error
    return theme.primary
  }

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => handlePress(cancelBtn)}
      >
        <Pressable style={styles.overlay} onPress={() => handlePress(cancelBtn)}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.iconWrap, { backgroundColor: getIconColor() + '15' }]}>
              <Ionicons name={getIconName()} size={28} color={getIconColor()} />
            </View>

            <Text style={[styles.title, { color: theme.text }]}>
              {config?.title}
            </Text>
            <Text style={[styles.message, { color: theme.textSecondary }]}>
              {config?.message}
            </Text>

            <View style={styles.buttonRow}>
              {cancelBtn && (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: theme.surfaceSecondary, flex: 1 }]}
                  onPress={() => handlePress(cancelBtn)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnText, { color: theme.textSecondary }]}>
                    {cancelBtn.text}
                  </Text>
                </TouchableOpacity>
              )}
              {actionButtons.map((btn, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: btn.style === 'destructive' ? theme.error : theme.primary,
                      flex: 1,
                    },
                  ]}
                  onPress={() => handlePress(btn)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnText, { color: '#fff' }]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              ))}
              {!hasButtons && (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: theme.primary, flex: 1 }]}
                  onPress={() => handlePress()}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnText, { color: '#fff' }]}>确定</Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AlertContext.Provider>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
})
