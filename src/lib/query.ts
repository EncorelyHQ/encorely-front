import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Un 4xx no se arregla reintentando; la red y los 5xx sí, con pocas vueltas.
      retry: (count, error) => {
        if (error instanceof ApiError && error.kind === 'http' && error.status < 500) return false
        if (error instanceof ApiError && (error.kind === 'config' || error.kind === 'sessionExpired')) return false
        return count < 2
      },
    },
    mutations: { retry: false },
  },
})

export const queryKeys = {
  me: ['me'] as const,
  dna: ['me', 'dna'] as const,
  genres: ['genres'] as const,
  feed: ['songs', 'feed'] as const,
  events: (city?: string) => ['events', city ?? 'all'] as const,
  radar: (eventId: string) => ['events', eventId, 'radar'] as const,
  matches: ['matches'] as const,
  messages: (matchId: string) => ['matches', matchId, 'messages'] as const,
  peerKeys: (matchId: string) => ['matches', matchId, 'peer-keys'] as const,
  blocks: ['blocks'] as const,
  legal: ['legal'] as const,
}
