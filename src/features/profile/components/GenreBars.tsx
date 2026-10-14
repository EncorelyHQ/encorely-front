import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { motion, radius, space, Text, useStyles, type Theme } from '@/ui'
import type { GenreBar } from '../genreBars'

const ease = Easing.bezier(...motion.easeOut)
const STAGGER = 40

export function GenreBars({ bars }: { bars: GenreBar[] }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.list}>
      {bars.map((bar, index) => (
        <GenreBarRow key={bar.slug} bar={bar} index={index} />
      ))}
    </View>
  )
}

function GenreBarRow({ bar, index }: { bar: GenreBar; index: number }) {
  const styles = useStyles(makeStyles)
  const reduced = useReducedMotion()
  // Crece desde la izquierda una sola vez al aparecer: explica que es una proporción, no decora.
  const progress = useSharedValue(reduced ? 1 : 0)

  useEffect(() => {
    progress.value = withDelay(
      index * STAGGER,
      withTiming(1, { duration: motion.duration.base, easing: ease, reduceMotion: ReduceMotion.System }),
    )
  }, [progress, index])

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }))

  return (
    <View style={styles.row} accessible accessibilityLabel={`${bar.name}: ${bar.percent} por ciento`}>
      <View style={styles.labels}>
        <Text variant="callout" style={styles.name} numberOfLines={2}>
          {bar.name}
        </Text>
        <Text variant="data" color="textMuted">
          {bar.percent} %
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: `${Math.max(bar.ratio * 100, 2)}%` }, fillStyle]} />
      </View>
    </View>
  )
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    list: { gap: space.lg },
    row: { gap: space.xs + 2 },
    labels: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
    name: { flex: 1 },
    track: { height: space.sm, borderRadius: radius.full, backgroundColor: t.surface2, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: radius.full, backgroundColor: t.accent, transformOrigin: 'left' },
  })
