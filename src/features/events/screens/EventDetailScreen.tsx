import { useQueryClient } from '@tanstack/react-query'
import { Stack, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import { userMessage } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query'
import { Button, ErrorState, LoadingState, Screen, TicketIcon, space, useStyles, type Theme } from '@/ui'
import { EventTicket } from '../components/EventTicket'
import { RadarSection } from '../components/RadarSection'
import { useAttendance, useEvent, useManualRefresh } from '../hooks'

export function EventDetailScreen({ eventId }: { eventId: string }) {
  const styles = useStyles(makeStyles)
  const router = useRouter()
  const qc = useQueryClient()
  const event = useEvent(eventId)
  const attendance = useAttendance(eventId)

  const refetchAll = useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.event(eventId), exact: true }),
        qc.invalidateQueries({ queryKey: queryKeys.radar(eventId) }),
      ]),
    [qc, eventId],
  )
  const { refreshing, onRefresh } = useManualRefresh(refetchAll)

  const header = <Stack.Screen options={{ title: 'Concierto' }} />

  if (!event.data) {
    return (
      <Screen edges={[]}>
        {header}
        {event.isError ? (
          <ErrorState
            title="No pudimos abrir el concierto"
            message={userMessage(event.error)}
            onRetry={() => void event.refetch()}
            retrying={event.isFetching}
          />
        ) : (
          <LoadingState label="Cargando concierto" />
        )}
      </Screen>
    )
  }

  const data = event.data
  const going = data.iAmGoing

  return (
    <Screen
      mode="scroll"
      edges={[]}
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={
        going ? (
          <Button
            label="Ya no voy"
            variant="ghost"
            disabled={attendance.isPending}
            accessibilityHint="Dejarás de aparecer en el radar de este concierto"
            onPress={() => attendance.mutate({ going: false })}
          />
        ) : (
          <Button
            label="Voy a este concierto"
            size="lg"
            icon={TicketIcon}
            disabled={attendance.isPending}
            onPress={() => attendance.mutate({ going: true })}
          />
        )
      }
    >
      {header}
      <View style={styles.content}>
        <EventTicket event={data} />
        <RadarSection
          eventId={eventId}
          eventName={data.name}
          going={going}
          attendancePending={attendance.isPending}
        />
      </View>
      {/* Si se llega por enlace sin historial, "atrás" no existe: se ofrece volver a la lista. */}
      {router.canGoBack() ? null : (
        <Button label="Ver todos los conciertos" variant="ghost" onPress={() => router.replace('/events')} />
      )}
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    content: { gap: space.xxl },
  })
