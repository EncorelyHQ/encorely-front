import type { Genre } from '@/lib/api/types'

// El back acepta hasta 10; 8 obliga a elegir lo que de verdad escuchas sin quedarse corto.
export const MIN_GENRES = 1
export const MAX_GENRES = 8

export function toggleGenre(selected: readonly string[], slug: string, max = MAX_GENRES): string[] {
  if (selected.includes(slug)) return selected.filter((item) => item !== slug)
  if (selected.length >= max) return [...selected]
  return [...selected, slug]
}

// Un slug guardado que ya no existe en el catálogo haría fallar el PATCH con unknown_genre.
export function knownGenres(selected: readonly string[], catalog: readonly Genre[]): string[] {
  const slugs = new Set(catalog.map((genre) => genre.slug))
  return selected.filter((slug) => slugs.has(slug)).slice(0, MAX_GENRES)
}
