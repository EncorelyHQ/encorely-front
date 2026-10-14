import type { QueryClient } from '@tanstack/react-query'
import type { LikeResult, RadarPerson } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'

type LikeContext = { previous: RadarPerson[] | undefined }

type LikeDeps = {
  like: (targetUserId: string, eventId: string) => Promise<LikeResult>
  onMatched: (matchId: string | null, person: RadarPerson) => void
  onLiked: (person: RadarPerson) => void
  onError: (error: unknown, person: RadarPerson) => void
}

export function patchRadarPerson(
  list: RadarPerson[] | undefined,
  userId: string,
  patch: Partial<Pick<RadarPerson, 'likedByMe' | 'matched'>>,
): RadarPerson[] | undefined {
  return list?.map((p) => (p.userId === userId ? { ...p, ...patch } : p))
}

// Separado del hook para probar el optimista, el match y el rollback sin red ni React.
export function likeMutationOptions(qc: QueryClient, eventId: string, deps: LikeDeps) {
  const key = queryKeys.radar(eventId)
  return {
    mutationFn: (person: RadarPerson) => deps.like(person.userId, eventId),
    onMutate: async (person: RadarPerson): Promise<LikeContext> => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<RadarPerson[]>(key)
      qc.setQueryData<RadarPerson[]>(key, (list) => patchRadarPerson(list, person.userId, { likedByMe: true }))
      return { previous }
    },
    onError: (error: unknown, person: RadarPerson, ctx: LikeContext | undefined) => {
      if (ctx) qc.setQueryData(key, ctx.previous)
      deps.onError(error, person)
    },
    onSuccess: (result: LikeResult, person: RadarPerson) => {
      if (!result.matched) {
        deps.onLiked(person)
        return
      }
      qc.setQueryData<RadarPerson[]>(key, (list) => patchRadarPerson(list, person.userId, { matched: true }))
      void qc.invalidateQueries({ queryKey: queryKeys.matches })
      deps.onMatched(result.matchId ?? null, person)
    },
  }
}
