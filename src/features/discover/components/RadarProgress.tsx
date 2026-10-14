import { memo, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Button, IconButton, motion, radius, space, Text, useStyles, XIcon, type Theme } from '@/ui'
import { radarProgress, remainingToRadar, songsWord } from '../model/radar'

type RadarProgressProps = { swipeCount: number; threshold: number }

// Línea discreta con el dato real de /me/dna: cuánto falta para ver quién va a tus conciertos.
export const RadarProgress = memo(function RadarProgress({ swipeCount, threshold }: RadarProgressProps) {
  const styles = useStyles(makeStyles)
  const remaining = remainingToRadar(swipeCount, threshold)
  const value = useSharedValue(radarProgress(swipeCount, threshold))

  useEffect(() => {
    value.value = withTiming(radarProgress(swipeCount, threshold), {
      duration: motion.duration.base,
      easing: Easing.bezier(...motion.easeOut),
      reduceMotion: ReduceMotion.System,
    })
  }, [swipeCount, threshold, value])

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: value.value }] }))

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Califica ${remaining} ${songsWord(remaining)} más para ver quién va a tus conciertos`}
      accessibilityValue={{ min: 0, max: threshold, now: Math.min(swipeCount, threshold) }}
    >
      <View style={styles.line}>
        <Text variant="footnote" color="textMuted" style={styles.copy}>
          Califica <Text variant="data">{remaining}</Text> {songsWord(remaining)} más para ver quién va a tus conciertos
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill]} />
      </View>
    </View>
  )
})

type RadarUnlockedProps = { onSeeEvents: () => void; onDismiss: () => void }

// Aviso sobrio, una sola vez por sesión: sin confeti ni mayúsculas.
export function RadarUnlocked({ onSeeEvents, onDismiss }: RadarUnlockedProps) {
  const styles = useStyles(makeStyles)
  return (
    <Animated.View
      style={styles.notice}
      accessibilityLiveRegion="polite"
      entering={FadeIn.duration(motion.duration.base).reduceMotion(ReduceMotion.System)}
    >
      <View style={styles.noticeHead}>
        <Text variant="callout" style={styles.copy}>
          Listo. Ya puedes ver quién va a tus conciertos.
        </Text>
        <IconButton icon={XIcon} label="Cerrar aviso" size="md" onPress={onDismiss} />
      </View>
      <Button label="Ver conciertos" variant="secondary" onPress={onSeeEvents} fullWidth={false} />
    </Animated.View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: space.sm },
    line: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
    copy: { flex: 1 },
    track: { height: 3, borderRadius: radius.full, backgroundColor: t.borderInput, overflow: 'hidden' },
    fill: { flex: 1, backgroundColor: t.accent, transformOrigin: 'left' },
    notice: {
      gap: space.sm,
      paddingLeft: space.lg,
      paddingRight: space.xs,
      paddingVertical: space.md,
      borderRadius: radius.md,
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    noticeHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  })
