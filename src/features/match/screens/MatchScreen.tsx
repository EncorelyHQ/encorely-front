import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useMemo } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { findCachedEvent } from '@/features/events/cache'
import { formatEventDate } from '@/features/events/format'
import { useGenreLookup } from '@/features/events/genres'
import { matchesApi } from '@/lib/api/endpoints'
import { userMessage } from '@/lib/api/errors'
import { queryKeys } from '@/lib/query'
import { useUser } from '@/lib/session/SessionContext'
import { Button, ChatCircleIcon, EmptyState, ErrorState, LoadingState, Screen, Text, space, useStyles, type Theme } from '@/ui'
import { matchReason } from '../copy'
import type { MatchRouteParams } from '../hooks'
import { MatchTicket, type TicketField } from '../MatchTicket'

const MAX_GENRES = 2

export function MatchScreen({ params }: { params: MatchRouteParams }) {
  const styles = useStyles(makeStyles)
  const router = useRouter()
  const qc = useQueryClient()
  const me = useUser()
  const { sentence } = useGenreLookup()

  // Al venir del like los datos llegan por la ruta; si se abre por enlace, salen de /matches.
  const fromLike = Boolean(params.peerName)
  const matches = useQuery({ queryKey: queryKeys.matches, queryFn: matchesApi.list, enabled: !fromLike })
  const match = matches.data?.find((m) => m.id === params.matchId)

  const peerName = params.peerName ?? match?.peer.displayName
  const peerId = params.peerId ?? match?.peer.id
  const event = params.eventId ? findCachedEvent(qc, params.eventId) : undefined
  const eventName = params.eventName ?? event?.name ?? match?.eventName ?? null
  const slugs = params.genres ? params.genres.split(',').filter(Boolean) : (match?.sharedGenres ?? [])
  const genres = sentence(slugs, MAX_GENRES)

  const fields = useMemo<TicketField[]>(() => {
    if (!event) return []
    const date = formatEventDate(event.startsAt)
    return [
      { label: 'Fecha', value: `${date.weekdayShort} ${date.day} ${date.monthShort}` },
      { label: 'Hora', value: date.time },
    ]
  }, [event])

  useEffect(() => {
    if (peerName) AccessibilityInfo.announceForAccessibility(`Hicieron match con ${peerName}`)
  }, [peerName])

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/events'))
  const options = <Stack.Screen options={{ headerShown: false, animation: 'fade', gestureEnabled: true }} />

  if (!peerName) {
    return (
      <Screen edges={['top', 'bottom']}>
        {options}
        {matches.isError ? (
          <ErrorState message={userMessage(matches.error)} onRetry={() => void matches.refetch()} />
        ) : matches.isPending ? (
          <LoadingState label="Abriendo el match" />
        ) : (
          <EmptyState
            title="Este match ya no está"
            body="Puede que se haya cerrado. Sigue viendo quién va a tus conciertos."
            action={{ label: 'Volver', onPress: leave }}
          />
        )}
      </Screen>
    )
  }

  return (
    <Screen
      mode="scroll"
      edges={['top']}
      footer={
        <>
          <Button
            label="Escribirle"
            size="lg"
            icon={ChatCircleIcon}
            onPress={() => router.replace(`/chat/${params.matchId}`)}
          />
          {peerId ? (
            <Button label="Ver su perfil" variant="secondary" onPress={() => router.push(`/person/${peerId}`)} />
          ) : null}
          <Button label="Seguir viendo" variant="ghost" onPress={leave} />
        </>
      }
    >
      {options}
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text variant="title1" accessibilityRole="header">
            Hicieron match
          </Text>
          <Text variant="body" color="textMuted">
            {matchReason(eventName, genres)}
          </Text>
        </View>
        <MatchTicket
          tear
          myName={me.displayName}
          peerName={peerName}
          eventName={eventName}
          reason={genres ? `Les gusta ${genres}` : undefined}
          fields={fields}
        />
      </View>
    </Screen>
  )
}

const makeStyles = (_t: Theme) =>
  StyleSheet.create({
    content: { flexGrow: 1, justifyContent: 'center', gap: space.xxl, paddingVertical: space.xl },
    heading: { gap: space.sm },
  })
