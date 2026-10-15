import { allGenresUnmapped } from '../spotifyApi'

const payload = (...genres: string[][]) => ({ topArtists: genres.map((g, i) => ({ name: `A${i}`, genres: g })) })

describe('allGenresUnmapped (draft.12)', () => {
  it('avisa cuando ningún género aportó al ADN, sin importar mayúsculas ni espacios', () => {
    expect(allGenresUnmapped(payload(['Shoegaze'], ['vaporwave']), ['shoegaze', ' Vaporwave '])).toBe(true)
  })

  it('no avisa si al menos uno sí aportó o si no se mandó ningún género', () => {
    expect(allGenresUnmapped(payload(['rock', 'shoegaze']), ['shoegaze'])).toBe(false)
    expect(allGenresUnmapped(payload([], []), [])).toBe(false)
  })
})
