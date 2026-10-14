import { ApiError } from '@/lib/api/errors'
import type { Song } from '@/lib/api/types'
import { initialQueue, queueReducer, shouldPrefetch, shouldRequeue, type QueueState } from '../model/queue'

const song = (id: string): Song => ({
  id,
  title: `Canción ${id}`,
  artist: 'Artista',
  genre: 'rock',
  genreName: 'Rock',
  coverUrl: `https://example.test/${id}.jpg`,
  previewUrl: null,
})

const songs = (...ids: string[]) => ids.map(song)
const ids = (state: QueueState) => state.items.map((s) => s.id)

describe('queueReducer', () => {
  it('agrega canciones nuevas sin duplicar por id', () => {
    let state = queueReducer(initialQueue, { type: 'received', songs: songs('a', 'b', 'a') })
    state = queueReducer(state, { type: 'received', songs: songs('b', 'c') })
    expect(ids(state)).toEqual(['a', 'b', 'c'])
    expect(state.exhausted).toBe(false)
  })

  it('no vuelve a mostrar una canción ya decidida aunque el feed la devuelva', () => {
    let state = queueReducer(initialQueue, { type: 'received', songs: songs('a', 'b') })
    state = queueReducer(state, { type: 'decided', songId: 'a' })
    state = queueReducer(state, { type: 'received', songs: songs('a', 'c') })
    expect(ids(state)).toEqual(['b', 'c'])
  })

  it('marca la cola como agotada cuando una tanda no trae nada nuevo', () => {
    let state = queueReducer(initialQueue, { type: 'received', songs: songs('a') })
    state = queueReducer(state, { type: 'received', songs: songs('a') })
    expect(state.exhausted).toBe(true)
    // Tras decidir se vuelve a preguntar: lo repetido pudo estar en vuelo.
    state = queueReducer(state, { type: 'decided', songId: 'a' })
    expect(state.exhausted).toBe(false)
  })

  it('reencola al final la canción cuyo POST falló y deja de tratarla como decidida', () => {
    let state = queueReducer(initialQueue, { type: 'received', songs: songs('a', 'b', 'c') })
    state = queueReducer(state, { type: 'decided', songId: 'a' })
    state = queueReducer(state, { type: 'failed', song: song('a') })
    expect(ids(state)).toEqual(['b', 'c', 'a'])
    expect(state.decided.has('a')).toBe(false)
  })

  it('no duplica al reencolar si la canción ya volvió por el feed', () => {
    let state = queueReducer(initialQueue, { type: 'received', songs: songs('a', 'b') })
    state = queueReducer(state, { type: 'decided', songId: 'a' })
    state = queueReducer(state, { type: 'failed', song: song('a') })
    state = queueReducer(state, { type: 'failed', song: song('a') })
    expect(ids(state)).toEqual(['b', 'a'])
  })

  it('ignora una decisión repetida sobre la misma canción', () => {
    const state = queueReducer(queueReducer(initialQueue, { type: 'received', songs: songs('a') }), {
      type: 'decided',
      songId: 'a',
    })
    expect(queueReducer(state, { type: 'decided', songId: 'a' })).toBe(state)
  })
})

describe('shouldPrefetch', () => {
  const withItems = (n: number): QueueState =>
    queueReducer(initialQueue, { type: 'received', songs: Array.from({ length: n }, (_, i) => song(String(i))) })

  it('pide más cuando quedan 5 o menos', () => {
    expect(shouldPrefetch(withItems(6))).toBe(false)
    expect(shouldPrefetch(withItems(5))).toBe(true)
    expect(shouldPrefetch(initialQueue)).toBe(true)
  })

  it('no pide en bucle si el catálogo se agotó', () => {
    expect(shouldPrefetch({ ...withItems(2), exhausted: true })).toBe(false)
  })
})

describe('shouldRequeue', () => {
  it('reencola fallas pasajeras', () => {
    expect(shouldRequeue(new ApiError('network', 'x'))).toBe(true)
    expect(shouldRequeue(new ApiError('timeout', 'x'))).toBe(true)
    expect(shouldRequeue(new ApiError('http', 'x', { status: 503 }))).toBe(true)
    expect(shouldRequeue(new ApiError('http', 'x', { status: 429 }))).toBe(true)
    expect(shouldRequeue(new Error('desconocido'))).toBe(true)
  })

  it('no reencola lo que reintentar no arregla', () => {
    expect(shouldRequeue(new ApiError('http', 'x', { status: 404 }))).toBe(false)
    expect(shouldRequeue(new ApiError('http', 'x', { status: 400 }))).toBe(false)
    expect(shouldRequeue(new ApiError('sessionExpired', 'x'))).toBe(false)
  })
})
