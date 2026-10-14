import type { Dna } from '@/lib/api/types'
import { applySwipeResult, radarProgress, remainingToRadar, songsWord } from '../model/radar'

const dna = (swipeCount: number, radarUnlocked = false): Dna => ({
  genres: [],
  swipeCount,
  radarThreshold: 15,
  radarUnlocked,
})

describe('cuánto falta para el radar', () => {
  it('calcula las canciones que faltan sin bajar de cero', () => {
    expect(remainingToRadar(8, 15)).toBe(7)
    expect(remainingToRadar(15, 15)).toBe(0)
    expect(remainingToRadar(20, 15)).toBe(0)
  })

  it('acota el progreso entre 0 y 1', () => {
    expect(radarProgress(0, 15)).toBe(0)
    expect(radarProgress(3, 15)).toBeCloseTo(0.2)
    expect(radarProgress(40, 15)).toBe(1)
    expect(radarProgress(0, 0)).toBe(1)
  })

  it('concuerda en singular y plural', () => {
    expect(songsWord(1)).toBe('canción')
    expect(songsWord(7)).toBe('canciones')
  })
})

describe('applySwipeResult', () => {
  it('actualiza el conteo con el dato real del servidor', () => {
    const { next, unlockedNow } = applySwipeResult(dna(8), { counted: true, swipeCount: 9 })
    expect(next.swipeCount).toBe(9)
    expect(unlockedNow).toBe(false)
  })

  it('no retrocede si las respuestas llegan desordenadas', () => {
    expect(applySwipeResult(dna(10), { counted: true, swipeCount: 9 }).next.swipeCount).toBe(10)
  })

  it('avisa el desbloqueo solo al cruzar el umbral', () => {
    expect(applySwipeResult(dna(14), { counted: true, swipeCount: 15 }).unlockedNow).toBe(true)
    expect(applySwipeResult(dna(15, true), { counted: true, swipeCount: 16 }).unlockedNow).toBe(false)
  })
})
