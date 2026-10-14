import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from './Text'
import { useStyles } from './theme'
import { radius, space, type Theme } from './tokens'

type Tone = 'neutral' | 'success' | 'danger'
type ToastItem = { id: number; message: string; tone: Tone }
type ToastApi = { show: (message: string, tone?: Tone) => void }

const ToastContext = createContext<ToastApi>({ show: () => undefined })

// Sustituye Alert.alert para avisos: misma marca en Android e iOS y anunciado a lectores de pantalla.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const insets = useSafeAreaInsets()
  const styles = useStyles(makeStyles)

  const show = useCallback((message: string, tone: Tone = 'neutral') => {
    if (timer.current) clearTimeout(timer.current)
    setItem({ id: Date.now(), message, tone })
    AccessibilityInfo.announceForAccessibility(message)
    timer.current = setTimeout(() => setItem(null), 4000)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 88 }]}>
        {item ? (
          <Animated.View
            key={item.id}
            entering={FadeInDown.duration(200).reduceMotion(ReduceMotion.System)}
            exiting={FadeOutDown.duration(160).reduceMotion(ReduceMotion.System)}
            style={[styles.toast, item.tone === 'danger' ? styles.danger : item.tone === 'success' ? styles.success : null]}
          >
            <Text variant="callout" color="onTicket">
              {item.message}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    host: { position: 'absolute', left: space.gutter, right: space.gutter, alignItems: 'center' },
    toast: {
      backgroundColor: t.ticket,
      borderRadius: radius.sm,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      borderLeftWidth: 4,
      borderLeftColor: t.onTicketMuted,
      maxWidth: 480,
      alignSelf: 'stretch',
    },
    success: { borderLeftColor: t.ticketVerified },
    danger: { borderLeftColor: t.ticketDanger },
  })
