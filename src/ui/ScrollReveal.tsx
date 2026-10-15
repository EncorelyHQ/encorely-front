import { createContext, useContext, type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, {
  makeMutable,
  measure,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useMotion } from './motion'
import { REVEAL, revealProgress } from './motionMath'
import { useScreenScroll } from './scroll'

// Progreso de la sección que contiene al hijo: StickerTitle se pega con el mismo valor.
const RevealContext = createContext<SharedValue<number> | null>(null)
const revealed = makeMutable(1)

export const useRevealProgress = () => useContext(RevealContext) ?? revealed

type ScrollRevealProps = { children: ReactNode; style?: StyleProp<ViewStyle> }

// Entra inclinada hacia atrás y sube a su sitio según cuánto asoma en el scroll. Solo transformaciones nativas.
export function ScrollReveal({ children, style }: ScrollRevealProps) {
  const { reduced } = useMotion()
  const scroll = useScreenScroll()
  const ref = useAnimatedRef<Animated.View>()
  const progress = useSharedValue(reduced ? 1 : 0)
  // Sube en cada onLayout para recalcular aunque no haya scroll (primera pintura, cambio de tamaño).
  const layoutTick = useSharedValue(0)

  useAnimatedReaction(
    () => [scroll.y.value, scroll.viewportBottom.value, layoutTick.value] as const,
    ([, viewportBottom]) => {
      if (reduced) {
        progress.value = 1
        return
      }
      const box = measure(ref)
      if (box) progress.value = revealProgress(viewportBottom, box.pageY)
    },
    [reduced],
  )

  const animated = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1, transform: [] }
    const rest = 1 - progress.value
    return {
      opacity: REVEAL.minOpacity + (1 - REVEAL.minOpacity) * progress.value,
      transform: [
        { perspective: 900 },
        { translateY: rest * REVEAL.shiftY },
        { rotateX: `${rest * REVEAL.tiltDeg}deg` },
      ],
    }
  })

  return (
    <RevealContext.Provider value={progress}>
      <Animated.View
        ref={ref}
        style={[{ transformOrigin: 'top' }, style, animated]}
        onLayout={() => layoutTick.set((tick) => tick + 1)}
      >
        {children}
      </Animated.View>
    </RevealContext.Provider>
  )
}
