import { ApiError, isApiError, userMessage } from '@/lib/api/errors'

export const PROFILE_UNAVAILABLE = 'Este perfil no está disponible.'
const TARGET_GONE = 'Eso ya no está en su perfil. Lo actualizamos.'

// El back responde 404 user_not_found por bloqueo, cuenta suspendida, perfil oculto o inexistente. La app no dice cuál.
export const isProfileGone = (error: unknown) =>
  isApiError(error, 'user_not_found') || (error instanceof ApiError && error.kind === 'http' && error.status === 404)

export const isTargetGone = (error: unknown) => isApiError(error, 'reaction_target_not_found')

export function socialErrorMessage(error: unknown): string {
  if (isProfileGone(error)) return PROFILE_UNAVAILABLE
  if (isTargetGone(error)) return TARGET_GONE
  // cannot_react_self no debería llegar: la app no ofrece reaccionar al perfil propio.
  return userMessage(error)
}
