import type { Dna, SwipeResult } from '@/lib/api/types'

export function remainingToRadar(swipeCount: number, threshold: number): number {
  return Math.max(0, threshold - swipeCount)
}

export function radarProgress(swipeCount: number, threshold: number): number {
  if (threshold <= 0) return 1
  return Math.min(1, Math.max(0, swipeCount / threshold))
}

export function songsWord(n: number): string {
  return n === 1 ? 'canción' : 'canciones'
}

// Aplica la respuesta del POST al ADN en caché. El conteo puede llegar desordenado si hay varios POST en vuelo,
// por eso nunca baja. El desbloqueo se deriva del umbral del servidor (403 radar_locked si swipes < umbral).
export function applySwipeResult(dna: Dna, result: SwipeResult): { next: Dna; unlockedNow: boolean } {
  const swipeCount = Math.max(dna.swipeCount, result.swipeCount)
  const radarUnlocked = dna.radarUnlocked || swipeCount >= dna.radarThreshold
  return { next: { ...dna, swipeCount, radarUnlocked }, unlockedNow: !dna.radarUnlocked && radarUnlocked }
}
