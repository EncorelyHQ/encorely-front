import type { MatchSummary } from '@/lib/api/types'

export type GenreSentence = (slugs: readonly string[], max?: number) => string

// El motivo real del match, nunca relleno: si el servidor no manda evento ni géneros, se dice solo que hicieron match.
export function matchReason(match: Pick<MatchSummary, 'eventName' | 'sharedGenres'>, genres: GenreSentence): string {
  const event = match.eventName?.trim()
  const liked = match.sharedGenres.length ? genres(match.sharedGenres, 1) : ''
  if (event && liked) return `Los dos van a ${event} · les gusta ${liked}`
  if (event) return `Los dos van a ${event}`
  if (liked) return `A los dos les gusta ${genres(match.sharedGenres, 2)}`
  return 'Hicieron match'
}

export function introTitle(match: Pick<MatchSummary, 'eventName'>): string {
  const event = match.eventName?.trim()
  return event ? `Hicieron match · ${event}` : 'Hicieron match'
}

export function hasMessages(match: Pick<MatchSummary, 'lastMessageAt' | 'lastSeq'>): boolean {
  return !!match.lastMessageAt || match.lastSeq > 0
}

export function activityAt(match: Pick<MatchSummary, 'lastMessageAt' | 'createdAt'>): number {
  return Date.parse(match.lastMessageAt ?? match.createdAt)
}

export function sortByActivity<T extends Pick<MatchSummary, 'lastMessageAt' | 'createdAt'>>(matches: readonly T[]): T[] {
  return [...matches].sort((a, b) => activityAt(b) - activityAt(a))
}
