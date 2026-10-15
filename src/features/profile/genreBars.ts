import type { DnaGenre } from '@/lib/api/types'

export type GenreBar = {
  slug: string
  name: string
  weight: number
  // Proporción respecto al género más fuerte (ya no define el largo de la barra: eso es `percent`).
  ratio: number
  // Porcentaje sobre el total de géneros con peso positivo. Las filas visibles (con "Otros") suman 100 exacto.
  percent: number
  // Fila que agrupa todo lo que no entró en el top.
  others?: true
}

export const OTHERS_SLUG = '__otros'

export const GENRE_BARS_LIMIT = 5

export function humanizeSlug(slug: string): string {
  const words = slug.replace(/[-_]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug
}

export function computeGenreBars(weights: readonly DnaGenre[], limit: number = GENRE_BARS_LIMIT): GenreBar[] {
  // Un peso <= 0 significa que no le gusta o no hay señal: no se dibuja como "su música".
  const totals = new Map<string, number>()
  const names = new Map<string, string>()
  for (const { genre, name, weight } of weights) {
    if (!genre || !Number.isFinite(weight) || weight <= 0) continue
    totals.set(genre, (totals.get(genre) ?? 0) + weight)
    if (name?.trim() && !names.has(genre)) names.set(genre, name.trim())
  }
  if (totals.size === 0) return []

  const total = [...totals.values()].reduce((sum, w) => sum + w, 0)

  const ranked = [...totals.entries()]
    .map(([slug, weight]) => ({ slug, weight, name: names.get(slug) ?? humanizeSlug(slug) }))
    // Empates: orden alfabético para que la lista no baile entre recargas.
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'es') || a.slug.localeCompare(b.slug))
  const top: Omit<GenreBar, 'ratio' | 'percent'>[] = ranked.slice(0, Math.max(0, limit))
  const restWeight = ranked.slice(top.length).reduce((sum, item) => sum + item.weight, 0)
  if (restWeight > 0) top.push({ slug: OTHERS_SLUG, name: 'Otros', weight: restWeight, others: true })

  const max = top[0]?.weight ?? 1
  const percents = largestRemainder(top.map((item) => (item.weight / total) * 100))
  return top.map((item, i) => ({ ...item, ratio: item.weight / max, percent: percents[i] }))
}

// Redondea para que la suma dé 100: los puntos que faltan van a quien tenía la parte decimal más grande.
// Redondear cada uno por separado daba 99 % o 101 %.
export function largestRemainder(values: readonly number[]): number[] {
  const floors = values.map(Math.floor)
  let missing = Math.round(values.reduce((sum, v) => sum + v, 0)) - floors.reduce((sum, v) => sum + v, 0)
  const order = values.map((v, i) => ({ i, frac: v - floors[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of order) {
    if (missing <= 0) break
    floors[i] += 1
    missing -= 1
  }
  return floors
}
