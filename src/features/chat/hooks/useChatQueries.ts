import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { MatchSummary } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { useChatDeps } from '../data/ChatDepsContext'
import { getChatSession } from '../data/session'

// Detalle del match. Si se llega desde la lista, arranca con lo que ya está en caché (sin parpadeo).
export function useMatch(matchId: string) {
  const { transport } = useChatDeps()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: queryKeys.match(matchId),
    queryFn: () => transport.match(matchId),
    initialData: () => queryClient.getQueryData<MatchSummary[]>(queryKeys.matches)?.find((m) => m.id === matchId),
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKeys.matches)?.dataUpdatedAt,
  })
}

// Llaves del otro, ya verificadas (firma) y evaluadas contra el pin local. PeerKeyChanged invalida esta query.
export function usePeerKeys(matchId: string, me: string, enabled: boolean) {
  const deps = useChatDeps()
  const session = getChatSession(deps, me)
  return useQuery({
    queryKey: queryKeys.peerKeys(matchId),
    queryFn: () => session.fetchPeer(matchId),
    enabled,
    staleTime: 60_000,
    // Uint8Array no se compara bien con structural sharing y el snapshot siempre es nuevo.
    structuralSharing: false,
  })
}
