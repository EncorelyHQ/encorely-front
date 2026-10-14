import { useLayoutEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { meApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/query'
import { useSession } from '@/lib/session/SessionContext'
import { setDraft, useOnboardingDraft } from './draftStore'
import { applyProfile, draftFor, type OnboardingDraft } from './lib/draft'

// Borrador del onboarding atado a la cuenta actual y prellenado con lo que ya exista en GET /me.
// useLayoutEffect: el prellenado entra antes del primer pintado, sin destello de campos vacíos.
export function useSeededDraft(): OnboardingDraft {
  const { user } = useSession()
  const draft = useOnboardingDraft()
  const me = useQuery({ queryKey: queryKeys.me, queryFn: meApi.get, enabled: !!user })
  const userId = user?.id
  const userName = user?.displayName ?? ''

  useLayoutEffect(() => {
    if (userId) setDraft((current) => draftFor(current, userId, userName))
  }, [userId, userName])

  useLayoutEffect(() => {
    const profile = me.data
    if (!profile || !userId || profile.id !== userId) return
    setDraft((current) => (current.ownerId === userId ? applyProfile(current, profile) : current))
  }, [me.data, userId, draft.ownerId])

  return draft
}
