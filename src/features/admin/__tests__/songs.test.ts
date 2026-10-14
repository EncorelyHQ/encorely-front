import { filterSongs, guessGenre, songToRequest, trackToRequest, validateSongForm } from '../model/songs'
import type { AdminSong } from '../types'

const song = (over: Partial<AdminSong>): AdminSong => ({
  id: 's',
  title: 'Fuego',
  artist: 'Bomba Estéreo',
  genre: 'electronica',
  coverUrl: 'https://img/x.jpg',
  previewUrl: 'https://audio/x.m4a',
  iTunesTrackId: 1,
  isActive: true,
  likes: 2,
  dislikes: 1,
  ...over,
})

const genres = [
  { id: 1, slug: 'rock', name: 'Rock' },
  { id: 2, slug: 'electronica', name: 'Electrónica' },
  { id: 3, slug: 'latin', name: 'Latina' },
]

describe('canciones', () => {
  it('busca por título o artista sin importar tildes ni mayúsculas', () => {
    const list = [song({ id: 'a' }), song({ id: 'b', title: 'Canción', artist: 'Systema Solar' })]
    expect(filterSongs(list, 'estereo').map((s) => s.id)).toEqual(['a'])
    expect(filterSongs(list, 'CANCION').map((s) => s.id)).toEqual(['b'])
    expect(filterSongs(list, '  ')).toHaveLength(2)
  })

  it('el PUT conserva todo lo demás al cambiar solo isActive', () => {
    expect(songToRequest(song({}), { isActive: false })).toEqual({
      title: 'Fuego',
      artist: 'Bomba Estéreo',
      genre: 'electronica',
      coverUrl: 'https://img/x.jpg',
      previewUrl: 'https://audio/x.m4a',
      iTunesTrackId: 1,
      isActive: false,
    })
  })

  it('una canción de iTunes entra activa con el género elegido', () => {
    const track = { iTunesTrackId: 9, title: 'T', artist: 'A', coverUrl: 'https://c', previewUrl: null, primaryGenre: 'Rock' }
    expect(trackToRequest(track, 'rock')).toEqual({
      title: 'T',
      artist: 'A',
      genre: 'rock',
      coverUrl: 'https://c',
      previewUrl: null,
      iTunesTrackId: 9,
      isActive: true,
    })
  })

  it('sugiere el género del catálogo si coincide con el de iTunes', () => {
    expect(guessGenre('Electronica', genres)).toBe('electronica')
    expect(guessGenre('Rock', genres)).toBe('rock')
    expect(guessGenre('Reggaeton', genres)).toBeNull()
    expect(guessGenre(null, genres)).toBeNull()
  })

  it('valida el formulario de edición', () => {
    const ok = { title: 'T', artist: 'A', genre: 'rock', coverUrl: 'https://img.co/c.jpg', previewUrl: '', isActive: true }
    expect(validateSongForm(ok)).toEqual({})
    expect(validateSongForm({ ...ok, title: ' ', genre: '', coverUrl: 'c.jpg', previewUrl: 'x' })).toEqual({
      title: 'Escribe el título.',
      genre: 'Elige un género.',
      coverUrl: expect.any(String),
      previewUrl: expect.any(String),
    })
  })
})
