import type { QueryClient } from '@tanstack/react-query'
import type { Me } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'

export type Visibility = 'visible' | 'off' | 'needsConsent'

// profileVisible = interruptor encendido Y consentimiento 2026-10-14 aceptado (draft.11). Si está apagado, se dice por qué.
export function visibilityOf(me: Pick<Me, 'showProfileToOthers' | 'profileVisible'>): Visibility {
  if (me.profileVisible) return 'visible'
  return me.showProfileToOthers ? 'needsConsent' : 'off'
}

export const VISIBILITY_COPY: Record<Visibility, string> = {
  visible: 'Cualquier persona en Encorely puede ver tu nombre, edad, ciudad, bio, géneros, artistas y estadísticas.',
  off: 'Nadie más ve tu perfil. Las reacciones que recibiste se guardan, pero no se muestran a nadie hasta que lo vuelvas a encender.',
  needsConsent: 'Tu perfil está encendido, pero nadie lo ve todavía: falta que aceptes la versión nueva de la política de datos.',
}

type VisibilityContext = { previous: Me | undefined }

// Separado del hook para probar el optimista sin red ni React.
export function visibilityMutationOptions(qc: QueryClient, update: (show: boolean) => Promise<Me>, onError: (error: unknown) => void) {
  return {
    mutationFn: update,
    onMutate: async (show: boolean): Promise<VisibilityContext> => {
      await qc.cancelQueries({ queryKey: queryKeys.me, exact: true })
      const previous = qc.getQueryData<Me>(queryKeys.me)
      // Solo el interruptor: si queda visible lo decide el back según el consentimiento.
      if (previous) qc.setQueryData<Me>(queryKeys.me, { ...previous, showProfileToOthers: show })
      return { previous }
    },
    onSuccess: (me: Me) => {
      qc.setQueryData(queryKeys.me, me)
    },
    onError: (error: unknown, _show: boolean, ctx: VisibilityContext | undefined) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.me, ctx.previous)
      onError(error)
    },
  }
}
