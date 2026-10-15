import { useEffect, useState } from 'react'
import { StyleSheet, Text as RNText, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, Keyframe, useAnimatedStyle } from 'react-native-reanimated'
import { haptics } from './haptics'
import { useMotion } from './motion'
import { stickerAngle } from './motionMath'
import { useRevealProgress } from './ScrollReveal'
import { font, motion, sticker, type StickerTone } from './tokens'

export type StickerSize = 'title' | 'chip' | 'tag'

const SIZES = {
  title: { fontSize: 26, paddingVertical: 7, paddingHorizontal: 14 },
  chip: { fontSize: 20, paddingVertical: 7, paddingHorizontal: 12 },
  tag: { fontSize: 12, paddingVertical: 4, paddingHorizontal: 8 },
} as const

// Big Shoulders es condensada: con más de 1,3× ya no cabe ni en un chip.
const MAX_FONT_SCALE = 1.3
const CUT = 3
const SHADOW = { x: 3, y: 4 }

type StickerFaceProps = {
  label: string
  tone?: StickerTone
  size?: StickerSize
  accessible?: boolean
}

// La cara del sticker sin rotación: borde de corte claro y una sombra dura que es una View desplazada detrás,
// porque en Android `elevation` siempre difumina.
function StickerFace({ label, tone = 'paper', size = 'chip', accessible }: StickerFaceProps) {
  const colors = sticker[tone]
  const s = SIZES[size]
  return (
    <View style={styles.wrap}>
      <View style={[styles.shadow, { borderRadius: radiusFor(size) }]} />
      <View
        style={[styles.face, { backgroundColor: colors.bg, borderRadius: radiusFor(size), paddingVertical: s.paddingVertical, paddingHorizontal: s.paddingHorizontal }]}
      >
        <RNText
          accessible={accessible}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.label, { color: colors.fg, fontSize: s.fontSize, lineHeight: Math.round(s.fontSize * 1.05) }]}
        >
          {label}
        </RNText>
      </View>
    </View>
  )
}

const radiusFor = (size: StickerSize) => (size === 'tag' ? 6 : 10)

type StickerProps = StickerFaceProps & {
  // Ángulo fijo en grados: lo decide quien lo pega, así no baila entre renders.
  angle?: number
  style?: StyleProp<ViewStyle>
}

export function Sticker({ angle = 0, style, ...face }: StickerProps) {
  const { fontScale } = useWindowDimensions()
  return (
    <View style={[styles.self, { transform: [{ rotate: `${stickerAngle(angle, fontScale)}deg` }] }, style]}>
      <StickerFace {...face} />
    </View>
  )
}

// Título de sección que se pega a medida que la sección entra: mismo progreso que su ScrollReveal.
export function StickerTitle({ label, tone = 'paper', angle = -2, style }: Omit<StickerProps, 'size'>) {
  const { reduced } = useMotion()
  const { fontScale } = useWindowDimensions()
  const progress = useRevealProgress()
  const finalAngle = stickerAngle(angle, fontScale)
  const animated = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ rotate: `${finalAngle}deg` }] }
    const q = progress.value
    return { transform: [{ rotate: `${finalAngle * q}deg` }, { scale: 1 + 0.14 * (1 - q) }] }
  })
  return (
    <Animated.View style={[styles.self, style, animated]} accessibilityRole="header">
      <StickerFace label={label} tone={tone} size="title" />
    </Animated.View>
  )
}

// Pegada: cae desde arriba más grande, rebota un poco y queda en su ángulo. Recrea el keyframe del prototipo.
const placeKeyframe = (angle: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 1.6 }, { rotate: '0deg' }] },
    55: { opacity: 1, transform: [{ scale: 0.94 }, { rotate: `${angle + Math.sign(angle || 1)}deg` }], easing: Easing.bezier(...motion.easeOut) },
    100: { opacity: 1, transform: [{ scale: 1 }, { rotate: `${angle}deg` }], easing: Easing.bezier(...motion.easeOut) },
  }).duration(PLACE_MS)

export const PLACE_MS = 440
const TAG_BOX = 220

type ReactionTagProps = {
  label: string
  // De qué lado se ancla al sticker o tarjeta (con `right` o `left` en style). Crece hacia el lado contrario.
  anchor?: 'right' | 'left'
  tone?: StickerTone
  angle?: number
  // true solo cuando la persona la acaba de poner: así no rebotan todas al abrir el perfil.
  justPlaced?: boolean
  style?: StyleProp<ViewStyle>
}

// Etiqueta chica que se pega sobre un sticker o una tarjeta (la reacción que dejaste).
export function ReactionTag({ label, anchor = 'right', tone = 'band', angle = 5, justPlaced = false, style }: ReactionTagProps) {
  const { reduced, reduceMotion } = useMotion()
  const { fontScale } = useWindowDimensions()
  const finalAngle = stickerAngle(angle, fontScale)
  // Se fija al montar: si después cambia la prop, la etiqueta no vuelve a rebotar.
  const [placed] = useState(justPlaced)

  useEffect(() => {
    if (placed) haptics.selection()
  }, [placed])

  // Un absoluto toma como máximo el ancho de su padre: sobre un sticker angosto ("Salsa") la etiqueta se partía en
  // dos líneas. La caja ancha y transparente le da espacio; pointerEvents="none" para no robar toques.
  return (
    <View pointerEvents="none" style={[styles.tagBox, anchor === 'right' ? styles.tagRight : styles.tagLeft, style]}>
      <Animated.View
        entering={placed && !reduced ? placeKeyframe(finalAngle).reduceMotion(reduceMotion) : undefined}
        style={{ transform: [{ rotate: `${finalAngle}deg` }] }}
      >
        <StickerFace label={label} tone={tone} size="tag" accessible={false} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  self: { alignSelf: 'flex-start' },
  wrap: { position: 'relative' },
  shadow: {
    position: 'absolute',
    top: SHADOW.y,
    left: SHADOW.x,
    right: -SHADOW.x,
    bottom: -SHADOW.y,
    backgroundColor: sticker.shadow,
  },
  face: { borderWidth: CUT, borderColor: sticker.cut, flexShrink: 1 },
  label: { fontFamily: font.display, textTransform: 'uppercase', letterSpacing: 0.4, includeFontPadding: false },
  tagBox: { position: 'absolute', zIndex: 2, width: TAG_BOX },
  tagRight: { alignItems: 'flex-end' },
  tagLeft: { alignItems: 'flex-start' },
})
