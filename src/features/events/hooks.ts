import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { eventsApi, meApi } from '@/lib/api/endpoints'
import { isApiError, userMessage } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query'
import { useToast } from '@/ui'
import { findCachedEvent } from './cache'
import { attendanceMutationOptions } from './mutations'

export const RADAR_LOCKED = 'radar_locked'
export const NOT_ATTENDING = 'not_attending'
export const EVENT_PAST = 'event_past'

export function useEventsList(city: string | undefined) {
  return useQuery({ queryKey: queryKeys.events(city), queryFn: () => eventsApi.list(city) })
}

// Pinta al instante con lo que ya trajo la lista y se actualiza en segundo plano (y sirve si se abre por enlace).
export function useEvent(eventId: string) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: queryKeys.event(eventId),
    queryFn: () => eventsApi.get(eventId),
    initialData: () => findCachedEvent(qc, eventId),
    initialDataUpdatedAt: 0,
  })
}

export function useAttendance(eventId: string) {
  const qc = useQueryClient()
  const toast = useToast()
  return useMutation(
    attendanceMutationOptions(qc, eventId, {
      attend: eventsApi.attend,
      unattend: eventsApi.unattend,
      onError: (error, going) =>
        toast.show(
          going
            ? `No pudimos marcar que vas. ${userMessage(error)}`
            : `No pudimos quitar tu asistencia. ${userMessage(error)}`,
          'danger',
        ),
    }),
  )
}

export function useRadar(eventId: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.radar(eventId), queryFn: () => eventsApi.radar(eventId), enabled })
}

// Cuántas canciones faltan para el radar: solo se pide cuando el back dijo que está bloqueado.
export function useSwipesMissing(enabled: boolean): number | null {
  const { data } = useQuery({ queryKey: queryKeys.dna, queryFn: meApi.dna, enabled })
  if (!data) return null
  const missing = data.radarThreshold - data.swipeCount
  return missing > 0 ? missing : null
}

export const isRadarLocked = (error: unknown) => isApiError(error, RADAR_LOCKED)
export const isEventPast = (error: unknown) => isApiError(error, EVENT_PAST)
export const isNotAttending = (error: unknown) => isApiError(error, NOT_ATTENDING)

// Pull to refresh con indicador propio: isRefetching también se enciende en refrescos de fondo.
export function useManualRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    refetch().finally(() => setRefreshing(false))
  }, [refetch])
  return { refreshing, onRefresh }
}
