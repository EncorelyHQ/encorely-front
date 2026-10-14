import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { matchesApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query'
import { useToast } from '@/ui'
import { likeMutationOptions } from './likeMutation'

export type MatchRouteParams = {
  matchId: string
  peerName?: string
  eventId?: string
  eventName?: string
  // Slugs separados por coma: los params de ruta son texto.
  genres?: string
}

type LikeContextInfo = { eventId: string; eventName?: string }

export function useLike({ eventId, eventName }: LikeContextInfo) {
  const qc = useQueryClient()
  const toast = useToast()
  const router = useRouter()

  return useMutation(
    likeMutationOptions(qc, eventId, {
      like: matchesApi.like,
      onMatched: (matchId, person) => {
        if (!matchId) {
          toast.show(`Hicieron match con ${person.displayName}. Lo encuentras en Chats.`, 'success')
          return
        }
        const params: MatchRouteParams = {
          matchId,
          peerName: person.displayName,
          eventId,
          eventName,
          genres: person.sharedGenres.join(','),
        }
        router.push({ pathname: '/match/[matchId]', params })
      },
      onLiked: () => toast.show('Le avisaremos si también le interesas.'),
      onError: (error) => toast.show(userMessage(error), 'danger'),
    }),
  )
}

// El radar sabe que hay match pero no trae su id: se busca en /matches (caché o red) para abrir el chat.
export function useOpenChatWith() {
  const qc = useQueryClient()
  const router = useRouter()
  const toast = useToast()
  const [opening, setOpening] = useState<string | null>(null)

  const open = useCallback(
    async (peerUserId: string) => {
      setOpening(peerUserId)
      try {
        const matches = await qc.fetchQuery({ queryKey: queryKeys.matches, queryFn: matchesApi.list })
        const match = matches.find((m) => m.peer.id === peerUserId && m.status === 'active')
        if (match) router.push(`/chat/${match.id}`)
        else toast.show('Este match ya no está activo.', 'danger')
      } catch (error) {
        toast.show(userMessage(error), 'danger')
      } finally {
        setOpening(null)
      }
    },
    [qc, router, toast],
  )

  return { open, opening }
}
