import { computeGenreBars, humanizeSlug } from '../genreBars'

const names: Record<string, string> = {
  rock: 'Rock',
  salsa: 'Salsa',
  indie: 'Indie',
  electronica: 'Electrónica',
  pop: 'Pop',
  jazz: 'Jazz',
}

const g = (genre: string, weight: number) => ({ genre, name: names[genre] ?? '', weight })

describe('computeGenreBars', () => {
  it('ordena por peso y normaliza la barra contra el más fuerte', () => {
    const bars = computeGenreBars([g('salsa', 1), g('rock', 4), g('indie', 2)])
    expect(bars.map((b) => b.slug)).toEqual(['rock', 'indie', 'salsa'])
    expect(bars.map((b) => b.ratio)).toEqual([1, 0.5, 0.25])
  })

  it('el porcentaje es sobre el total de géneros positivos, no solo del top 5', () => {
    const bars = computeGenreBars([
      g('rock', 5),
      g('salsa', 1),
      g('indie', 1),
      g('electronica', 1),
      g('pop', 1),
      g('jazz', 1),
    ])
    expect(bars).toHaveLength(5)
    expect(bars[0]).toMatchObject({ slug: 'rock', percent: 50 })
    expect(bars.slice(1).every((b) => b.percent === 10)).toBe(true)
  })

  it('desempata por nombre legible para que el orden sea estable', () => {
    const bars = computeGenreBars([g('salsa', 2), g('electronica', 2), g('indie', 2)])
    expect(bars.map((b) => b.name)).toEqual(['Electrónica', 'Indie', 'Salsa'])
    expect(bars.every((b) => b.ratio === 1)).toBe(true)
  })

  it('ignora pesos cero, negativos o no numéricos y suma duplicados', () => {
    const bars = computeGenreBars([g('rock', 1), g('rock', 2), g('salsa', 0), g('pop', -3), g('jazz', Number.NaN)])
    expect(bars).toEqual([{ slug: 'rock', name: 'Rock', weight: 3, ratio: 1, percent: 100 }])
  })

  it('respeta el límite pedido', () => {
    expect(computeGenreBars([g('rock', 3), g('salsa', 2), g('indie', 1)], 2).map((b) => b.slug)).toEqual(['rock', 'salsa'])
  })

  it('devuelve vacío cuando no hay señal, para mostrar el estado vacío', () => {
    expect(computeGenreBars([])).toEqual([])
    expect(computeGenreBars([g('rock', 0)])).toEqual([])
  })

  it('usa el slug legible si el back no trae nombre', () => {
    const bars = computeGenreBars([{ genre: 'hip-hop', name: ' ', weight: 1 }])
    expect(bars[0].name).toBe('Hip hop')
    expect(humanizeSlug('vallenato_clasico')).toBe('Vallenato clasico')
  })
})
