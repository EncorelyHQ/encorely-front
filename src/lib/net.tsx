import { useEffect, useState } from 'react'
import { AppState, Platform, StyleSheet, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon, Text, useStyles, WifiSlashIcon, space, type Theme } from '@/ui'

// TanStack Query no sabe de NetInfo ni de AppState en React Native: sin esto no reintenta al volver la red ni al volver a la app.
export function setupQueryEnvironment(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false)
    }),
  )
  const sub = AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active')
  })
  return () => sub.remove()
}

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const insets = useSafeAreaInsets()
  const styles = useStyles(makeStyles)

  // isInternetReachable puede ser null mientras se comprueba: solo avisamos con un "no" explícito.
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOffline(state.isConnected === false || state.isInternetReachable === false)
      }),
    [],
  )

  if (!offline) return null
  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + space.xs }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon icon={WifiSlashIcon} size={16} color="onTicket" />
      <Text variant="caption" color="onTicket">
        Sin conexión. Revisa tus datos o el wifi.
      </Text>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    // Superpuesto arriba: es transitorio y no debe mover el layout de cada pantalla.
    banner: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
      paddingHorizontal: space.gutter,
      paddingBottom: space.xs + 2,
      backgroundColor: t.ticket,
    },
  })
