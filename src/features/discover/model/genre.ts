import type { Song } from '@/lib/api/types'

// El API ya manda el nombre legible; el slug presentable solo cubre un nombre vacío ("musica-urbana" → "Musica urbana").
export function songGenre(song: Pick<Song, 'genre' | 'genreName'>): string {
  if (song.genreName?.trim()) return song.genreName
  const text = song.genre.replace(/[-_]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
