import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { useMotion } from './motion'
import { PARALLAX, parallaxProgress } from './motionMath'
import { useScreenScroll } from './scroll'

type ParallaxTicketProps = { children: ReactNode; style?: StyleProp<ViewStyle> }

// La boleta de arriba se inclina y se aleja al bajar: deja claro que el contenido pasa por encima.
export function ParallaxTicket({ children, style }: ParallaxTicketProps) {
  const { reduced } = useMotion()
  const { y } = useScreenScroll()
  const animated = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1, transform: [] }
    const p = parallaxProgress(y.value)
    return {
      opacity: 1 - p * PARALLAX.fade,
      transform: [
        { perspective: 900 },
        { rotateX: `${p * PARALLAX.tiltDeg}deg` },
        { scale: 1 - p * (1 - PARALLAX.minScale) },
      ],
    }
  })
  return <Animated.View style={[{ transformOrigin: 'top' }, style, animated]}>{children}</Animated.View>
}
