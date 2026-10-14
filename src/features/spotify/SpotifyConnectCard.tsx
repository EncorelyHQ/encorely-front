import { useEffect, useRef } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useReducedMotion,
} from 'react-native-reanimated'
import {
  ArrowsClockwiseIcon,
  Button,
  CheckCircleIcon,
  haptics,
  Icon,
  motion,
  radius,
  space,
  Text,
  touch,
  useStyles,
  useToast,
  WarningCircleIcon,
  type Theme,
} from '@/ui'
import { SpotifyButton } from './SpotifyButton'
import { useSpotifyImport, type SpotifyImportResult } from './useSpotifyImport'

const ease = Easing.bezier(...motion.easeOut)

type Props = {
  onImported?: (result: SpotifyImportResult) => void
}

export function SpotifyConnectCard({ onImported }: Props) {
  const styles = useStyles(makeStyles)
  const toast = useToast()
  const { status, importedCount, errorMessage, errorKind, isLinked, connect, disconnect } = useSpotifyImport({
    onImported,
  })
  const reduceMotion = useReducedMotion()
  const announced = useRef<string | null>(null)

  const doneText = importedCount === 1 ? 'Importamos 1 artista' : `Importamos ${importedCount ?? 0} artistas`

  // El resultado llega mientras el usuario mira otra app (Spotify): se anuncia al volver, una sola vez.
  useEffect(() => {
    const message = status === 'done' ? doneText : status === 'error' ? errorMessage : null
    if (message && announced.current !== message) AccessibilityInfo.announceForAccessibility(message)
    announced.current = message
  }, [status, doneText, errorMessage])

  const busy = status === 'authorizing' || status === 'importing'
  // Con un acceso ya guardado, volver a importar se queda en la misma vista: sin saltos de layout.
  const showResult = status === 'done' || ((status === 'idle' || busy) && isLinked)
  const softError = errorKind === 'cancelled' || errorKind === 'denied'
  const entering = FadeIn.duration(reduceMotion ? 120 : motion.duration.base)
    .easing(ease)
    .reduceMotion(ReduceMotion.Never)

  const onDisconnect = async () => {
    await disconnect()
    toast.show('Quitamos el acceso a Spotify de este teléfono.')
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text variant="headline" accessibilityRole="header">
          Tus artistas de Spotify
        </Text>
        {!showResult ? (
          <Text variant="callout" color="textMuted">
            Importa tus artistas más escuchados para afinar con quién coincides. Solo leemos tu top de artistas.
          </Text>
        ) : null}
      </View>

      <Animated.View key={showResult ? 'result' : 'connect'} entering={entering} style={styles.body}>
        {showResult ? (
          <>
            <View style={styles.statusRow} accessible accessibilityLiveRegion="polite">
              {status === 'done' ? <Icon icon={CheckCircleIcon} size={24} color="verified" weight="fill" /> : null}
              <View style={styles.statusText}>
                <Text variant="headline">{status === 'done' ? doneText : 'Spotify conectado'}</Text>
                <Text variant="footnote" color="textMuted">
                  {status === 'done'
                    ? 'Ya los usamos para afinar con quién coincides.'
                    : status === 'authorizing'
                      ? 'Termina en Spotify y vuelve aquí.'
                      : status === 'importing'
                        ? 'Importando tus artistas…'
                        : 'Vuelve a importar cuando cambie lo que escuchas.'}
                </Text>
              </View>
            </View>
            <Button
              label="Volver a importar"
              variant="ghost"
              icon={ArrowsClockwiseIcon}
              loading={busy}
              onPress={connect}
            />
          </>
        ) : (
          <>
            {status === 'error' && errorMessage ? (
              // Cancelar o negar el permiso es una decisión del usuario, no una falla: va en tono neutro.
              <Animated.View entering={entering} style={styles.statusRow} accessibilityLiveRegion="polite">
                {softError ? null : <Icon icon={WarningCircleIcon} size={20} color="danger" />}
                <Text variant="footnote" color={softError ? 'textMuted' : 'danger'} style={styles.statusText}>
                  {errorMessage}
                </Text>
              </Animated.View>
            ) : null}
            <SpotifyButton
              label={isLinked ? 'Volver a importar' : 'Conectar con Spotify'}
              busyLabel={status === 'importing' ? 'Importando tus artistas' : 'Esperando a Spotify'}
              busy={busy}
              onPress={connect}
            />
          </>
        )}
      </Animated.View>

      {showResult ? (
        <View style={styles.footer}>
          <Text variant="caption" color="textSubtle">
            Datos de Spotify
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Desconectar Spotify"
            accessibilityHint="Borra de este teléfono el acceso a tu cuenta de Spotify"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            hitSlop={space.sm}
            onPress={() => {
              haptics.selection()
              void onDisconnect()
            }}
            style={({ pressed }) => [styles.link, pressed ? styles.linkPressed : null, busy ? styles.disabled : null]}
          >
            <Text variant="footnote" color="textMuted" style={styles.linkText}>
              Desconectar
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      padding: space.lg,
      gap: space.lg,
    },
    header: { gap: space.xs },
    body: { gap: space.md },
    statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    statusText: { flex: 1, gap: space.xs },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: space.lg,
    },
    link: {
      minHeight: touch.min,
      justifyContent: 'center',
      paddingHorizontal: space.sm,
      borderRadius: radius.sm,
    },
    linkPressed: { backgroundColor: t.surface2 },
    linkText: { textDecorationLine: 'underline' },
    disabled: { opacity: 0.45 },
  })
