import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { meApi, usersApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/query'
import { reactionMutationOptions, type ReactionVars } from './reactions'
import { visibilityMutationOptions } from './visibility'
import { nextCursorOf } from './received'

export const useProfile = (userId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    queryFn: () => usersApi.profile(userId!),
    enabled: !!userId,
  })

type ReactionOptions = { onError?: (error: unknown) => void }

export function useReaction(userId: string, { onError }: ReactionOptions = {}) {
  const qc = useQueryClient()
  return useMutation<void, unknown, ReactionVars, { before: ReactionVars['reaction'] }>(
    reactionMutationOptions(qc, userId, {
      react: usersApi.react,
      unreact: usersApi.unreact,
      onError: (error) => onError?.(error),
    }),
  )
}

export const useReceivedReactions = () =>
  useInfiniteQuery({
    queryKey: queryKeys.receivedReactions,
    queryFn: ({ pageParam }) => meApi.receivedReactions(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursorOf,
  })

export function useProfileVisibility({ onError }: { onError?: (error: unknown) => void } = {}) {
  const qc = useQueryClient()
  return useMutation(
    visibilityMutationOptions(qc, (show) => meApi.update({ showProfileToOthers: show }), (error) => onError?.(error)),
  )
}
