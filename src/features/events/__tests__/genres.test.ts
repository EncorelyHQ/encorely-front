import { genreName, genresSentence, humanizeSlug, inSentence, joinSpanish } from '../genres'

const catalog = [
  { id: 1, slug: 'salsa', name: 'Salsa' },
  { id: 2, slug: 'rock-en-espanol', name: 'Rock en español' },
  { id: 3, slug: 'rnb', name: 'R&B' },
  { id: 4, slug: 'indie', name: 'Indie' },
]

describe('slug → nombre', () => {
  it('usa el nombre del catálogo', () => {
    expect(genreName('rock-en-espanol', catalog)).toBe('Rock en español')
  })

  it('capitaliza el slug si el catálogo no está', () => {
    expect(genreName('rock-en-espanol')).toBe('Rock en espanol')
    expect(genreName('desconocido', catalog)).toBe('Desconocido')
    expect(humanizeSlug('musica_llanera')).toBe('Musica llanera')
  })

  it('pasa a minúscula dentro de la frase salvo siglas', () => {
    expect(inSentence('Salsa')).toBe('salsa')
    expect(inSentence('R&B')).toBe('R&B')
    expect(inSentence('K-pop')).toBe('K-pop')
    expect(inSentence('EDM')).toBe('EDM')
  })
})

describe('frases en español', () => {
  it('une con comas y "y"', () => {
    expect(joinSpanish([])).toBe('')
    expect(joinSpanish(['salsa'])).toBe('salsa')
    expect(joinSpanish(['salsa', 'rock'])).toBe('salsa y rock')
    expect(joinSpanish(['rock en español', 'indie y alternativo'])).toBe('rock en español · indie y alternativo')
    expect(joinSpanish(['salsa', 'rock', 'jazz'])).toBe('salsa, rock y jazz')
  })

  it('cambia "y" por "e" ante sonido i', () => {
    expect(joinSpanish(['rock', 'indie'])).toBe('rock e indie')
    expect(joinSpanish(['rock', 'hip hop'])).toBe('rock e hip hop')
    expect(joinSpanish(['rock', 'hielo'])).toBe('rock y hielo')
  })

  it('arma la frase de géneros compartidos', () => {
    expect(genresSentence(['salsa', 'rock-en-espanol'], catalog)).toBe('salsa y rock en español')
    expect(genresSentence(['salsa', 'rnb', 'indie', 'rock-en-espanol'], catalog, 3)).toBe('salsa, R&B e indie')
  })
})
