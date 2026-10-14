import { useCallback, useRef, useState } from 'react'
import { AccessibilityInfo, Linking, StyleSheet, View } from 'react-native'
import { router, Stack } from 'expo-router'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import Animated, { Easing, FadeIn, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { userMessage } from '@/lib/api/errors'
import {
  Button,
  EmptyState,
  haptics,
  Icon,
  LoadingState,
  motion,
  QrCodeIcon,
  radius,
  Screen,
  ShieldCheckIcon,
  space,
  Text,
  useStyles,
  WarningIcon,
  type Theme,
} from '@/ui'
import { isE2eeError } from '../crypto'
import { usePeerSecurity } from '../hooks/usePeerSecurity'

type Props = { matchId: string }
type Result = { kind: 'idle' } | { kind: 'busy' } | { kind: 'match' } | { kind: 'mismatch'; message: string }

const FRAME = 248
const CORNER = 28
const fade = FadeIn.duration(motion.duration.base).easing(Easing.bezier(...motion.easeOut)).reduceMotion(ReduceMotion.System)

export function ScanScreen({ matchId }: Props) {
  const security = usePeerSecurity(matchId)
  const [permission, requestPermission] = useCameraPermissions()
  const styles = useStyles(makeStyles)
  const insets = useSafeAreaInsets()
  const [result, setResult] = useState<Result>({ kind: 'idle' })
  // El escáner dispara varias veces por segundo: solo se procesa la primera lectura hasta que el usuario reintente.
  const locked = useRef(false)
  const name = security.match?.peer.displayName ?? ''

  const onScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (locked.current) return
      locked.current = true
      if (!security.checkScanned(data)) {
        haptics.warning()
        const message = 'Este código no coincide. No compartas nada sensible hasta aclararlo.'
        AccessibilityInfo.announceForAccessibility(message)
        setResult({ kind: 'mismatch', message })
        return
      }
      setResult({ kind: 'busy' })
      try {
        await security.markVerified()
        haptics.success()
        AccessibilityInfo.announceForAccessibility(`Verificado. Tu código y el de ${name} coinciden.`)
        setResult({ kind: 'match' })
      } catch (error) {
        setResult({
          kind: 'mismatch',
          message: isE2eeError(error)
            ? 'El código cambió mientras escaneabas. Vuelve a intentarlo.'
            : userMessage(error),
        })
      }
    },
    [name, security],
  )

  const retry = () => {
    locked.current = false
    setResult({ kind: 'idle' })
  }

  const header = <Stack.Screen options={{ title: 'Escanear su código' }} />

  if (!permission) {
    return (
      <Screen edges={[]}>
        {header}
        <LoadingState label="Preparando la cámara" />
      </Screen>
    )
  }

  if (!permission.granted) {
    return (
      <Screen edges={[]}>
        {header}
        <EmptyState
          icon={QrCodeIcon}
          title="Escanea el código de la otra persona"
          body="Usamos la cámara solo para leer el QR de su pantalla de código de seguridad. No tomamos fotos ni guardamos nada."
          action={
            permission.canAskAgain
              ? { label: 'Permitir la cámara', onPress: () => void requestPermission() }
              : { label: 'Abrir ajustes', onPress: () => void Linking.openSettings() }
          }
          secondaryAction={{ label: 'Comparar los números a mano', onPress: () => router.back() }}
        />
      </Screen>
    )
  }

  return (
    <View style={styles.root}>
      {header}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        // Sin código propio calculado no hay contra qué comparar: no se escanea todavía.
        onBarcodeScanned={result.kind === 'idle' && security.code ? onScanned : undefined}
        accessibilityLabel="Vista de la cámara"
      />
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame} accessible={false}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}>
        {result.kind === 'match' ? (
          <Animated.View entering={fade} style={styles.panelContent}>
            <View style={styles.statusRow}>
              <Icon icon={ShieldCheckIcon} size={28} color="verified" weight="fill" />
              <Text variant="title2" color="verified" accessibilityRole="header">
                Verificado
              </Text>
            </View>
            <Text variant="callout" color="textMuted">
              Tu código y el de {name} coinciden. Nadie más está leyendo este chat.
            </Text>
            <Button label="Listo" onPress={() => router.back()} />
          </Animated.View>
        ) : result.kind === 'mismatch' ? (
          <Animated.View entering={fade} style={styles.panelContent} accessibilityLiveRegion="assertive">
            <View style={styles.statusRow}>
              <Icon icon={WarningIcon} size={24} color="danger" weight="fill" />
              <Text variant="headline" style={styles.flex}>
                {result.message}
              </Text>
            </View>
            <Button label="Intentar de nuevo" variant="secondary" onPress={retry} />
          </Animated.View>
        ) : (
          <View style={styles.panelContent}>
            <Text variant="callout">
              {result.kind === 'busy'
                ? 'Comprobando…'
                : !security.code
                  ? 'Preparando el código de seguridad…'
                  : `Apunta al QR que ${name || 'la otra persona'} tiene en su pantalla de código de seguridad.`}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    frame: { width: FRAME, height: FRAME },
    corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: t.ticket },
    tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: radius.sm },
    tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: radius.sm },
    bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: radius.sm },
    br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: radius.sm },
    panel: {
      backgroundColor: t.bg,
      borderTopLeftRadius: radius.md,
      borderTopRightRadius: radius.md,
      paddingHorizontal: space.gutter,
      paddingTop: space.lg,
    },
    panelContent: { gap: space.md },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    flex: { flex: 1 },
  })
