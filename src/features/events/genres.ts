import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { catalogApi } from '@/lib/api/endpoints'
import type { Genre } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'

// Respaldo cuando el catálogo no está en caché: "rock-en-espanol" → "Rock en espanol".
export function humanizeSlug(slug: string): string {
  const words = slug.split(/[-_]+/).filter(Boolean).join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function genreName(slug: string, genres?: readonly Genre[] | null): string {
  return genres?.find((g) => g.slug === slug)?.name ?? humanizeSlug(slug)
}

// Dentro de una frase los géneros van en minúscula ("les gusta salsa"), salvo siglas o nombres como "R&B" o "K-pop".
export function inSentence(name: string): string {
  if (name.length < 2) return name.toLowerCase()
  const second = name.charAt(1)
  const looksLikeWord = second !== second.toUpperCase()
  return looksLikeWord ? name.charAt(0).toLowerCase() + name.slice(1) : name
}

// "a", "a y b", "a, b y c"; "y" pasa a "e" ante sonido /i/ ("rock e indie"), salvo "hie-" ("y hielo").
export function joinSpanish(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  // Con nombres que ya traen "y" ("indie y alternativo") la conjunción vuelve ambigua la lista: se separa con punto medio.
  if (items.some((item) => / (y|e) /.test(item))) return items.join(' · ')
  const last = items[items.length - 1]
  const conj = /^(i|hi)(?!e)/i.test(last) || /^(í|hí)/i.test(last) ? 'e' : 'y'
  return `${items.slice(0, -1).join(', ')} ${conj} ${last}`
}

export function genresSentence(slugs: readonly string[], genres?: readonly Genre[] | null, max = 3): string {
  return joinSpanish(slugs.slice(0, max).map((s) => inSentence(genreName(s, genres))))
}

// El catálogo casi no cambia: se reusa la caché que dejó el onboarding y solo se pide si falta.
export function useGenreLookup() {
  const { data } = useQuery({
    queryKey: queryKeys.genres,
    queryFn: catalogApi.genres,
    staleTime: 24 * 60 * 60 * 1000,
  })
  const sentence = useCallback((slugs: readonly string[], max = 3) => genresSentence(slugs, data, max), [data])
  return { genres: data, sentence }
}
