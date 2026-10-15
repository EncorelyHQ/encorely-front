import type { SpotifyImportRequest } from '@/lib/api/types'
import { MAX_ARTIST_GENRES, MAX_ARTIST_NAME, MAX_IMPORT_ARTISTS, SPOTIFY_API_BASE } from './config'
import { spotifyErrorFromStatus } from './errors'
import { readJson, spotifyFetch } from './http'

export type ImportArtist = SpotifyImportRequest['topArtists'][number]

// medium_term (~6 meses) refleja gustos estables; short_term se deja llevar por la canción de la semana.
export const TOP_ARTISTS_PATH = `/me/top/artists?limit=${MAX_IMPORT_ARTISTS}&time_range=medium_term`

export async function getTopArtists(accessToken: string): Promise<unknown[]> {
  const response = await spotifyFetch(`${SPOTIFY_API_BASE}${TOP_ARTISTS_PATH}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!response.ok) throw spotifyErrorFromStatus(response.status)
  const data = await readJson(response)
  return Array.isArray(data?.items) ? data.items : []
}

// Al back viaja {name, genres, imageUrl?}: ni ids ni nada que identifique la cuenta de Spotify. La foto es del artista
// y se muestra en el perfil público.
export function toImportPayload(items: readonly unknown[]): SpotifyImportRequest {
  const seen = new Set<string>()
  const topArtists: ImportArtist[] = []
  for (const item of items) {
    if (topArtists.length >= MAX_IMPORT_ARTISTS) break
    if (!item || typeof item !== 'object') continue
    const { name, genres, images } = item as { name?: unknown; genres?: unknown; images?: unknown }
    if (typeof name !== 'string') continue
    const clean = name.trim().slice(0, MAX_ARTIST_NAME)
    const key = clean.toLocaleLowerCase()
    if (!clean || seen.has(key)) continue
    seen.add(key)
    const imageUrl = artistImage(images)
    topArtists.push(imageUrl ? { name: clean, genres: cleanGenres(genres), imageUrl } : { name: clean, genres: cleanGenres(genres) })
  }
  return { topArtists }
}

// Spotify ordena las imágenes de mayor a menor. El back descarta en silencio lo que no sea del CDN de Spotify:
// se filtra aquí también para no mandar URLs que se van a ignorar.
const SPOTIFY_IMAGE_HOST = 'https://i.scdn.co/'

function artistImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null
  const url = (images[0] as { url?: unknown } | undefined)?.url
  return typeof url === 'string' && url.startsWith(SPOTIFY_IMAGE_HOST) ? url : null
}

// Spotify devuelve géneros vacíos para muchos artistas: se envía [] y el back decide cómo pesarlo.
function cleanGenres(genres: unknown): string[] {
  if (!Array.isArray(genres)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const genre of genres) {
    if (out.length >= MAX_ARTIST_GENRES) break
    if (typeof genre !== 'string') continue
    const clean = genre.trim()
    const key = clean.toLocaleLowerCase()
    if (!clean || seen.has(key)) continue
    seen.add(key)
    out.push(clean)
  }
  return out
}
