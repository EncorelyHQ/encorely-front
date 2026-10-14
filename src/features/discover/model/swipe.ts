import type { SwipeDirection } from '@/lib/api/types'

// Fracción del ancho que hay que arrastrar para decidir, o velocidad (px/s) de un lanzamiento corto.
export const DISTANCE_RATIO = 0.28
export const FLING_VELOCITY = 900
// Un lanzamiento necesita un mínimo de recorrido: evita decidir por un temblor rápido del dedo.
const FLING_MIN_RATIO = 0.08

export function swipeThreshold(width: number): number {
  'worklet'
  return width * DISTANCE_RATIO
}

export function resolveSwipe(translationX: number, velocityX: number, width: number): SwipeDirection | null {
  'worklet'
  const distance = swipeThreshold(width)
  if (translationX >= distance) return 'like'
  if (translationX <= -distance) return 'dislike'
  const flung = Math.abs(velocityX) >= FLING_VELOCITY && Math.abs(translationX) >= width * FLING_MIN_RATIO
  if (flung && Math.sign(velocityX) === Math.sign(translationX)) return velocityX > 0 ? 'like' : 'dislike'
  return null
}

// Duración de salida según la velocidad del dedo: un lanzamiento rápido sale rápido (inercia), uno lento no se arrastra.
export function exitDuration(remaining: number, velocityX: number): number {
  'worklet'
  const speed = Math.max(Math.abs(velocityX), 1400)
  return Math.min(260, Math.max(140, (Math.abs(remaining) / speed) * 1000))
}
