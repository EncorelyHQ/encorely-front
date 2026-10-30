import type { QueryClient } from '@tanstack/react-query'
import type { EventSummary } from '@/lib/api/types'
import { queryKeys } from '@/lib/query'
import { applyAttendance, eventsRoot, patchCachedEvent, restoreSnapshot, type CacheSnapshot } from './cache'

export type AttendanceVars = { going: boolean }
type AttendanceContext = { snapshot: CacheSnapshot }

type AttendanceDeps = {
  attend: (eventId: string) => Promise<EventSummary>
  unattend: (eventId: string) => Promise<EventSummary>
  onError: (error: unknown, going: boolean) => void
}

// Separado del hook para probar el optimista y el rollback sin red ni React.
export function attendanceMutationOptions(qc: QueryClient, eventId: string, deps: AttendanceDeps) {
  return {
    mutationFn: ({ going }: AttendanceVars) => (going ? deps.attend(eventId) : deps.unattend(eventId)),
    onMutate: async ({ going }: AttendanceVars): Promise<AttendanceContext> => {
      await qc.cancelQueries({ queryKey: eventsRoot })
      return { snapshot: patchCachedEvent(qc, eventId, (e) => applyAttendance(e, going)) }
    },
    // El back devuelve el evento con el conteo real: reemplaza al optimista sin otro viaje.
    onSuccess: (event: EventSummary) => {
      if (event) patchCachedEvent(qc, eventId, () => event)
    },
    onError: (error: unknown, vars: AttendanceVars, ctx: AttendanceContext | undefined) => {
      restoreSnapshot(qc, ctx?.snapshot)
      deps.onError(error, vars.going)
      void qc.invalidateQueries({ queryKey: eventsRoot })
    },
    // "Mis eventos" cambia de miembros y el radar depende de ir o no: esos sí se vuelven a pedir.
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.myEvents }),
        qc.invalidateQueries({ queryKey: queryKeys.radar(eventId) }),
      ]),
  }
}
