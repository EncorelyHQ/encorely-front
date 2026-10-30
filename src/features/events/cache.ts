import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { EventSummary } from '@/lib/api/types'

// Prefijo común de listas por ciudad, detalle y radar: invalidarlo refresca todo lo de conciertos.
export const eventsRoot = ['events'] as const

export type CacheSnapshot = [QueryKey, unknown][]

const isEvent = (value: unknown): value is EventSummary =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && 'startsAt' in value

// Bajo ['events'] conviven listas por ciudad, "mis eventos", detalle y radar: se distinguen por la forma.
const isEventList = (value: unknown): value is EventSummary[] =>
  Array.isArray(value) && value.length > 0 && value.every(isEvent)

export function findCachedEvent(qc: QueryClient, eventId: string): EventSummary | undefined {
  for (const [, data] of qc.getQueriesData({ queryKey: eventsRoot })) {
    if (isEvent(data) && data.id === eventId) return data
    if (isEventList(data)) {
      const hit = data.find((e) => e.id === eventId)
      if (hit) return hit
    }
  }
  return undefined
}

export function applyAttendance(event: EventSummary, going: boolean): EventSummary {
  if (event.iAmGoing === going) return event
  return { ...event, iAmGoing: going, attendeeCount: Math.max(0, event.attendeeCount + (going ? 1 : -1)) }
}

// Aplica el cambio en cada lista y detalle cacheados; devuelve lo que había para poder deshacerlo.
export function patchCachedEvent(
  qc: QueryClient,
  eventId: string,
  patch: (event: EventSummary) => EventSummary,
): CacheSnapshot {
  const snapshot: CacheSnapshot = []
  for (const [key, data] of qc.getQueriesData({ queryKey: eventsRoot })) {
    if (isEvent(data) && data.id === eventId) {
      snapshot.push([key, data])
      qc.setQueryData(key, patch(data))
    } else if (isEventList(data) && data.some((e) => e.id === eventId)) {
      snapshot.push([key, data])
      qc.setQueryData(
        key,
        data.map((e) => (e.id === eventId ? patch(e) : e)),
      )
    }
  }
  return snapshot
}

export function restoreSnapshot(qc: QueryClient, snapshot: CacheSnapshot | undefined): void {
  snapshot?.forEach(([key, data]) => qc.setQueryData(key, data))
}
