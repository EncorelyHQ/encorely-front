import { ApiError } from '@/lib/api/errors'
import type { Song } from '@/lib/api/types'

// Cuando quedan estas tarjetas o menos se pide otra tanda: el usuario nunca ve la cola vacía mientras llega la red.
export const PREFETCH_AT = 5
export const FEED_PAGE = 20

export type QueueState = {
  items: Song[]
  // Ids ya decididos en esta sesión (confirmados o en vuelo): el feed puede devolverlos mientras el POST no llega.
  decided: ReadonlySet<string>
  // La última tanda no trajo nada nuevo: no seguimos pidiendo en bucle.
  exhausted: boolean
}

export type QueueAction =
  | { type: 'received'; songs: Song[] }
  | { type: 'decided'; songId: string }
  | { type: 'failed'; song: Song }

export const initialQueue: QueueState = { items: [], decided: new Set(), exhausted: false }

export function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'received': {
      const known = new Set(state.items.map((s) => s.id))
      const fresh: Song[] = []
      for (const song of action.songs) {
        if (known.has(song.id) || state.decided.has(song.id)) continue
        known.add(song.id)
        fresh.push(song)
      }
      return { ...state, items: fresh.length ? [...state.items, ...fresh] : state.items, exhausted: fresh.length === 0 }
    }
    case 'decided': {
      if (state.decided.has(action.songId)) return state
      const decided = new Set(state.decided)
      decided.add(action.songId)
      // Lo que antes llegó repetido pudo estar en vuelo: tras cada decisión vale la pena volver a preguntar.
      return { items: state.items.filter((s) => s.id !== action.songId), decided, exhausted: false }
    }
    case 'failed': {
      const decided = new Set(state.decided)
      decided.delete(action.song.id)
      const already = state.items.some((s) => s.id === action.song.id)
      return { ...state, decided, items: already ? state.items : [...state.items, action.song] }
    }
  }
}

export function shouldPrefetch(state: QueueState, threshold = PREFETCH_AT): boolean {
  return !state.exhausted && state.items.length <= threshold
}

// Un 4xx de validación o de "ya no existe" no se arregla reintentando: volver a mostrar la canción sería un bucle.
// Red, timeout, 5xx, 408 y 429 sí son pasajeros.
export function shouldRequeue(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true
  if (error.kind === 'sessionExpired' || error.kind === 'config') return false
  if (error.kind !== 'http') return true
  if (error.status === 408 || error.status === 429) return true
  return error.status >= 500
}
