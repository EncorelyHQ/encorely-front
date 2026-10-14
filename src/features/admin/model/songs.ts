import type { Genre } from '@/lib/api/types'
import type { AdminSong, AdminSongRequest, ITunesTrack } from '../types'

// Límite del back para GET /admin/songs: la búsqueda local solo ve estas.
export const SONGS_PAGE_CAP = 200

export const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

export function filterSongs(songs: readonly AdminSong[], query: string): AdminSong[] {
  const q = fold(query)
  if (!q) return [...songs]
  return songs.filter((s) => fold(s.title).includes(q) || fold(s.artist).includes(q))
}

// El PUT pide la canción completa: se parte de lo que hay y se cambia solo lo pedido.
export function songToRequest(song: AdminSong, changes: Partial<AdminSongRequest> = {}): AdminSongRequest {
  return {
    title: song.title,
    artist: song.artist,
    genre: song.genre,
    coverUrl: song.coverUrl,
    previewUrl: song.previewUrl,
    iTunesTrackId: song.iTunesTrackId,
    isActive: song.isActive,
    ...changes,
  }
}

export function trackToRequest(track: ITunesTrack, genre: string): AdminSongRequest {
  return {
    title: track.title,
    artist: track.artist,
    genre,
    coverUrl: track.coverUrl,
    previewUrl: track.previewUrl,
    iTunesTrackId: track.iTunesTrackId,
    isActive: true,
  }
}

// iTunes trae su propio género ("Latin", "Rock"); si coincide con uno del catálogo, se preselecciona.
export function guessGenre(primaryGenre: string | null, genres: readonly Genre[] | undefined): string | null {
  if (!primaryGenre || !genres) return null
  const target = fold(primaryGenre)
  const hit = genres.find((g) => fold(g.name) === target || fold(g.slug.replace(/[-_]+/g, ' ')) === target)
  return hit?.slug ?? null
}

export type SongFormValues = {
  title: string
  artist: string
  genre: string
  coverUrl: string
  previewUrl: string
  isActive: boolean
}

export type SongFormErrors = Partial<Record<'title' | 'artist' | 'genre' | 'coverUrl' | 'previewUrl', string>>

const URL_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i
const URL_MAX = 500
const TEXT_MAX = 200

export function songToForm(song: AdminSong): SongFormValues {
  return {
    title: song.title,
    artist: song.artist,
    genre: song.genre,
    coverUrl: song.coverUrl,
    previewUrl: song.previewUrl ?? '',
    isActive: song.isActive,
  }
}

export function validateSongForm(values: SongFormValues): SongFormErrors {
  const errors: SongFormErrors = {}
  const title = values.title.trim()
  const artist = values.artist.trim()
  if (!title) errors.title = 'Escribe el título.'
  else if (title.length > TEXT_MAX) errors.title = `Máximo ${TEXT_MAX} caracteres.`
  if (!artist) errors.artist = 'Escribe el artista.'
  else if (artist.length > TEXT_MAX) errors.artist = `Máximo ${TEXT_MAX} caracteres.`
  if (!values.genre) errors.genre = 'Elige un género.'
  const cover = values.coverUrl.trim()
  if (!cover) errors.coverUrl = 'La portada es obligatoria.'
  else if (cover.length > URL_MAX || !URL_PATTERN.test(cover)) errors.coverUrl = 'Pega una dirección completa que empiece por https://.'
  const preview = values.previewUrl.trim()
  if (preview && (preview.length > URL_MAX || !URL_PATTERN.test(preview)))
    errors.previewUrl = 'Pega una dirección completa que empiece por https://.'
  return errors
}

export function formToSongRequest(song: AdminSong, values: SongFormValues): AdminSongRequest {
  return songToRequest(song, {
    title: values.title.trim(),
    artist: values.artist.trim(),
    genre: values.genre,
    coverUrl: values.coverUrl.trim(),
    previewUrl: values.previewUrl.trim() || null,
    isActive: values.isActive,
  })
}

export function songStatsLabel(song: AdminSong): string {
  const likes = song.likes === 1 ? '1 me gusta' : `${song.likes} me gusta`
  const passes = song.dislikes === 1 ? '1 paso' : `${song.dislikes} pasos`
  return `${likes} · ${passes}`
}
