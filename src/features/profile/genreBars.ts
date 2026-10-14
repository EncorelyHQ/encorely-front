import type { DnaGenre } from '@/lib/api/types'

export type GenreBar = {
  slug: string
  name: string
  weight: number
  // Largo de la barra: 1 para el género más fuerte, el resto en proporción a él.
  ratio: number
  // Porcentaje sobre el total de géneros con peso positivo (no solo del top), redondeado.
  percent: number
}

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

  const sorted = [...totals.entries()]
    .map(([slug, weight]) => ({ slug, weight, name: names.get(slug) ?? humanizeSlug(slug) }))
    // Empates: orden alfabético para que la lista no baile entre recargas.
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'es') || a.slug.localeCompare(b.slug))
    .slice(0, Math.max(0, limit))

  const max = sorted[0]?.weight ?? 1
  return sorted.map((item) => ({
    ...item,
    ratio: item.weight / max,
    percent: Math.round((item.weight / total) * 100),
  }))
}
