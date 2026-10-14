import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Line } from 'react-native-svg'
import { haptics, motion, radius, space, Text, useStyles, useTheme, type Theme } from '@/ui'

export type TicketField = { label: string; value: string }

type MatchTicketProps = {
  myName: string
  peerName: string
  eventName?: string | null
  // Frase ya legible: "Les gusta salsa y rock en español".
  reason?: string
  fields?: TicketField[]
  // Rasga el talón al montar: el momento de autor del match. En listas va en false.
  tear?: boolean
  style?: ViewStyle
}

const NOTCH = 10
// Deja leer la boleta entera antes de rasgarla.
const TEAR_DELAY = motion.duration.slow
const REDUCED_FADE = 120
const easeOut = Easing.bezier(...motion.easeOut)

// La boleta para dos: arriba los nombres y el concierto; abajo, tras la línea perforada, el talón con el sello.
export function MatchTicket({ myName, peerName, eventName, reason, fields = [], tear = false, style }: MatchTicketProps) {
  const styles = useStyles(makeStyles)
  const reduced = useReducedMotion()
  const progress = useSharedValue(tear ? 0 : 1)
  const stamp = useSharedValue(tear ? 0 : 1)

  useEffect(() => {
    if (!tear) return
    if (reduced) {
      // Sin rasgado: un crossfade corto al sello conserva el cambio de estado.
      stamp.value = withTiming(1, { duration: REDUCED_FADE, reduceMotion: ReduceMotion.Never })
      haptics.success()
      return
    }
    progress.value = withDelay(
      TEAR_DELAY,
      withTiming(1, { duration: motion.duration.signature, easing: easeOut, reduceMotion: ReduceMotion.System }),
    )
    stamp.value = withDelay(
      TEAR_DELAY + motion.duration.signature * 0.6,
      withTiming(1, { duration: motion.duration.fast, easing: easeOut, reduceMotion: ReduceMotion.System }),
    )
    const timer = setTimeout(() => haptics.success(), TEAR_DELAY)
    return () => clearTimeout(timer)
  }, [tear, reduced, progress, stamp])

  const tornOffset = space.xl
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, reduced ? 0 : -space.xs]) }],
  }))
  // Primero se abre por la derecha (gira sobre la esquina izquierda) y luego el talón cae y se asienta.
  const stubStyle = useAnimatedStyle(() =>
    reduced
      ? {}
      : {
          transform: [
            { translateY: interpolate(progress.value, [0, 0.3, 1], [0, space.xs / 2, tornOffset]) },
            { translateX: interpolate(progress.value, [0, 1], [0, space.xs]) },
            { rotate: `${interpolate(progress.value, [0, 0.3, 1], [0, 3.5, 2.5])}deg` },
          ],
        },
  )
  // El sello "cae" sobre el papel: de un poco más grande a su tamaño, como un sello de entrada. Sin movimiento si se pidió.
  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [{ scale: reduced ? 1 : interpolate(stamp.value, [0, 1], [1.08, 1]) }],
  }))

  const names = `${myName} y ${peerName}`
  const label = ['Boleta para dos', names, eventName, reason].filter(Boolean).join('. ')

  return (
    <View
      style={[tear && !reduced ? styles.tearRoom : null, style]}
      accessible
      accessibilityLabel={label}
      // El rasgado es decorativo: nunca intercepta toques de los botones de la pantalla.
      pointerEvents="none"
    >
      <Animated.View style={[styles.body, bodyStyle]}>
        <Text variant="title1" color="onTicket" numberOfLines={3}>
          {names}
        </Text>
        {eventName ? (
          <Text variant="headline" color="onTicket">
            {eventName}
          </Text>
        ) : null}
        {reason ? (
          <Text variant="callout" color="onTicketMuted">
            {reason}
          </Text>
        ) : null}
        <Perforation />
      </Animated.View>

      <Animated.View style={[styles.stub, styles.stubOrigin, stubStyle]}>
        <Notches edge="top" />
        <View style={styles.stubRow}>
          <View style={styles.fields}>
            {fields.map((f) => (
              <View key={f.label} style={styles.field}>
                <Text variant="caption" color="onTicketMuted">
                  {f.label}
                </Text>
                <Text variant="data" color="onTicket">
                  {f.value}
                </Text>
              </View>
            ))}
          </View>
          <Animated.View style={[styles.stamp, stampStyle]}>
            <Text variant="callout" style={styles.stampText}>
              Match
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  )
}

type MatchTicketStubProps = {
  peerName: string
  eventName?: string | null
  detail?: string
  trailing?: ReactNode
  style?: ViewStyle
}

// El talón que queda después del match: para reusar en la lista de chats.
export function MatchTicketStub({ peerName, eventName, detail, trailing, style }: MatchTicketStubProps) {
  const styles = useStyles(makeStyles)
  return (
    <View style={[styles.stub, styles.stubStandalone, style]}>
      <Notches edge="top" />
      <View style={styles.stubRow}>
        <View style={styles.stubText}>
          <Text variant="headline" color="onTicket" numberOfLines={1}>
            {peerName}
          </Text>
          {eventName ? (
            <Text variant="footnote" color="onTicketMuted" numberOfLines={1}>
              {eventName}
            </Text>
          ) : null}
          {detail ? (
            <Text variant="footnote" color="onTicketMuted" numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        {trailing}
      </View>
    </View>
  )
}

function Notches({ edge }: { edge: 'top' | 'bottom' }) {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const pos = edge === 'top' ? styles.notchTop : styles.notchBottom
  return (
    <>
      <View style={[styles.notch, styles.notchLeft, pos, { backgroundColor: theme.bg }]} />
      <View style={[styles.notch, styles.notchRight, pos, { backgroundColor: theme.bg }]} />
    </>
  )
}

// Va al borde inferior del cuerpo: al rasgarse, la línea queda en la parte de arriba.
function Perforation() {
  const theme = useTheme()
  const styles = useStyles(makeStyles)
  const [width, setWidth] = useState(0)
  return (
    <>
      <View style={styles.lineHost} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={2}>
            <Line
              x1={NOTCH + space.xs}
              y1={1}
              x2={width - NOTCH - space.xs}
              y2={1}
              stroke={theme.onTicketMuted}
              strokeWidth={1.5}
              strokeDasharray="4 5"
            />
          </Svg>
        ) : null}
      </View>
      <Notches edge="bottom" />
    </>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    // Hueco para que el talón caiga sin pisar lo que viene debajo.
    tearRoom: { paddingBottom: space.xl },
    body: {
      backgroundColor: t.ticket,
      borderTopLeftRadius: radius.md,
      borderTopRightRadius: radius.md,
      overflow: 'hidden',
      paddingHorizontal: space.xl,
      paddingTop: space.xl,
      paddingBottom: space.xl + NOTCH,
      gap: space.sm,
    },
    stub: {
      backgroundColor: t.ticket,
      borderBottomLeftRadius: radius.md,
      borderBottomRightRadius: radius.md,
      overflow: 'hidden',
      paddingHorizontal: space.xl,
      paddingTop: NOTCH + space.sm,
      paddingBottom: space.lg,
    },
    stubOrigin: { transformOrigin: 'left top' },
    stubStandalone: { borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
    stubRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    stubText: { flex: 1, gap: space.xs / 2 },
    fields: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.sm },
    field: { gap: space.xs / 2 },
    stamp: {
      borderWidth: 2,
      borderColor: t.ticketVerified,
      borderRadius: radius.sm,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
    },
    stampText: { color: t.ticketVerified, textTransform: 'uppercase', letterSpacing: 1 },
    lineHost: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    notch: { position: 'absolute', width: NOTCH * 2, height: NOTCH * 2, borderRadius: NOTCH },
    notchLeft: { left: -NOTCH },
    notchRight: { right: -NOTCH },
    notchTop: { top: -NOTCH },
    notchBottom: { bottom: -NOTCH },
  })
