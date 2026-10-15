import type { QueryClient } from '@tanstack/react-query'
import type { PublicProfile, ReactionRequest, ReactionTargetKind, ReactionType } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { isProfileGone, isTargetGone } from './errors'

export type ReactionTarget = { targetKind: ReactionTargetKind; targetKey: string }
// reaction: null = quitar mi sticker.
export type ReactionVars = ReactionTarget & { reaction: ReactionType | null }
type ReactionContext = { before: ReactionType | null }

const sameTarget = (a: ReactionTarget, b: ReactionTarget) => a.targetKind === b.targetKind && a.targetKey === b.targetKey

export function reactionFor(profile: Pick<PublicProfile, 'myReactions'>, target: ReactionTarget): ReactionType | null {
  return profile.myReactions.find((r) => sameTarget(r, target))?.reaction ?? null
}

// Una reacción por objetivo: poner otra reemplaza la anterior, como en el back.
export function applyReaction(profile: PublicProfile, vars: ReactionVars): PublicProfile {
  const rest = profile.myReactions.filter((r) => !sameTarget(r, vars))
  const { targetKind, targetKey, reaction } = vars
  return { ...profile, myReactions: reaction ? [...rest, { targetKind, targetKey, reaction }] : rest }
}

type ReactionDeps = {
  react: (userId: string, body: ReactionRequest) => Promise<void>
  unreact: (userId: string, targetKind: ReactionTargetKind, targetKey: string) => Promise<void>
  onError: (error: unknown) => void
}

// Separado del hook para probar el optimista y el rollback sin red ni React.
export function reactionMutationOptions(qc: QueryClient, userId: string, deps: ReactionDeps) {
  const key = queryKeys.profile(userId)
  const patch = (vars: ReactionVars) => {
    const current = qc.getQueryData<PublicProfile>(key)
    if (current) qc.setQueryData(key, applyReaction(current, vars))
  }
  return {
    // Serializa las reacciones a una misma persona: dos toques rápidos no llegan al back en desorden.
    scope: { id: `reaction:${userId}` },
    mutationFn: ({ targetKind, targetKey, reaction }: ReactionVars) =>
      reaction ? deps.react(userId, { targetKind, targetKey, reaction }) : deps.unreact(userId, targetKind, targetKey),
    onMutate: async (vars: ReactionVars): Promise<ReactionContext> => {
      await qc.cancelQueries({ queryKey: key })
      const current = qc.getQueryData<PublicProfile>(key)
      const before = current ? reactionFor(current, vars) : null
      patch(vars)
      return { before }
    },
    // Se deshace solo ese objetivo, no todo el perfil: otra reacción que sí salió no se pierde.
    onError: (error: unknown, vars: ReactionVars, ctx: ReactionContext | undefined) => {
      patch({ ...vars, reaction: ctx?.before ?? null })
      deps.onError(error)
      // El objetivo salió de su perfil, o el perfil ya no se puede ver: se vuelve a pedir y la pantalla lo refleja.
      if (isTargetGone(error) || isProfileGone(error)) void qc.invalidateQueries({ queryKey: key })
    },
  }
}
