import type { EventSummary } from '@/lib/api/types'

export type EventSection = { key: 'going' | 'upcoming'; title: string; data: EventSummary[] }

const byDate = (a: EventSummary, b: EventSummary) => Date.parse(a.startsAt) - Date.parse(b.startsAt)

// "Vas a ir" primero porque es lo que el usuario vuelve a buscar; dentro de cada sección, lo más cercano arriba.
export function groupEvents(events: readonly EventSummary[]): EventSection[] {
  const going = events.filter((e) => e.iAmGoing).sort(byDate)
  const upcoming = events.filter((e) => !e.iAmGoing).sort(byDate)
  const sections: EventSection[] = []
  if (going.length) sections.push({ key: 'going', title: 'Vas a ir', data: going })
  if (upcoming.length) sections.push({ key: 'upcoming', title: 'Próximos', data: upcoming })
  return sections
}

export const CITY_CHIPS = ['Bogotá', 'Medellín'] as const

const normalizeCity = (city: string) =>
  city
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

export function sameCity(a: string, b: string): boolean {
  return normalizeCity(a) === normalizeCity(b)
}

// Chips: Todas · Bogotá · Medellín, más la ciudad del usuario si es otra (para que su filtro por defecto exista).
export function cityOptions(userCity?: string | null): string[] {
  const base: string[] = [...CITY_CHIPS]
  if (userCity && userCity.trim() && !base.some((c) => sameCity(c, userCity))) base.push(userCity.trim())
  return base
}

export function defaultCity(userCity?: string | null): string | undefined {
  if (!userCity || !userCity.trim()) return undefined
  return cityOptions(userCity).find((c) => sameCity(c, userCity))
}
