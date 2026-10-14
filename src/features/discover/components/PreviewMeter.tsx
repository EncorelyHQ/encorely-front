import { memo, useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { space } from '@/ui'
import { onCover, withAlpha } from '../model/color'

// Alturas de reposo distintas para que, quietas (reduced motion), se lean igual como "sonando".
const BARS = [
  { rest: 0.45, peak: 1, duration: 420 },
  { rest: 0.7, peak: 0.35, duration: 360 },
  { rest: 0.3, peak: 0.9, duration: 480 },
  { rest: 0.6, peak: 0.4, duration: 400 },
] as const

const BAR_HEIGHT = 14

function Bar({ rest, peak, duration, animate }: (typeof BARS)[number] & { animate: boolean }) {
  const scale = useSharedValue<number>(rest)

  useEffect(() => {
    if (!animate) {
      cancelAnimation(scale)
      scale.value = rest
      return
    }
    const ease = Easing.inOut(Easing.quad)
    // Único bucle permitido del sistema (03 §5.6): solo vive mientras suena la vista previa.
    scale.value = withRepeat(
      withSequence(
        withTiming(peak, { duration, easing: ease, reduceMotion: ReduceMotion.System }),
        withTiming(rest, { duration, easing: ease, reduceMotion: ReduceMotion.System }),
      ),
      -1,
      false,
    )
    return () => cancelAnimation(scale)
  }, [animate, duration, peak, rest, scale])

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }))
  return <Animated.View style={[styles.bar, style]} />
}

// Se monta solo mientras suena; con reduced motion queda estático.
export const PlayingBars = memo(function PlayingBars() {
  const reduced = useReducedMotion()
  return (
    <View style={styles.bars} accessible={false} importantForAccessibility="no-hide-descendants">
      {BARS.map((bar, i) => (
        <Bar key={i} {...bar} animate={!reduced} />
      ))}
    </View>
  )
})

// Hoja que lee el shared value del progreso: el resto de la tarjeta no se re-renderiza cada 250 ms.
export const PreviewProgress = memo(function PreviewProgress({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }))
  return (
    <View style={styles.track} accessible={false}>
      <Animated.View style={[styles.fill, style]} />
    </View>
  )
})

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: BAR_HEIGHT },
  bar: {
    width: 3,
    height: BAR_HEIGHT,
    borderRadius: 1.5,
    backgroundColor: onCover.accent,
    transformOrigin: 'bottom',
  },
  track: {
    height: 2,
    marginTop: space.md,
    borderRadius: 1,
    overflow: 'hidden',
    backgroundColor: withAlpha(onCover.text, 0.24),
  },
  fill: { flex: 1, backgroundColor: onCover.text, transformOrigin: 'left' },
})
