import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { StyleSheet, View, useWindowDimensions, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { Image } from 'expo-image'
import type { Song, SwipeDirection } from '@/lib/api/types'
import { font, haptics, motion, radius, space, useStyles, type Theme } from '@/ui'
import { songGenre } from '../model/genre'
import { exitDuration, resolveSwipe, swipeThreshold } from '../model/swipe'
import { SongCard } from './SongCard'

const BACK_SCALE = 0.95
const MAX_ROTATION = 7
const EASE_OUT = Easing.bezier(...motion.easeOut)

type Role = 'top' | 'back' | 'leaving'
type Leaving = { song: Song; direction: SwipeDirection }

export type DeckHandle = { swipe: (direction: SwipeDirection) => void }

type SwipeDeckProps = {
  songs: Song[]
  onDecide: (song: Song, direction: SwipeDirection) => void
  isPlaying: boolean
  progress: SharedValue<number>
  onTogglePreview: () => void
}

// Pila de tarjetas: atrás la siguiente (escalada), arriba la activa y encima las que van saliendo.
// Todas en el mismo padre y con key = id: la de atrás se promueve y la de arriba sale sin remontarse.
export const SwipeDeck = forwardRef<DeckHandle, SwipeDeckProps>(function SwipeDeck(
  { songs, onDecide, isPlaying, progress, onTogglePreview },
  ref,
) {
  const styles = useStyles(makeStyles)
  const { width } = useWindowDimensions()
  const activeX = useSharedValue(0)
  const [leaving, setLeaving] = useState<Leaving[]>([])

  const top = songs[0]
  const back = songs[1]

  const decide = useCallback(
    (song: Song, direction: SwipeDirection) => {
      setLeaving((list) => (list.some((l) => l.song.id === song.id) ? list : [...list, { song, direction }]))
      onDecide(song, direction)
    },
    [onDecide],
  )

  const onExited = useCallback((id: string) => {
    setLeaving((list) => list.filter((l) => l.song.id !== id))
  }, [])

  useImperativeHandle(ref, () => ({ swipe: (direction) => (top ? decide(top, direction) : undefined) }), [decide, top])

  // La nueva tarjeta de arriba empieza centrada: la de atrás vuelve a su escala de reposo.
  const topId = top?.id
  useEffect(() => {
    activeX.value = 0
  }, [topId, activeX])

  // Portadas de las siguientes en caché antes de que lleguen arriba.
  const upcoming = useMemo(() => songs.slice(2, 5).map((s) => s.coverUrl), [songs])
  useEffect(() => {
    if (upcoming.length) {
      Image.prefetch(upcoming, 'memory-disk').catch((error: unknown) =>
        console.warn('[discover] No se pudieron precargar portadas', error),
      )
    }
  }, [upcoming])

  const cards: { song: Song; role: Role; direction?: SwipeDirection }[] = []
  if (back) cards.push({ song: back, role: 'back' })
  if (top) cards.push({ song: top, role: 'top' })
  for (const l of leaving) cards.push({ song: l.song, role: 'leaving', direction: l.direction })

  return (
    <View style={styles.deck}>
      {cards.map(({ song, role, direction }) => (
        <DeckCard
          key={song.id}
          song={song}
          role={role}
          exitDirection={direction}
          width={width}
          activeX={activeX}
          genre={songGenre(song)}
          isPlaying={role === 'top' && isPlaying}
          progress={role === 'top' ? progress : null}
          onDecide={decide}
          onExited={onExited}
          onTogglePreview={onTogglePreview}
        />
      ))}
    </View>
  )
})

type DeckCardProps = {
  song: Song
  role: Role
  exitDirection?: SwipeDirection
  width: number
  activeX: SharedValue<number>
  genre: string
  isPlaying: boolean
  progress: SharedValue<number> | null
  onDecide: (song: Song, direction: SwipeDirection) => void
  onExited: (id: string) => void
  onTogglePreview: () => void
}

const DeckCard = memo(function DeckCard({
  song,
  role,
  exitDirection,
  width,
  activeX,
  genre,
  isPlaying,
  progress,
  onDecide,
  onExited,
  onTogglePreview,
}: DeckCardProps) {
  const styles = useStyles(makeStyles)
  const reduced = useReducedMotion()
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const opacity = useSharedValue(1)
  const scale = useSharedValue(role === 'back' ? BACK_SCALE : 1)
  const isBack = useSharedValue(role === 'back')
  const crossed = useSharedValue(false)
  const startX = useSharedValue(0)
  const exiting = useSharedValue(false)
  const threshold = swipeThreshold(width)
  const exitX = width * 1.3

  // Atrás, la escala sigue al arrastre de la de arriba: continuidad sin saltos al promoverse.
  useAnimatedReaction(
    () => (isBack.value ? Math.min(1, Math.abs(activeX.value) / threshold) : -1),
    (p) => {
      if (p >= 0) scale.value = BACK_SCALE + (1 - BACK_SCALE) * p
    },
  )

  useEffect(() => {
    if (role === 'back') return
    if (isBack.value) {
      isBack.value = false
      scale.value = withTiming(1, { duration: motion.duration.fast, easing: EASE_OUT, reduceMotion: ReduceMotion.System })
    }
  }, [role, isBack, scale])

  // Salida por botón o por lector de pantalla: el gesto ya la arrancó en el hilo de UI.
  useEffect(() => {
    if (role !== 'leaving' || exiting.value) return
    exiting.value = true
    const id = song.id
    const done = (finished?: boolean) => {
      'worklet'
      if (finished) scheduleOnRN(onExited, id)
    }
    if (reduced) {
      // Alternativa sin movimiento: crossfade corto que conserva el cambio de estado.
      opacity.value = withTiming(0, { duration: 120 }, done)
      return
    }
    const sign = exitDirection === 'like' ? 1 : -1
    x.value = withTiming(sign * exitX, { duration: motion.duration.base, easing: EASE_OUT }, done)
  }, [role, exitDirection, exitX, exiting, onExited, opacity, reduced, song.id, x])

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(role === 'top')
        .maxPointers(1)
        .activeOffsetX([-12, 12])
        .failOffsetY([-24, 24])
        .onStart(() => {
          // Si la agarran mientras vuelve al centro, sigue desde donde está en vez de saltar.
          startX.value = x.value
        })
        .onUpdate((e) => {
          const nextX = startX.value + e.translationX
          x.value = nextX
          // Fricción vertical: la tarjeta acompaña al dedo sin despegarse del eje de decisión.
          y.value = e.translationY * 0.2
          activeX.value = nextX
          const past = Math.abs(nextX) >= threshold
          if (past && !crossed.value) {
            crossed.value = true
            scheduleOnRN(haptics.light)
          } else if (!past && crossed.value) {
            crossed.value = false
          }
        })
        .onEnd((e) => {
          const direction = resolveSwipe(x.value, e.velocityX, width)
          if (!direction) {
            x.value = withSpring(0, { ...motion.spring, velocity: e.velocityX, reduceMotion: ReduceMotion.System })
            y.value = withSpring(0, { ...motion.spring, reduceMotion: ReduceMotion.System })
            activeX.value = withSpring(0, { ...motion.spring, reduceMotion: ReduceMotion.System })
            crossed.value = false
            return
          }
          exiting.value = true
          const sign = direction === 'like' ? 1 : -1
          const id = song.id
          x.value = withTiming(
            sign * exitX,
            { duration: exitDuration(sign * exitX - x.value, e.velocityX), easing: EASE_OUT },
            (finished) => {
              if (finished) scheduleOnRN(onExited, id)
            },
          )
          scheduleOnRN(onDecide, song, direction)
        }),
    [role, threshold, width, exitX, song, x, y, startX, activeX, crossed, exiting, onDecide, onExited],
  )

  // Con reduced motion la tarjeta sigue al dedo (lo mueve el usuario) pero sin girar.
  const maxRotation = reduced ? 0 : MAX_ROTATION
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, 0, width], [-maxRotation, 0, maxRotation])}deg` },
      { scale: scale.value },
    ],
  }))
  const likeStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [0, threshold], [0, 1], 'clamp') }))
  const passStamp = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-threshold, 0], [1, 0], 'clamp') }))

  const onAction = useCallback(
    (e: AccessibilityActionEvent) => {
      const name = e.nativeEvent.actionName
      if (name === 'like' || name === 'dislike') onDecide(song, name)
      else if (name === 'play') onTogglePreview()
    },
    [onDecide, onTogglePreview, song],
  )

  const actions = useMemo(
    () => [
      { name: 'like', label: 'Me gusta' },
      { name: 'dislike', label: 'Paso' },
      ...(song.previewUrl ? [{ name: 'play', label: isPlaying ? 'Pausar vista previa' : 'Reproducir vista previa' }] : []),
    ],
    [isPlaying, song.previewUrl],
  )

  const isTop = role === 'top'
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={role === 'back' ? FadeIn.duration(motion.duration.base).reduceMotion(ReduceMotion.System) : undefined}
        pointerEvents={isTop ? 'auto' : 'none'}
        style={[styles.slot, cardStyle]}
        accessible={isTop}
        importantForAccessibility={isTop ? 'yes' : 'no-hide-descendants'}
        accessibilityElementsHidden={!isTop}
        accessibilityLabel={`${song.title}, ${song.artist}, ${genre}`}
        accessibilityHint="Desliza a la derecha si te gusta o a la izquierda para pasar. También puedes usar los botones de abajo."
        accessibilityActions={isTop ? actions : undefined}
        onAccessibilityAction={isTop ? onAction : undefined}
      >
        <SongCard song={song} genre={genre} isPlaying={isPlaying} progress={progress} />
        <Animated.View style={[styles.stamp, styles.stampLike, likeStamp]} pointerEvents="none">
          <Animated.Text style={[styles.stampText, styles.stampTextLike]} maxFontSizeMultiplier={1.3}>
            ME GUSTA
          </Animated.Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampPass, passStamp]} pointerEvents="none">
          <Animated.Text style={[styles.stampText, styles.stampTextPass]} maxFontSizeMultiplier={1.3}>
            PASO
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
})

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    deck: { flex: 1 },
    slot: StyleSheet.absoluteFill,
    // Sellos rectos de cartel, como el que ponen en la entrada; nada de bordes gruesos rotados.
    stamp: {
      position: 'absolute',
      top: space.xl,
      paddingHorizontal: space.md,
      paddingVertical: space.xs,
      borderRadius: radius.sm,
    },
    stampLike: { left: space.lg, backgroundColor: t.accent },
    stampPass: { right: space.lg, backgroundColor: t.ticket },
    stampText: { fontFamily: font.display, fontSize: 32, lineHeight: 34, letterSpacing: 1 },
    stampTextLike: { color: t.onAccent },
    stampTextPass: { color: t.onTicket },
  })
